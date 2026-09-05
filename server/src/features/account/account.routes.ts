// Usage:
// Authenticated account endpoints. These routes use req.user.id and never trust
// a user ID sent by the client.

import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth.js';
import type { AuthenticatedRequest } from '../../shared/authenticated-request.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { changePassword, deleteMe, leaveOrganization, updateMe } from './account.service.js';
import { changePasswordSchema, updateMeSchema } from './account.schemas.js';
import { teamSlugParamSchema } from '../teams/team.schemas.js';
import { clearAuthCookie } from '../auth/auth.cookie.js';

export const accountRouter = Router();

accountRouter.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const input = updateMeSchema.parse(req.body);
    const user = await updateMe(authReq.user.id, input);

    res.status(200).json({ user });
  })
);

accountRouter.post(
  '/auth/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const input = changePasswordSchema.parse(req.body);
    const result = await changePassword(authReq.user.id, input);

    res.status(200).json(result);
  })
);

accountRouter.post(
  '/teams/:slug/leave',
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const params = teamSlugParamSchema.parse(req.params);
    const organization = await leaveOrganization({ slug: params.slug, userId: authReq.user.id });

    res.status(200).json({ organization });
  })
);

accountRouter.delete(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const user = await deleteMe(authReq.user.id);
    clearAuthCookie(res);
    res.status(200).json({ user });
  })
);
