import { Request, Response, NextFunction } from "express";
import authService from "../services/auth.service";
import ApiResponseHandler from "../utils/apiResponse";
import { AppError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../database/prisma"; // Assuming prisma client is exported as default


/**
 * REGISTER
 */
export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { email, password, fullName } = req.body;
    const { user, token } = await authService.register({
      email,
      password,
      fullName,
    });

    // Set JWT cookie
    res.cookie("auth", token, {
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(
      user,
      "User registered successfully",
      StatusCodes.CREATED,
    );
  } catch (error) {
    next(error);
  }
}

/**
 * LOGIN
 */
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const { user, token } = await authService.login({ email, password });

    // Set JWT cookie
    res.cookie("auth", token, {
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(user, "Login successful");
  } catch (error) {
    next(error);
  }
}

/**
 * LOGOUT
 */
export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    res.cookie("auth", "loggedout", {
      expires: new Date(Date.now() + 10 * 1000), // Expires in 10 seconds
      httpOnly: true,
    });

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(null, "Logged out successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * GET CURRENT USER (ME)
 */
export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return next(
        new AppError("User not found in request.", StatusCodes.UNAUTHORIZED),
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return next(
        new AppError("User no longer exists.", StatusCodes.NOT_FOUND),
      );
    }

    if (!user.isActive) {
      res.cookie("auth", "loggedout", {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true,
      });
      return next(new AppError("Account deactivated.", StatusCodes.FORBIDDEN));
    }

    const apiResponse = new ApiResponseHandler(res);
    return apiResponse.success(user, "User data fetched successfully");
  } catch (error) {
    next(error);
  }
}
