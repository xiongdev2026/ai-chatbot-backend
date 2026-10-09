import { Request, Response, NextFunction } from "express";
import doctorService from "../services/doctor.service";
import ApiResponseHandler from "../utils/apiResponse";
import { AppError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";

/**
 * GET /doctors?departmentId=&page=&limit=
 */
export async function getDoctors(req: Request, res: Response, next: NextFunction) {
  try {
    const { departmentId, page, limit } = req.query;
    const doctors = await doctorService.getAllDoctors(
      departmentId as string,
      page ? parseInt(page as string) : undefined,
      limit ? parseInt(limit as string) : undefined
    );
    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(doctors.data, "Doctors retrieved successfully", StatusCodes.OK, {
      total: doctors.total,
      page: doctors.page,
      limit: doctors.limit,
      totalPages: doctors.totalPages,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /doctors/:id
 */
export async function getDoctorById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const doctor = await doctorService.getDoctorById(id);

    if (!doctor) {
      return next(new AppError("Doctor not found", StatusCodes.NOT_FOUND));
    }

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(doctor, "Doctor retrieved successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * POST /doctors
 */
export async function createDoctor(req: Request, res: Response, next: NextFunction) {
  try {
    const { fullName, specialty, departmentId, bio, isActive } = req.body;

    if (!fullName || !specialty || !departmentId) {
      return next(new AppError("Full name, specialty, and department are required", StatusCodes.BAD_REQUEST));
    }

    const doctor = await doctorService.createDoctor({ fullName, specialty, departmentId, bio, isActive });

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(doctor, "Doctor created successfully", StatusCodes.CREATED);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /doctors/:id
 */
export async function updateDoctor(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { fullName, specialty, departmentId, bio, isActive } = req.body;

    const updatedDoctor = await doctorService.updateDoctor(id, { fullName, specialty, departmentId, bio, isActive });

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(updatedDoctor, "Doctor updated successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /doctors/:id
 */
export async function deleteDoctor(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await doctorService.deleteDoctor(id);

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(null, "Doctor deleted successfully", StatusCodes.OK);
  } catch (error) {
    next(error);
  }
}
