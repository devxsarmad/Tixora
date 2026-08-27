// Usage:
// HTTP endpoints for pending organization invitations.

import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth.js';
import type { AuthenticatedRequest } from '../../shared/authenticated-request.js';
import { asyncHandler } from '../../shared/async-handler.js';
import {
  acceptInvitation,
  createInvitation,
  listTeamInvitations
} from './invitation.service.js';
import {
  createInvitationSchema,
  invitationTokenParamSchema,
  teamSlugParamSchema
} from './invitation.schemas.js';

export const invitationRouter = Router();

invitationRouter.use(requireAuth);

invitationRouter.get(
  '/teams/:teamSlug/invitations',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const params = teamSlugParamSchema.parse(req.params);
    const invitations = await listTeamInvitations({
      teamSlug: params.teamSlug,
      actorId: authReq.user.id
    });

    res.status(200).json({ invitations });
  })
);

invitationRouter.post(
  '/teams/:teamSlug/invitations',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const params = teamSlugParamSchema.parse(req.params);
    const input = createInvitationSchema.parse(req.body);
    const invitation = await createInvitation({
      teamSlug: params.teamSlug,
      actorId: authReq.user.id,
      input
    });

    res.status(201).json({ invitation });
  })
);

invitationRouter.post(
  '/invitations/:token/accept',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const params = invitationTokenParamSchema.parse(req.params);
    const invitation = await acceptInvitation({
      token: params.token,
      userId: authReq.user.id
    });

    res.status(200).json({ invitation });
  })
);
