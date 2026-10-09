import { Request, Response, NextFunction } from "express";
import serviceService from "../services/service.service";
import ApiResponseHandler from "../utils/apiResponse";
import { AppError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";

/* =========================
   GET SERVICES (?category, ?isActive, ?page, ?limit)
========================= */
export async function getServices(req: Request, res: Response, next: NextFunction) {
  try {
    const { category, isActive, page, limit } = req.query;
    const services = await serviceService.getAllServices(
      category as string,
      // Only filter when the param is present; otherwise `undefined === 'true'`
      // is `false`, which would hide every active service.
      isActive === undefined ? undefined : isActive === 'true',
      page ? parseInt(page as string) : undefined,
      limit ? parseInt(limit as string) : undefined
    );
    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(services.data, "Services retrieved successfully", StatusCodes.OK, {
      total: services.total,
      page: services.page,
      limit: services.limit,
      totalPages: services.totalPages,
    });
  } catch (error) {
    next(error);
  }
}

/* =========================
   GET SERVICE BY ID
========================= */
export async function getServiceById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const service = await serviceService.getServiceById(id);

    if (!service) {
      return next(new AppError("Service not found", StatusCodes.NOT_FOUND));
    }

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(service, "Service retrieved successfully");
  } catch (error) {
    next(error);
  }
}

/* =========================
   CREATE SERVICE
========================= */
export async function createService(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, shortDescription, fullDescription, category, isActive, createdBy } = req.body;

    if (!name) {
      return next(new AppError("Name is required", StatusCodes.BAD_REQUEST));
    }

    const service = await serviceService.createService({ name, shortDescription, fullDescription, category, isActive, createdBy });

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(service, "Service created successfully", StatusCodes.CREATED);
  } catch (error) {
    next(error);
  }
}

/* =========================
   UPDATE SERVICE
========================= */
export async function updateService(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { name, shortDescription, fullDescription, category, isActive } = req.body;

    const updatedService = await serviceService.updateService(id, { name, shortDescription, fullDescription, category, isActive });

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(updatedService, "Service updated successfully");
  } catch (error) {
    next(error);
  }
}

/* =========================
   DELETE SERVICE
========================= */
export async function deleteService(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await serviceService.deleteService(id);

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(null, "Service deleted successfully", StatusCodes.OK);
  } catch (error) {
    next(error);
  }
}
