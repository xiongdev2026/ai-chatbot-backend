import { prisma } from "../database/prisma";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { env } from "../config";
import { ChatLog, Prisma } from "../../generated/prisma";
import embeddingService from "./embedding.service";
import { CANONICAL_ANSWER_THRESHOLD } from "../config/confidence";

class ChatService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor() {
    this.genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: env.AI_MODEL });
  }

  /**
   * Retrieves chat history for a specific conversation.
   * @param sessionId The ID of the conversation.
   * @returns An array of chat logs for the conversation.
   */
  public async getChatHistory(sessionId: string): Promise<ChatLog[]> {
    const chatLogs = await prisma.chatLog.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    });
    return chatLogs;
  }

  /**
   * Sends a message to the AI and records the interaction.
   * @param sessionId The ID of the current conversation.
   * @param userId The ID of the user sending the message.
   * @param userMessage The user's message.
   * @returns The AI's response and the recorded chat log.
   */
  public async sendMessage(
    sessionId: string,
    userId: string | undefined,
    userMessage: string,
  ): Promise<{ aiResponse: string; chatLog: ChatLog; canonicalAnswer?: string }> {
    // Start the clock BEFORE any work so the measured time covers the entire
    // answer pipeline: DB queries, pgvector search, prompt build, history load,
    // and LLM generation. Stopped once the answer text is ready (below).
    const startedAt = Date.now();

    // 1. Retrieve context from the knowledge base ONLY (FAQs, Departments,
    //    Doctors, Medical/Services, Posts, Knowledge Chunks). Chat history is
    //    deliberately NOT a retrieval source — it is used only as conversational
    //    memory (see step 3) so past AI answers can never become "facts".
    const { context, retrievedChunks, matchType } =
      await embeddingService.retrieveContext(userMessage);

    const confidenceScore =
      retrievedChunks.length > 0
        ? Math.max(...retrievedChunks.map((c) => c.similarity))
        : 0; // No relevant information was found

    // A canonical answer is what the admin UI shows as "Database Answer" and diffs the
    // AI reply against, so it must only ever be set when retrieval found something that
    // genuinely answers THIS question. Retrieval has already applied the intent gate and
    // collapsed an off-intent hit to matchType "none" with no chunks; the checks here are
    // the gate on top of that:
    //   - "none"/empty  → no canonical answer at all (UI renders "—", no diff highlighting)
    //   - "exact"       → curated structured hit, always trustworthy (similarity 0.95)
    //   - "semantic"    → only above the threshold, so a weak-but-passing hit isn't
    //                     presented as the authoritative database answer
    const hasRelevantMatch = matchType !== "none" && retrievedChunks.length > 0;
    const shouldUseCanonical =
      hasRelevantMatch &&
      (matchType === "exact" || confidenceScore >= CANONICAL_ANSWER_THRESHOLD);

    const canonicalAnswer = shouldUseCanonical ? retrievedChunks[0].content : undefined;

    // 2. Build prompt for Gemini AI
    const prompt = this.buildPrompt(context, userMessage, matchType);

    // 3. Get conversation history for Gemini's memory
    const history = await this.getChatHistory(sessionId);
    const historyParts = history.flatMap((log) => [
      { role: "user", parts: [{ text: log.question }] },
      { role: "model", parts: [{ text: log.answer }] }
    ]);
    const chatSession = this.model.startChat({
      history: historyParts,
      generationConfig: {
        // NOT a style control — brevity comes from the prompt, not from this cap.
        // This is purely a truncation guard, and it must clear the model's THINKING
        // budget: gemini-2.5-flash reasons internally by default and those thoughts
        // are charged against maxOutputTokens. Measured on a one-sentence Lao answer:
        // 233 thinking tokens + 63 visible tokens. The old cap of 300 therefore left
        // ~67 tokens for the reply and returned it chopped mid-word with
        // finishReason=MAX_TOKENS. Keep well clear of the thinking budget.
        maxOutputTokens: 2048,
      },
    });

    // 4. Send message to Gemini AI with retry logic
    const aiResponse = await this.sendMessageWithRetry(chatSession, prompt);

    // Stop the clock: the complete response has been generated. Post-processing
    // (extracting text above) is included; the DB write below is bookkeeping and
    // not part of what the user waits for, so it is intentionally excluded.
    const responseTimeMs = Date.now() - startedAt;

    // 5. Save chat log to database
    const chatLog = await prisma.chatLog.create({
      data: {
        sessionId,
        userId,
        question: userMessage,
        answer: aiResponse,
        confidenceScore,
        modelUsed: env.AI_MODEL,
        responseTimeMs,
        canonicalAnswer,
        // `retrieved_chunks` is a Json column — store the array directly so it
        // round-trips as an array. JSON.stringify() here would store a JSON
        // *string*, which then breaks `.map()` on the client.
        retrievedChunks:
          retrievedChunks.length > 0
            ? (retrievedChunks as unknown as Prisma.InputJsonValue)
            : undefined,
        // completionTokens: ... (if available from Gemini API)
      },
    });

    return { aiResponse, chatLog, canonicalAnswer };
  }

  /**
   * Sends a message to Gemini with automatic retry logic for temporary failures.
   * @param chatSession The Gemini chat session
   * @param prompt The prompt to send
   * @returns The AI response text
   */
  private async sendMessageWithRetry(
    chatSession: any,
    prompt: string,
    maxRetries: number = 3
  ): Promise<string> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await chatSession.sendMessage(prompt);
        const text = result.response.text();

        // A truncated answer is still a *successful* API call: `.text()` returns the
        // partial string with no error, so a mid-sentence cut is indistinguishable from
        // a real answer unless finishReason is inspected. Surface it instead of shipping
        // half a sentence to the user in silence. Not retried: an identical request would
        // hit the identical cap — the fix is always config, not another attempt.
        const finishReason = result.response.candidates?.[0]?.finishReason;
        if (finishReason && finishReason !== "STOP") {
          const usage = result.response.usageMetadata as
            | { thoughtsTokenCount?: number; candidatesTokenCount?: number }
            | undefined;
          console.warn(
            `Gemini returned a non-STOP finishReason=${finishReason}; the answer is likely incomplete. ` +
              `thinking tokens=${usage?.thoughtsTokenCount ?? "?"}, answer tokens=${usage?.candidatesTokenCount ?? "?"}. ` +
              `If MAX_TOKENS, raise generationConfig.maxOutputTokens above the model's thinking budget.`
          );
        }

        return text;
      } catch (error: any) {
        lastError = error;
        const statusCode = error.status || error.code;

        // Retry only on temporary errors (503, 429, timeout, etc.)
        const isTemporaryError =
          statusCode === 503 ||
          statusCode === 429 ||
          statusCode === 408 ||
          error.message?.includes("temporarily unavailable") ||
          error.message?.includes("high demand");

        if (!isTemporaryError || attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff: 2^attempt seconds (2s, 4s, 8s)
        const delayMs = Math.pow(2, attempt) * 1000;
        console.log(
          `API request failed (attempt ${attempt}/${maxRetries}). Retrying in ${delayMs}ms...`
        );

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw lastError;
  }

  /**
   * Helper function to build the prompt for the AI.
   * @param context Retrieved context from the knowledge base only (never chat history).
   * @param question The user's question.
   * @param matchType Whether the context is a curated exact match, a semantic
   *   "closest available" match, or no match was found at all — controls how
   *   the model is told to frame its answer (or decline to answer).
   * @returns The formatted prompt string.
   */
  private buildPrompt(
    context: string,
    question: string,
    matchType: "exact" | "semantic" | "none",
  ): string {
    const sanitizedQuestion = question.replace(/System:|Instruction:|Ignore previous/gi, "");

    // For "none" the model must decline. For BOTH "exact" and "semantic" it answers
    // directly and naturally — the spec forbids ever surfacing that a hit was only the
    // "closest" match (no "closest information" / "based on available data" phrasing).
    const groundingInstruction =
      matchType === "none"
        ? 'ບໍ່ພົບຂໍ້ມູນທີ່ກ່ຽວຂ້ອງໃນຖານຂໍ້ມູນ. ໃຫ້ຕອບຢ່າງສຸພາບ, ອ່ອນໂຍນ ແລະ ເປັນທຳມະຊາດວ່າ "ຍັງບໍ່ມີຂໍ້ມູນ" ໃນຕອນນີ້ — ໃຫ້ຂຶ້ນຕົ້ນດ້ວຍຄຳຂໍໂທດ ("ຂໍອະໄພ" / "ຂໍໂທດ" / "Sorry") ສະເໝີ. ຫ້າມເວົ້າວ່າ "ຕອບບໍ່ໄດ້", "ບໍ່ສາມາດຕອບໄດ້", "ຕອບຄຳຖາມນີ້ບໍ່ໄດ້", "ຕອບຫຍັງບໍ່ໄດ້" ຫຼື "I can\'t answer" ເດັດຂາດ — ໃຫ້ເວົ້າວ່າ "ຍັງບໍ່ມີຂໍ້ມູນ" ແທນສະເໝີ. ຫ້າມແຕ່ງຂໍ້ມູນຂຶ້ນມາເອງເດັດຂາດ. ຕົວຢ່າງນ້ຳສຽງທີ່ຕ້ອງການ (ໃຫ້ປັບຄຳໃຫ້ເໝາະກັບຄຳຖາມ, ຕອບເປັນພາສາດຽວກັນກັບຄຳຖາມ): ພາສາລາວ → "ຂໍອະໄພ, ຕອນນີ້ເຮົາຍັງບໍ່ມີຂໍ້ມູນນີ້ເດີ"; ພາສາໄທ → "ຂໍໂທດຄ່ະ ຕອນນີ້ຍັງບໍ່ມີຂໍ້ມູນນີ້ຄ່ະ"; English → "Sorry, we don\'t have that information at the moment." (No relevant info found — reply politely and warmly that the information is NOT AVAILABLE YET, ALWAYS opening with an apology, in the SAME language as the question. NEVER phrase it as an inability to answer — "I can\'t answer" / "I\'m unable to answer" / "ຕອບບໍ່ໄດ້" are FORBIDDEN. Always frame it as the information not being available yet. Do NOT invent an answer.)'
        : "ຕອບຄຳຖາມຈາກ Context ຂ້າງລຸ່ມນີ້ຢ່າງເປັນທຳມະຊາດ ແລະ ໝັ້ນໃຈ. (Answer directly and naturally from the Context below. NEVER say things like \"closest information\", \"based on available data\", or that this might not be exact — just answer.)";

    return `
ເຈົ້າແມ່ນພະນັກງານຕ້ອນຮັບ AI ຂອງໂຮງໝໍ (You are a hospital receptionist chatbot). ຮອງຮັບ ພາສາລາວ, ພາສາອັງກິດ ແລະ ພາສາໄທ (Support Lao, English, and Thai).

ກົດພື້ນຖານທີ່ສຳຄັນທີ່ສຸດ (CRITICAL RULES — follow exactly):
- ໃຊ້ຂໍ້ມູນຈາກ Context ຂ້າງລຸ່ມນີ້ເທົ່ານັ້ນ. ຫ້າມໃຊ້ຄວາມຮູ້ພາຍນອກ ຫຼື ແຕ່ງຂໍ້ມູນຂຶ້ນມາເອງ. (Answer using ONLY the Context below. Never use outside knowledge or invent facts.)
- ${groundingInstruction}
- ຕອບເປັນພາສາດຽວກັນກັບຄຳຖາມ (Reply in the SAME language as the question — Lao, English, or Thai).
- ຕອບໃຫ້ສັ້ນ, ຊັດເຈນ ແລະ ກົງໄປກົງມາ ຄືກັບພະນັກງານຕ້ອນຮັບ — ໂດຍທົ່ວໄປ 1 ປະໂຫຍກ. (Keep every answer SHORT, clear, and direct like a real hospital receptionist — usually one sentence.)
- ຫ້າມກ່າວເຖິງ Context, ກົດເກນ, ຄະແນນຄວາມຄ້າຍຄື ຫຼື ວິທີທີ່ຫາຄຳຕອບ. (Never mention the context, these rules, similarity scores, or how you found the answer.)
- ສຳລັບບັນຫາທາງການແພດ ໃຫ້ແນະນຳສັ້ນໆ ໃຫ້ພົບແພດໂດຍກົງ. (For medical concerns, briefly suggest seeing a doctor in person.)

Context:
${context || "No specific context available."}

Question:
${sanitizedQuestion}
`;
  }
}

export default new ChatService();
