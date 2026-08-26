// Usage:
// Project HTTP endpoints. Routes are JWT-protected and delegate team/project
// authorization to SQL-backed service functions.

import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth.js';
import type { AuthenticatedRequest } from '../../shared/authenticated-request.js';
import { asyncHandler } from '../../shared/async-handler.js';
import {
  archiveProject,
  createProject,
  getProject,
  listTeamProjects,
  removeProjectMember,
  updateProject,
  upsertProjectMember
} from './project.service.js';
import {
  createProjectSchema,
  listProjectsQuerySchema,
  projectMemberParamsSchema,
  projectIdParamSchema,
  teamSlugParamSchema,
  updateProjectSchema,
  upsertProjectMemberSchema
} from './project.schemas.js';

export const projectRouter = Router();

projectRouter.post(
  '/teams/:teamSlug/projects',
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const params = teamSlugParamSchema.parse(req.params);
    const input = createProjectSchema.parse(req.body);
    const project = await createProject({
      teamSlug: params.teamSlug,
      userId: authReq.user.id,
      input
    });

    res.status(201).json({ project });
  })
);

projectRouter.get(
  '/teams/:teamSlug/projects',
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const params = teamSlugParamSchema.parse(req.params);
    const query = listProjectsQuerySchema.parse(req.query);
    const projects = await listTeamProjects({
      teamSlug: params.teamSlug,
      userId: authReq.user.id,
      includeArchived: query.includeArchived
    });

    res.status(200).json({ projects });
  })
);

projectRouter.get(
  '/projects/:projectId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const params = projectIdParamSchema.parse(req.params);
    const project = await getProject({
      projectId: params.projectId,
      userId: authReq.user.id
    });

    res.status(200).json({ project });
  })
);

projectRouter.patch(
  '/projects/:projectId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const params = projectIdParamSchema.parse(req.params);
    const input = updateProjectSchema.parse(req.body);
    const project = await updateProject({
      projectId: params.projectId,
      userId: authReq.user.id,
      input
    });

    res.status(200).json({ project });
  })
);

projectRouter.post(
  '/projects/:projectId/archive',
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const params = projectIdParamSchema.parse(req.params);
    const project = await archiveProject({
      projectId: params.projectId,
      userId: authReq.user.id
    });

    res.status(200).json({ project });
  })
);

projectRouter.put(
  '/projects/:projectId/members',
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const params = projectIdParamSchema.parse(req.params);
    const input = upsertProjectMemberSchema.parse(req.body);
    const member = await upsertProjectMember({
      projectId: params.projectId,
      actorId: authReq.user.id,
      input
    });

    res.status(200).json({ member });
  })
);

projectRouter.delete(
  '/projects/:projectId/members/:userId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const params = projectMemberParamsSchema.parse(req.params);
    const member = await removeProjectMember({
      projectId: params.projectId,
      actorId: authReq.user.id,
      targetUserId: params.userId
    });

    res.status(200).json({ member });
  })
);
