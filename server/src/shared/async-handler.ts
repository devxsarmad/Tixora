// Usage:
// Wraps async Express handlers so thrown errors go to errorMiddleware.

import type { NextFunction, Request, RequestHandler, Response } from 'express';

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}
