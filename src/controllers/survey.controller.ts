import { Request, Response, NextFunction } from "express";
import surveyService from "../services/survey.service";
import ApiResponseHandler from "../utils/apiResponse";
import { StatusCodes } from "http-status-codes";

export async function submitSurvey(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    const {
      sessionId,
      q1Overall,
      q2EaseOfUse,
      q3Speed,
      q4Accuracy,
      q5Understanding,
      q6Clarity,
      q7Helpfulness,
      q8Utility,
      q9ReuseIntent,
      q10Nps,
      likedMost,
      improvement,
    } = req.body;

    const result = await surveyService.createSurvey({
      sessionId,
      userId,
      q1Overall,
      q2EaseOfUse,
      q3Speed,
      q4Accuracy,
      q5Understanding,
      q6Clarity,
      q7Helpfulness,
      q8Utility,
      q9ReuseIntent,
      q10Nps,
      likedMost,
      improvement,
    });

    return new ApiResponseHandler(res).success(
      result,
      "Thank you for submitting your feedback!",
      StatusCodes.CREATED
    );
  } catch (error) {
    next(error);
  }
}

export async function getSurveys(req: Request, res: Response, next: NextFunction) {
  try {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const surveys = await surveyService.getSurveys(page, limit, startDate, endDate);

    return new ApiResponseHandler(res).success(
      surveys.data,
      "Surveys retrieved successfully",
      StatusCodes.OK,
      {
        total: surveys.total,
        page: surveys.page,
        limit: surveys.limit,
        totalPages: surveys.totalPages,
      }
    );
  } catch (error) {
    next(error);
  }
}

export async function getSurveyStats(req: Request, res: Response, next: NextFunction) {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const stats = await surveyService.getSurveyStats(startDate, endDate);
    return new ApiResponseHandler(res).success(
      stats,
      "Survey statistics retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    next(error);
  }
}
