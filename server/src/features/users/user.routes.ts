// Usage:
// Authenticated user directory endpoints for selecting valid organization users.

import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth.js';
import type { AuthenticatedRequest } from '../../shared/authenticated-request.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { listUsers } from './user.service.js';
import { listUsersQuerySchema } from './user.schemas.js';

export const userRouter = Router();

userRouter.use(requireAuth);

userRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const query = listUsersQuerySchema.parse(req.query);
    const users = await listUsers({
      requesterId: authReq.user.id,
      query
    });

    res.status(200).json({ users });
  })
);
