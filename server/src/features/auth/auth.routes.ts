// Usage:
// Defines the HTTP auth endpoints and delegates validation/business logic to the
// schema and service layers.

import { Router } from 'express';
import { asyncHandler } from '../../shared/async-handler.js';
import { login, register } from './auth.service.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import { clearAuthCookie, setAuthCookie } from './auth.cookie.js';
import { requireAuth } from '../../middleware/require-auth.js';
import type { AuthenticatedRequest } from '../../shared/authenticated-request.js';
import { findPublicUserById } from './auth.repository.js';
import { HttpError } from '../../shared/http-error.js';

export const authRouter = Router();
authRouter.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

authRouter.get('/session', requireAuth, asyncHandler(async (req, res) => {
  const user = await findPublicUserById((req as AuthenticatedRequest).user.id);
  if (!user) throw new HttpError(401, 'Authentication required', 'AUTH_REQUIRED');
  res.json({ user });
}));

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
});

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const result = await register(input);

    setAuthCookie(res, result.accessToken);
    res.status(201).json({ user: result.user });
  })
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await login(input);

    setAuthCookie(res, result.accessToken);
    res.status(200).json({ user: result.user });
  })
);
