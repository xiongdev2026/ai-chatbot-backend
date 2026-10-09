import { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { env } from "../config";
import { AppError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";

// Helmet for security headers
export const helmetMiddleware = helmet();

// CORS configuration
const allowedOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim());
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., mobile apps, curl, server-to-server)
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      allowedOrigins.includes("*")
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
});

// Rate Limiting to prevent abuse
export const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS, // 1 minute
  max: env.RATE_LIMIT_MAX_REQUESTS, // Limit each IP to 100 requests per `window` (here, per 1 minute)
  message: new AppError(
    "Too many requests from this IP, please try again after an hour!",
    StatusCodes.TOO_MANY_REQUESTS,
  ).message,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const sanitizeValue = (value: any): any => {
  if (typeof value === "string") {
    return value.replace(/<script.*?>.*?<\/script>/gi, "");
  }
  if (typeof value === "object" && value !== null) {
    for (const key in value) {
      value[key] = sanitizeValue(value[key]);
    }
  }
  return value;
};

// Input Sanitization (basic recursive example)
export const sanitizeInput = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  req.body = sanitizeValue(req.body);

  // req.query and req.params are read-only in Express 5, so sanitize in-place
  for (const key in req.query) {
    (req.query as any)[key] = sanitizeValue(req.query[key]);
  }
  for (const key in req.params) {
    (req.params as any)[key] = sanitizeValue(req.params[key]);
  }

  next();
};
