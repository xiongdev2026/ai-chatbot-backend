import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';

interface ApiResponse<T> {
  status: 'success' | 'fail' | 'error';
  message?: string;
  data?: T;
  statusCode: number;
  pagination?: {
    total: number;
    limit: number;
    page: number;
    totalPages: number;
  };
}

class ApiResponseHandler {
  private res: Response;

  constructor(res: Response) {
    this.res = res;
  }

  success<T>(data: T, message = 'Operation successful', statusCode = StatusCodes.OK, pagination?: ApiResponse<T>['pagination']): Response {
    const response: ApiResponse<T> = {
      status: 'success',
      message,
      data,
      statusCode,
    };
    if (pagination) {
      response.pagination = pagination;
    }
    return this.res.status(statusCode).json(response);
  }

  error(message = 'An error occurred', statusCode = StatusCodes.INTERNAL_SERVER_ERROR): Response {
    const response: ApiResponse<any> = {
      status: 'error',
      message,
      statusCode,
    };
    return this.res.status(statusCode).json(response);
  }

  fail(message = 'Operation failed', statusCode = StatusCodes.BAD_REQUEST): Response {
    const response: ApiResponse<any> = {
      status: 'fail',
      message,
      statusCode,
    };
    return this.res.status(statusCode).json(response);
  }
}

export default ApiResponseHandler;
