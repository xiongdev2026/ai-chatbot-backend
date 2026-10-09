import { Request, Response, NextFunction } from "express";
import chatlogService from "../services/chatlog.service";
import ApiResponseHandler from "../utils/apiResponse";
import { AppError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";
import { ParsedQs } from "qs";

const toString = (
  value: string | ParsedQs | (string | ParsedQs)[] | undefined
): string => {
  if (!value) return "";

  if (Array.isArray(value)) {
    return toString(value[0]);
  }

  if (typeof value === "object") {
    return "";
  }

  return value;
};

/**
 * GET /chatlogs?sessionId=&page=&limit=
 */
export async function getChatLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = toString(req.query.sessionId);
    const { page, limit } = req.query;

    const logs = await chatlogService.getAllChatLogs(
      sessionId || undefined,
      page ? parseInt(page as string) : undefined,
      limit ? parseInt(limit as string) : undefined
    );

    return new ApiResponseHandler(res).success(
      logs.data,
      "Chat logs retrieved successfully",
      StatusCodes.OK,
      {
        total: logs.total,
        page: logs.page,
        limit: logs.limit,
        totalPages: logs.totalPages,
      }
    );
  } catch (error) {
    next(error);
  }
}

/**
 * GET /chatlogs/:id
 */
export async function getChatLogById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = toString(req.params.id);

    const log = await chatlogService.getChatLogById(id);

    if (!log) {
      return next(new AppError("Chat log not found", StatusCodes.NOT_FOUND));
    }

    return new ApiResponseHandler(res).success(
      log,
      "Chat log retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /chatlogs/:id
 */
export async function updateChatLog(req: Request, res: Response, next: NextFunction) {
  try {
    const id = toString(req.params.id);
    const { question, answer } = req.body;

    const updatedLog = await chatlogService.updateChatLog(id, {
      question,
      answer,
    });

    return new ApiResponseHandler(res).success(
      updatedLog,
      "Chat log updated successfully"
    );
  } catch (error) {
    next(error);
  }
}