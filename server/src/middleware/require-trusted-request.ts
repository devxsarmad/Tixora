import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../shared/http-error.js';

// A custom header prevents cross-site form submissions. Exact-origin checks
// and credentialed CORS prevent untrusted sites from issuing API mutations.
export const requireTrustedRequest: RequestHandler = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.header('origin');
  if (req.header('x-tixora-request') !== '1' || (origin !== undefined && origin !== env.CORS_ORIGIN)) {
    return next(new HttpError(403, 'Untrusted request origin', 'CSRF_REJECTED'));
  }
  next();
};
