import { Request, Response, NextFunction } from "express";
import medicalServiceService from "../services/medicalService.service";
import ApiResponseHandler from "../utils/apiResponse";
import { AppError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";

/**
 * GET /medical-services?departmentId=&page=&limit=
 */
export async function getMedicalServices(req: Request, res: Response, next: NextFunction) {
  try {
    const { departmentId, page, limit } = req.query;
    const services = await medicalServiceService.getAllMedicalServices(
      departmentId as string,
      page ? parseInt(page as string) : undefined,
      limit ? parseInt(limit as string) : undefined
    );
    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(services.data, "Medical services retrieved successfully", StatusCodes.OK, {
      total: services.total,
      page: services.page,
      limit: services.limit,
      totalPages: services.totalPages,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /medical-services/:id
 */
export async function getMedicalServiceById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const service = await medicalServiceService.getMedicalServiceById(id);

    if (!service) {
      return next(new AppError("Medical service not found", StatusCodes.NOT_FOUND));
    }

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(service, "Medical service retrieved successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * POST /medical-services
 */
export async function createMedicalService(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, description, departmentId, isActive } = req.body;

    if (!name || !departmentId) {
      return next(new AppError("Name and department are required", StatusCodes.BAD_REQUEST));
    }

    const service = await medicalServiceService.createMedicalService({ name, description, departmentId, isActive });

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(service, "Medical service created successfully", StatusCodes.CREATED);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /medical-services/:id
 */
export async function updateMedicalService(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { name, description, departmentId, isActive } = req.body;

    const updatedService = await medicalServiceService.updateMedicalService(id, { name, description, departmentId, isActive });

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(updatedService, "Medical service updated successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /medical-services/:id
 */
export async function deleteMedicalService(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await medicalServiceService.deleteMedicalService(id);

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(null, "Medical service deleted successfully", StatusCodes.OK);
  } catch (error) {
    next(error);
  }
}
