import { ChatLog } from "../../generated/prisma/client";
import { prisma } from "../database/prisma";
import { AppError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";
import { paginate } from "../utils/pagination";
import { PaginatedResult } from "../types/pagination";
// import { embedText } from '../lib/embeddings'; // Assuming this will be moved to a dedicated embedding service/utility

interface UpdateChatLogPayload {
  question?: string;
  answer?: string;
}

class ChatLogService {
  /**
   * Retrieves chat logs based on a session ID.
   * @param sessionId The session ID to filter chat logs.
   * @param limit The maximum number of logs to retrieve.
   * @returns An array of chat logs.
   */
  public async getChatLogsBySessionId(
    sessionId: string,
    limit: number = 500,
  ): Promise<ChatLog[]> {
    return prisma.chatLog.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Retrieves all chat logs, optionally filtered by session, with pagination.
   * @param sessionId Optional session ID to filter chat logs.
   * @param page The page number for pagination.
   * @param limit The number of items per page for pagination.
   * @returns A paginated result of chat logs.
   */
  public async getAllChatLogs(
    sessionId?: string,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<ChatLog>> {
    const where = sessionId ? { sessionId } : {};

    return paginate<ChatLog>(
      prisma.chatLog,
      { page, limit },
      {
        where,
        orderBy: { createdAt: "desc" },
      },
    );
  }

  /**
   * Retrieves a single chat log by its ID, including its feedback.
   * @param id The ID of the chat log.
   * @returns The chat log, or null if not found.
   */
  public async getChatLogById(id: string): Promise<ChatLog | null> {
    return prisma.chatLog.findUnique({
      where: { id },
      include: { feedbacks: true },
    });
  }

  /**
   * Updates a chat log.
   * @param id The ID of the chat log to update.
   * @param payload The data to update.
   * @returns The updated chat log.
   */
  public async updateChatLog(
    id: string,
    payload: UpdateChatLogPayload,
  ): Promise<ChatLog> {
    const existingLog = await prisma.chatLog.findUnique({
      where: { id },
    });

    if (!existingLog) {
      throw new AppError("Chat log not found", StatusCodes.NOT_FOUND);
    }

    const updatedLog = await prisma.chatLog.update({
      where: { id },
      data: {
        question: payload.question !== undefined ? payload.question : undefined,
        answer: payload.answer !== undefined ? payload.answer : undefined,
      },
    });

    // Regenerate embedding if question changed (assuming embedText is available)
    // if (payload.question && payload.question !== existingLog.question) {
    //   try {
    //     const emb = await embedText(payload.question); // This needs to be properly imported or moved
    //     await prisma.$executeRaw`
    //       UPDATE "chat_logs"
    //       SET embedding = ${JSON.stringify(emb)}::vector
    //       WHERE id = ${updatedLog.id}
    //     `;
    //   } catch (err) {
    //     console.error("Failed to update embedding:", err);
    //   }
    // }

    return updatedLog;
  }
}

export default new ChatLogService();
