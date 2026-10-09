import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodObject } from 'zod';
import { AppError } from '../utils/errorHandler';
import { StatusCodes } from 'http-status-codes';

export const validate = (schema: ZodObject) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error: any) {
      if (error instanceof ZodError) {
        const errorMessages = error.issues.map((issue: any) => (
          `${issue.path.join('.')}: ${issue.message}`
        ));
        return next(new AppError(`Validation failed: ${errorMessages.join(', ')}`, StatusCodes.BAD_REQUEST));
      }
      next(error);
    }
  };
