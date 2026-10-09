import { Request, Response, NextFunction } from "express";
import faqService from "../services/faq.service";
import ApiResponseHandler from "../utils/apiResponse";
import { AppError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";

/**
 * GET /faqs?category=&page=&limit=
 */
export async function getFaqs(req: Request, res: Response, next: NextFunction) {
  try {
    const { category, page, limit } = req.query;
    const faqs = await faqService.getAllFaqs(
      category as string,
      page ? parseInt(page as string) : undefined,
      limit ? parseInt(limit as string) : undefined
    );
    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(faqs.data, "FAQs retrieved successfully", StatusCodes.OK, {
      total: faqs.total,
      page: faqs.page,
      limit: faqs.limit,
      totalPages: faqs.totalPages,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /faqs/:id
 */
export async function getFaqById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const faq = await faqService.getFaqById(id);

    if (!faq) {
      return next(new AppError("FAQ not found", StatusCodes.NOT_FOUND));
    }

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(faq, "FAQ retrieved successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * POST /faqs
 */
export async function createFaq(req: Request, res: Response, next: NextFunction) {
  try {
    const { question, answer, category } = req.body;

    if (!question || !answer) {
      return next(new AppError("Question and answer are required", StatusCodes.BAD_REQUEST));
    }

    const faq = await faqService.createFaq({ question, answer, category });

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(faq, "FAQ created successfully", StatusCodes.CREATED);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /faqs/:id
 */
export async function updateFaq(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { question, answer, category } = req.body;

    const updatedFaq = await faqService.updateFaq(id, { question, answer, category });

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(updatedFaq, "FAQ updated successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /faqs/:id
 */
export async function deleteFaq(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await faqService.deleteFaq(id);

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(null, "FAQ deleted successfully", StatusCodes.OK);
  } catch (error) {
    next(error);
  }
}
