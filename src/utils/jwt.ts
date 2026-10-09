import jwt from "jsonwebtoken";
import { env } from "../config";
import { AppError } from "./errorHandler";
import { StatusCodes } from "http-status-codes";

export interface JwtPayload {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
}

const secret = env.JWT_SECRET_KEY as string;

/**
 * SIGN TOKEN
 */
export const signToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, secret, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
};

/**
 * VERIFY TOKEN
 */
export const verifyToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, secret) as JwtPayload;
  } catch (error: any) {
    if (error.name === "JsonWebTokenError") {
      throw new AppError("Invalid token. Please log in again!", StatusCodes.UNAUTHORIZED);
    }

    if (error.name === "TokenExpiredError") {
      throw new AppError("Your token has expired! Please log in again.", StatusCodes.UNAUTHORIZED);
    }

    throw new AppError("Authentication failed. Please log in again.", StatusCodes.UNAUTHORIZED);
  }
};