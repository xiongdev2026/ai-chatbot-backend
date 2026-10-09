import { prisma } from "../database/prisma";
import { embedText } from "../utils/embeddings";
import { AppError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";
import {
  SEMANTIC_SIMILARITY_FLOOR,
  EXACT_MATCH_SIMILARITY,
} from "../config/confidence";

interface RetrievedChunk {
  id: string;
  content: string;
  similarity: number;
  sourceType: string;
  sourceTitle: string;
}

type MatchType = "exact" | "semantic" | "none";

type KnowledgeRow = {
  id: string;
  content: string;
  sourceType: string;
  sourceTitle: string;
  distance: number;
};

class EmbeddingService {
  /**
   * Convert embedding array → pgvector format
   */
  private toVectorString(vector: number[]): string {
    return `[${vector.join(",")}]`;
  }

  /**
   * Lowercase + strip punctuation so "Cardiology?" and "cardiology" both match,
   * and minor typos/spacing differences don't block an otherwise-clear name match.
   *
   * \p{M} (combining marks) MUST be preserved alongside letters: Lao and Thai write
   * vowels and tone marks as nonspacing marks, so treating them as punctuation deletes
   * them — "ໂຮງໝໍຊື່ຫຍັງ" ("What is the hospital name?") collapses to "ໂຮງຫມ ຊ ຫຍ ງ"
   * and no Lao keyword can ever match. Latin text is unaffected either way.
   */
  private normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Keywords that identify what a piece of text is *about*, in all three supported
   * languages (English, Lao, Thai). Kept deliberately specific: a keyword here must
   * be a strong signal of the intent on its own, because a single incidental hit is
   * enough to make content look relevant. Generic clinical words ("check", "exam")
   * are excluded for that reason — they appear in text about almost anything.
   */
  private static readonly INTENT_KEYWORDS: Record<string, string[]> = {
    name: ["name", "called", "ຊື່", "ຊື່ວ່າ", "ชื่อ"],
    hours: ["hour", "open", "close", "ເວລາ", "ເປີດ", "ປິດ", "ຊົ່ວໂມງ", "เวลา", "เปิด", "ปิด"],
    location: [
      "location", "address", "building", "floor", "where",
      "ສະຖານທີ່", "ທີ່ຕັ້ງ", "ຕຶກ", "ຢູ່ໃສ",
      "ที่ตั้ง", "สถานที่", "อยู่ที่ไหน",
    ],
    department: ["department", "ພະແນກ", "แผนก"],
    appointment: ["appointment", "book", "booking", "schedule", "ນັດ", "ຈອງ", "นัด", "จอง"],
    // Bare "ໝໍ" is deliberately absent: Lao for hospital is "ໂຮງໝໍ" (literally
    // "house of doctor"), so it would make every mention of the hospital itself —
    // in the question AND in the content — signal `doctor`, matching everything.
    doctor: ["doctor", "physician", "specialist", "ທ່ານໝໍ", "ແພດ", "หมอ", "แพทย์"],
    service: ["service", "treatment", "check up", "ບໍລິການ", "ປິ່ນປົວ", "บริการ", "รักษา"],
  };

  /**
   * Every intent the text signals — NOT just the first one found.
   *
   * Returning a set rather than a single winner matters: "What are the doctor's
   * hours?" signals both `doctor` and `hours`, and collapsing it to whichever key
   * happens to be checked first would reject the correct record for carrying the
   * other half of the question.
   */
  private detectIntents(text: string): Set<string> {
    const normalized = this.normalize(text);
    const intents = new Set<string>();

    for (const [intent, keywords] of Object.entries(EmbeddingService.INTENT_KEYWORDS)) {
      // Keywords are normalized too, not just the text: NFKC decomposes Lao ໝ → ຫມ,
      // so a raw keyword would silently fail to match already-normalized content.
      if (keywords.some((keyword) => normalized.includes(this.normalize(keyword)))) {
        intents.add(intent);
      }
    }

    return intents;
  }

  /**
   * True if `content` is about the same thing the question asks about.
   *
   * Guards the failure this exists for: "What is the hospital name?" scores ~0.70
   * cosine similarity against an opening-hours chunk purely because both are hospital
   * text, and would otherwise be served as a confident, wrong answer. Similarity
   * measures topical closeness; it cannot tell `name` from `hours`.
   *
   * A question with no recognizable intent accepts any content — the alternative is
   * rejecting every question this keyword list doesn't happen to cover.
   */
  private validateContentRelevance(question: string, content: string): boolean {
    const questionIntents = this.detectIntents(question);
    if (questionIntents.size === 0) return true;

    const contentIntents = this.detectIntents(content);

    // STRICT: the content must speak to at least one thing the question asked about.
    for (const intent of questionIntents) {
      if (contentIntents.has(intent)) return true;
    }

    return false;
  }

  /**
   * True if `needle` meaningfully appears inside `haystack` (in either direction).
   * Guards against very short strings matching almost anything.
   */
  private fuzzyIncludes(haystack: string, needle: string): boolean {
    if (!needle || needle.length < 3) return false;
    return haystack.includes(needle) || needle.includes(haystack);
  }

  /**
   * Step 1 of retrieval: exact/structured match against curated, structured
   * hospital data (FAQs, Departments, Doctors, Medical Services, Services, Posts).
   * These tables are small at MVP scale, so an in-memory scan is simpler and
   * cheaper than building full-text search infrastructure for them.
   */
  private async structuredSearch(question: string): Promise<RetrievedChunk[]> {
    const q = this.normalize(question);

    const [faqs, departments, doctors, medicalServices, services, posts] =
      await Promise.all([
        prisma.faq.findMany({ where: { isActive: true } }),
        prisma.department.findMany({ where: { isActive: true } }),
        prisma.doctor.findMany({
          where: { isActive: true },
          include: { department: true },
        }),
        prisma.medicalService.findMany({
          where: { isActive: true },
          include: { department: true },
        }),
        prisma.service.findMany({ where: { isActive: true } }),
        prisma.post.findMany({ where: { status: "PUBLISHED" } }),
      ]);

    const hits: RetrievedChunk[] = [];

    for (const faq of faqs) {
      const normalizedQuestion = this.normalize(faq.question);
      if (this.fuzzyIncludes(q, normalizedQuestion) && this.validateContentRelevance(question, faq.answer)) {
        hits.push({
          id: faq.id,
          content: `Q: ${faq.question}\nA: ${faq.answer}`,
          similarity: EXACT_MATCH_SIMILARITY,
          sourceType: "FAQ",
          sourceTitle: faq.question,
        });
      }
    }

    for (const dept of departments) {
      if (this.fuzzyIncludes(q, this.normalize(dept.name))) {
        const deptContent = `Department: ${dept.name}. ${dept.description ?? ""} Location: ${
          dept.location ?? "N/A"
        }. Opening hours: ${dept.openingHours ?? "N/A"}.`;
        if (this.validateContentRelevance(question, deptContent)) {
          hits.push({
            id: dept.id,
            content: deptContent,
            similarity: EXACT_MATCH_SIMILARITY,
            sourceType: "Department",
            sourceTitle: dept.name,
          });
        }
      }
    }

    for (const doctor of doctors) {
      const nameMatch = this.fuzzyIncludes(q, this.normalize(doctor.fullName));
      const specialtyMatch = this.fuzzyIncludes(q, this.normalize(doctor.specialty));
      if (nameMatch || specialtyMatch) {
        const doctorContent = `Doctor: ${doctor.fullName}, Specialty: ${doctor.specialty}, Department: ${
          doctor.department?.name ?? "N/A"
        }. ${doctor.bio ?? ""}`;
        if (this.validateContentRelevance(question, doctorContent)) {
          hits.push({
            id: doctor.id,
            content: doctorContent,
            similarity: EXACT_MATCH_SIMILARITY,
            sourceType: "Doctor",
            sourceTitle: doctor.fullName,
          });
        }
      }
    }

    for (const ms of medicalServices) {
      if (this.fuzzyIncludes(q, this.normalize(ms.name))) {
        const msContent = `Medical Service: ${ms.name} (Department: ${
          ms.department?.name ?? "N/A"
        }). ${ms.description ?? ""}`;
        if (this.validateContentRelevance(question, msContent)) {
          hits.push({
            id: ms.id,
            content: msContent,
            similarity: EXACT_MATCH_SIMILARITY,
            sourceType: "MedicalService",
            sourceTitle: ms.name,
          });
        }
      }
    }

    for (const svc of services) {
      if (this.fuzzyIncludes(q, this.normalize(svc.name))) {
        const svcContent = `Service: ${svc.name}. ${svc.shortDescription ?? svc.fullDescription ?? ""}`;
        if (this.validateContentRelevance(question, svcContent)) {
          hits.push({
            id: svc.id,
            content: svcContent,
            similarity: EXACT_MATCH_SIMILARITY,
            sourceType: "Service",
            sourceTitle: svc.name,
          });
        }
      }
    }

    for (const post of posts) {
      if (this.fuzzyIncludes(q, this.normalize(post.title))) {
        const postContent = `${post.title}: ${(post.content ?? "").slice(0, 500)}`;
        if (this.validateContentRelevance(question, postContent)) {
          hits.push({
            id: post.id,
            content: postContent,
            similarity: EXACT_MATCH_SIMILARITY,
            sourceType: "Post",
            sourceTitle: post.title,
          });
        }
      }
    }

    return hits;
  }

  /**
   * Retrieves context for the AI prompt:
   *  1. Exact/structured match across curated hospital data.
   *  2. If nothing found, semantic (pgvector) search over the knowledge base.
   * Returns which tier produced the result so the prompt can be honest about
   * whether this is a direct answer or the closest available information.
   */
  public async retrieveContext(
    question: string,
    topK: number = 3
  ): Promise<{ context: string; retrievedChunks: RetrievedChunk[]; matchType: MatchType }> {
    try {
      // 1. Exact/structured match
      const structuredHits = await this.structuredSearch(question);

      if (structuredHits.length > 0) {
        // FAQs are the most curated/authoritative source, then entity records, then posts.
        const top = structuredHits.slice(0, topK);
        return {
          context: top.map((c) => c.content).join("\n\n"),
          retrievedChunks: top,
          matchType: "exact",
        };
      }

      // 2. Semantic search (pgvector) over the knowledge base
      const embedding = await embedText(question);
      const vector = this.toVectorString(embedding);

      const rows = await prisma.$queryRaw<KnowledgeRow[]>`
        SELECT
          id,
          content,
          'KnowledgeChunk' AS "sourceType",
          'Knowledge Base' AS "sourceTitle",
          (embedding <=> ${vector}::vector) AS distance
        FROM "knowledge_chunks"
        WHERE embedding IS NOT NULL
          AND (embedding <=> ${vector}::vector) < ${1 - SEMANTIC_SIMILARITY_FLOOR}
        ORDER BY distance ASC
        LIMIT ${topK}
      `;

      // 3. Rank by similarity, drop anything below the usefulness floor, dedupe identical content
      const seen = new Set<string>();
      const retrievedChunks: RetrievedChunk[] = rows
        .map((r) => ({
          id: r.id,
          content: r.content,
          similarity: 1 - r.distance,
          sourceType: r.sourceType,
          sourceTitle: r.sourceTitle,
        }))
        .filter((c) => c.similarity >= SEMANTIC_SIMILARITY_FLOOR)
        // Similarity alone can't tell intent apart: "What is the hospital name?" scores ~0.70
        // against an opening-hours chunk simply because both are hospital text. Require the
        // same intent gate the structured tier uses, so an off-intent hit becomes "none"
        // rather than a confident wrong answer.
        .filter((c) => this.validateContentRelevance(question, c.content))
        .sort((a, b) => b.similarity - a.similarity)
        .filter((c) => {
          if (seen.has(c.content)) return false;
          seen.add(c.content);
          return true;
        });

      if (retrievedChunks.length === 0) {
        return { context: "", retrievedChunks: [], matchType: "none" };
      }

      return {
        context: retrievedChunks.map((c) => c.content).join("\n\n"),
        retrievedChunks,
        matchType: "semantic",
      };
    } catch (error) {
      console.error("retrieveContext error:", error);
      throw new AppError(
        "Failed to retrieve context",
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
}

export default new EmbeddingService();
