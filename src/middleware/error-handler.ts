import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError, BadRequestError } from '../lib/errors';

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  let appError: AppError;
  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof ZodError) {
    appError = new BadRequestError('Request validation failed', error.flatten());
  } else {
    console.error(error);
    appError = new AppError(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred');
  }

  const response: { error: { code: string; message: string; details?: unknown }; requestId: string } = {
    error: { code: appError.code, message: appError.message },
    requestId: req.requestId,
  };

  if (appError.details !== undefined) {
    response.error.details = appError.details;
  }

  res.status(appError.statusCode).json(response);
};
