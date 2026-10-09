import { prisma } from "../database/prisma";
import { AppError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";
import { paginate } from "../utils/pagination";
import { Faq } from "../../generated/prisma/client";
import { PaginatedResult } from "../types/pagination";

interface CreateFaqPayload {
  question: string;
  answer: string;
  category?: string;
}

interface UpdateFaqPayload {
  question?: string;
  answer?: string;
  category?: string;
}

class FaqService {
  /**
   * Retrieves all FAQs, optionally filtered by category, with pagination.
   * @param category Optional category to filter FAQs.
   * @param page The page number for pagination.
   * @param limit The number of items per page for pagination.
   * @returns A paginated result of FAQs.
   */
  public async getAllFaqs(
    category?: string,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<Faq>> {
    const where = category ? { category } : {};
    const faqs = await paginate<Faq>(
      prisma.faq,
      { page, limit },
      {
        where,
        orderBy: { createdAt: "desc" },
      },
    );
    return faqs;
  }

  /**
   * Retrieves an FAQ by its ID.
   * @param id The ID of the FAQ.
   * @returns The FAQ, or null if not found.
   */
  public async getFaqById(id: string): Promise<Faq | null> {
    return prisma.faq.findUnique({
      where: { id },
    });
  }

  /**
   * Creates a new FAQ.
   * @param payload The data for the new FAQ.
   * @returns The newly created FAQ.
   */
  public async createFaq(payload: CreateFaqPayload): Promise<Faq> {
    const { question, answer, category } = payload;
    return prisma.faq.create({
      data: {
        question,
        answer,
        category,
      },
    });
  }

  /**
   * Updates an existing FAQ.
   * @param id The ID of the FAQ to update.
   * @param payload The data to update.
   * @returns The updated FAQ.
   */
  public async updateFaq(id: string, payload: UpdateFaqPayload): Promise<Faq> {
    try {
      const faq = await prisma.faq.update({
        where: { id },
        data: payload,
      });
      return faq;
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new AppError("FAQ not found", StatusCodes.NOT_FOUND);
      }
      throw error;
    }
  }

  /**
   * Deletes an FAQ.
   * @param id The ID of the FAQ to delete.
   */
  public async deleteFaq(id: string): Promise<void> {
    try {
      await prisma.faq.delete({
        where: { id },
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new AppError("FAQ not found", StatusCodes.NOT_FOUND);
      }
      throw error;
    }
  }
}

export default new FaqService();
