import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errorHandler";
import logger from "../config/logger";
import { env } from "../config";
import { StatusCodes } from "http-status-codes";

const handleCastErrorDB = (err: any) => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  return new AppError(message, StatusCodes.BAD_REQUEST);
};

const handleDuplicateFieldsDB = (err: any) => {
  const value = err.errmsg.match(/(["'])(?:\\?.)*?\1/)[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, StatusCodes.BAD_REQUEST);
};

const handleValidationErrorDB = (err: any) => {
  const errors = Object.values(err.errors).map((el: any) => el.message);
  const message = `Invalid input data. ${errors.join(". ")}`;
  return new AppError(message, StatusCodes.BAD_REQUEST);
};

const handleJWTError = () =>
  new AppError("Invalid token. Please log in again!", StatusCodes.UNAUTHORIZED);

const handleJWTExpiredError = () =>
  new AppError(
    "Your token has expired! Please log in again.",
    StatusCodes.UNAUTHORIZED,
  );

import fs from 'fs';
import path from 'path';

const sendErrorDev = (err: AppError, res: Response) => {
  logger.error(err);
  try {
    fs.appendFileSync(path.join(process.cwd(), 'error.log'), new Date().toISOString() + ': ' + (err.stack || err.message) + '\n');
  } catch(e) {}
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err: AppError, res: Response) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error("ERROR 💥", err);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Something went very wrong!",
    });
  }
};

export const errorMiddleware = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let error: any = { ...err };
  error.name = err.name; // Copy non-enumerable name property

  error.statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  error.status = err.status || "error";
  error.message = err.message;

  if (env.NODE_ENV === "production") {
    if (error.name === "CastError") error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === "ValidationError")
      error = handleValidationErrorDB(error);
    if (error.name === "JsonWebTokenError") error = handleJWTError();
    if (error.name === "TokenExpiredError") error = handleJWTExpiredError();

    return sendErrorProd(error, res);
  }

  // Default to dev error (shows full stack trace)
  return sendErrorDev(error, res);
};
