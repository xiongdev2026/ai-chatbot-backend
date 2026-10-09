import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { AppError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../database/prisma";

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // 1) Get token from header
    let token: string | undefined;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.auth) {
      token = req.cookies.auth;
    }

    if (!token) {
      return next(
        new AppError(
          "You are not logged in! Please log in to get access.",
          StatusCodes.UNAUTHORIZED,
        ),
      );
    }

    // 2) Verify token
    const decoded = verifyToken(token);

    // 3) Check if user still exists
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!currentUser) {
      return next(
        new AppError(
          "The user belonging to this token no longer exists.",
          StatusCodes.UNAUTHORIZED,
        ),
      );
    }

    // 4) Grant access to protected route
    req.user = decoded; // Attach decoded user payload to request
    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let token: string | undefined;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.auth) {
      token = req.cookies.auth;
    }

    if (!token) {
      return next();
    }

    try {
      const decoded = verifyToken(token);
      const currentUser = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (currentUser) {
        req.user = decoded;
      }
    } catch (err) {
      // Ignore token errors for optional auth
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const restrictTo = (...roles: Array<"USER" | "ADMIN">) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // roles is an array like ['admin', 'user']
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError(
          "You do not have permission to perform this action",
          StatusCodes.FORBIDDEN,
        ),
      );
    }
    next();
  };
};
