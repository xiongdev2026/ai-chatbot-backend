import { Request, Response, NextFunction } from "express";
import chatService from "../services/chat.service";
import ApiResponseHandler from "../utils/apiResponse";
import { AppError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../database/prisma";

/**
 * POST /chat
 * Handles user chat messages, interacts with AI, and stores chat logs.
 */
export async function chat(req: Request, res: Response, next: NextFunction) {
  try {
    const { question, sessionId } = req.body;
    const userId = req.user?.id; // Optional

    const { aiResponse, chatLog, canonicalAnswer } = await chatService.sendMessage(sessionId, userId, question);

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success({
      sessionId: chatLog.sessionId,
      question: chatLog.question,
      answer: aiResponse,
      chatLogId: chatLog.id,
      responseTimeMs: chatLog.responseTimeMs,
      canonicalAnswer,
    }, "Chat response generated successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * GET /chat/:sessionId
 * Retrieves chat logs for a specific conversation.
 */
export async function getChatLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.params.sessionId as string;
    const userId = req.user?.id;

    const chatLogs = await chatService.getChatHistory(sessionId);

    // Validate that the user owns the conversation if it has an owner and the user is not an ADMIN.
    if (chatLogs.length > 0 && chatLogs[0].userId) {
      if (chatLogs[0].userId !== userId && req.user?.role !== "ADMIN") {
        return next(new AppError("Unauthorized access to conversation.", StatusCodes.FORBIDDEN));
      }
    }

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(chatLogs, "Chat logs retrieved successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * GET /chat/conversations
 * Retrieves all conversations for the authenticated user.
 */
export async function getUserConversations(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return next(new AppError("User not authenticated.", StatusCodes.UNAUTHORIZED));
    }

    const conversations = await prisma.chatLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      distinct: ['sessionId']
    });

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(conversations, "User conversations retrieved successfully");
  } catch (error) {
    next(error);
  }
}
