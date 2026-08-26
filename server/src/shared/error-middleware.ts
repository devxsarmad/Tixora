// Usage:
// Converts thrown errors into consistent JSON responses. This keeps route
// handlers focused on business logic instead of repeated try/catch response code.

import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from './http-error.js';

export const errorMiddleware: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next
) => {
  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message
      }
    });
  }

  if (error instanceof ZodError) {
    const fields = error.flatten().fieldErrors;
    const firstFieldMessage = Object.values(fields).flat().find(Boolean);

    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: firstFieldMessage ?? 'Request body failed validation',
        fields
      }
    });
  }

  console.error(error);

  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong'
    }
  });
};
