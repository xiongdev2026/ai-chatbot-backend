import { Request, Response, NextFunction } from "express";
import userService from "../services/user.service";
import ApiResponseHandler from "../utils/apiResponse";
import { AppError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";
import { Role } from "../../generated/prisma";

/* =========================
   GET USERS (?role, ?isActive, ?search, ?page, ?limit)
========================= */
export async function getUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const { role, isActive, search, page, limit } = req.query;

    const users = await userService.getAllUsers(
      role as Role,
      // Only apply the active/inactive filter when the param is actually present.
      // Otherwise `undefined === "true"` would be `false`, hiding every active user.
      isActive === undefined ? undefined : isActive === "true",
      search as string,
      page ? parseInt(page as string) : undefined,
      limit ? parseInt(limit as string) : undefined
    );

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(users.data, "Users retrieved successfully", StatusCodes.OK, {
      total: users.total,
      page: users.page,
      limit: users.limit,
      totalPages: users.totalPages,
    });
  } catch (error) {
    next(error);
  }
}

/* =========================
   GET USER BY ID
========================= */
export async function getUserById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;

    const user = await userService.findUserById(id);

    if (!user) {
      return next(new AppError("User not found", StatusCodes.NOT_FOUND));
    }

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(user, "User retrieved successfully");
  } catch (error) {
    next(error);
  }
}

/* =========================
   CREATE USER
========================= */
export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, fullName, role, isActive } = req.body;

    const user = await userService.createUser({ email, password, fullName, role, isActive });

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(user, "User created successfully", StatusCodes.CREATED);
  } catch (error) {
    next(error);
  }
}

/* =========================
   UPDATE USER
========================= */
export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { email, password, fullName, role, isActive } = req.body;

    const updatedUser = await userService.updateUser(id, { email, password, fullName, role, isActive });

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(updatedUser, "User updated successfully");
  } catch (error) {
    next(error);
  }
}

/* =========================
   DELETE USER
========================= */
export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;

    await userService.deleteUser(id);

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(null, "User deleted successfully", StatusCodes.OK);
  } catch (error) {
    next(error);
  }
}
