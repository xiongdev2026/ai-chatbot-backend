import { Request, Response, NextFunction } from "express";
import knowledgeService from "../services/knowledge.service";
import ApiResponseHandler from "../utils/apiResponse";
import { AppError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";

/* ---------------------------
   GET ALL SOURCES
---------------------------- */
export async function getSources(req: Request, res: Response, next: NextFunction) {
  try {
    const sources = await knowledgeService.getAllKnowledgeSources();
    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(sources, "Knowledge sources retrieved successfully");
  } catch (error) {
    next(error);
  }
}

/* ---------------------------
   GET SOURCE BY ID
---------------------------- */
export async function getSourceById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const source = await knowledgeService.getKnowledgeSourceById(id);

    if (!source) {
      return next(new AppError("Knowledge source not found", StatusCodes.NOT_FOUND));
    }

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(source, "Knowledge source retrieved successfully");
  } catch (error) {
    next(error);
  }
}

/* ---------------------------
   CREATE SOURCE
---------------------------- */
export async function createSource(req: Request, res: Response, next: NextFunction) {
  try {
    const { sourceType, title, category, isActive } = req.body;

    if (!title) {
      return next(new AppError("Title is required", StatusCodes.BAD_REQUEST));
    }

    const source = await knowledgeService.createKnowledgeSource({ sourceType, title, category, isActive });

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(source, "Knowledge source created successfully", StatusCodes.CREATED);
  } catch (error) {
    next(error);
  }
}

/* ---------------------------
   UPDATE SOURCE
---------------------------- */
export async function updateSource(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { sourceType, title, category, isActive } = req.body; // metadata removed, should be handled in service if needed

    const updatedSource = await knowledgeService.updateKnowledgeSource(id, { sourceType, title, category, isActive });

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(updatedSource, "Knowledge source updated successfully");
  } catch (error) {
    next(error);
  }
}

/* ---------------------------
   DELETE SOURCE
---------------------------- */
export async function deleteSource(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await knowledgeService.deleteKnowledgeSource(id);

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(null, "Knowledge source deleted successfully", StatusCodes.OK);
  } catch (error) {
    next(error);
  }
}

/* ---------------------------
   POST /sources/:id/chunks
---------------------------- */
export async function createChunks(req: Request, res: Response, next: NextFunction) {
  try {
    const sourceId = req.params.id as string;
    const { content, lang } = req.body;

    if (!content) {
      return next(new AppError("Content is required", StatusCodes.BAD_REQUEST));
    }

    const count = await knowledgeService.createChunksForSource(sourceId, content, lang);

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success({ count }, "Chunks created successfully", StatusCodes.CREATED);
  } catch (error) {
    next(error);
  }
}
