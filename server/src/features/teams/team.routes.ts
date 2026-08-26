// Usage:
// Team HTTP endpoints. All routes require a verified JWT and use req.user.id
// instead of trusting user IDs from request bodies.

import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth.js';
import type { AuthenticatedRequest } from '../../shared/authenticated-request.js';
import { asyncHandler } from '../../shared/async-handler.js';
import {
  addTeamMember,
  createTeam,
  getMyTeamBySlug,
  listMyTeams,
  removeTeamMember,
  updateTeamMember
} from './team.service.js';
import {
  addTeamMemberSchema,
  createTeamSchema,
  teamMemberParamsSchema,
  teamSlugParamSchema,
  updateTeamMemberSchema
} from './team.schemas.js';

export const teamRouter = Router();

teamRouter.use(requireAuth);

teamRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const input = createTeamSchema.parse(req.body);
    const team = await createTeam(input, authReq.user.id);

    res.status(201).json({ team });
  })
);

teamRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const teams = await listMyTeams(authReq.user.id);

    res.status(200).json({ teams });
  })
);

teamRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const params = teamSlugParamSchema.parse(req.params);
    const team = await getMyTeamBySlug(params.slug, authReq.user.id);

    res.status(200).json({ team });
  })
);

teamRouter.post(
  '/:slug/members',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const params = teamSlugParamSchema.parse(req.params);
    const input = addTeamMemberSchema.parse(req.body);
    const member = await addTeamMember({
      slug: params.slug,
      actorId: authReq.user.id,
      input
    });

    res.status(201).json({ member });
  })
);

teamRouter.patch(
  '/:slug/members/:userId',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const params = teamMemberParamsSchema.parse(req.params);
    const input = updateTeamMemberSchema.parse(req.body);
    const member = await updateTeamMember({
      slug: params.slug,
      actorId: authReq.user.id,
      targetUserId: params.userId,
      input
    });

    res.status(200).json({ member });
  })
);

teamRouter.delete(
  '/:slug/members/:userId',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const params = teamMemberParamsSchema.parse(req.params);
    const member = await removeTeamMember({
      slug: params.slug,
      actorId: authReq.user.id,
      targetUserId: params.userId
    });

    res.status(200).json({ member });
  })
);
