import { Request, Response, NextFunction } from "express";
import departmentService from "../services/department.service";
import ApiResponseHandler from "../utils/apiResponse";
import { AppError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";

/**
 * GET ALL Departments with pagination
 */
export async function getDepartments(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit } = req.query;
    const departments = await departmentService.getAllDepartments(
      page ? parseInt(page as string) : undefined,
      limit ? parseInt(limit as string) : undefined
    );
    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(departments.data, "Departments retrieved successfully", StatusCodes.OK, {
      total: departments.total,
      page: departments.page,
      limit: departments.limit,
      totalPages: departments.totalPages,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET Department by ID
 */
export async function getDepartmentById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const department = await departmentService.getDepartmentById(id);

    if (!department) {
      return next(new AppError("Department not found", StatusCodes.NOT_FOUND));
    }

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(department, "Department retrieved successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * CREATE Department
 */
export async function createDepartment(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, description, openingHours, location, isActive } = req.body;

    if (!name) {
      return next(new AppError("Name is required", StatusCodes.BAD_REQUEST));
    }

    const department = await departmentService.createDepartment({ name, description, openingHours, location, isActive });

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(department, "Department created successfully", StatusCodes.CREATED);
  } catch (error) {
    next(error);
  }
}

/**
 * UPDATE Department
 */
export async function updateDepartment(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { name, description, openingHours, location, isActive } = req.body;

    const updatedDepartment = await departmentService.updateDepartment(id, { name, description, openingHours, location, isActive });

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(updatedDepartment, "Department updated successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE Department
 */
export async function deleteDepartment(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await departmentService.deleteDepartment(id);

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(null, "Department deleted successfully", StatusCodes.OK);
  } catch (error) {
    next(error);
  }
}
