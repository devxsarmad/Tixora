// Usage:
// Comment HTTP endpoints. Routes require JWT auth and use SQL-backed access
// checks through task/project/team membership.

import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth.js';
import type { AuthenticatedRequest } from '../../shared/authenticated-request.js';
import { asyncHandler } from '../../shared/async-handler.js';
import {
  createComment,
  deleteComment,
  listTaskComments,
  updateComment
} from './comment.service.js';
import {
  commentIdParamSchema,
  createCommentSchema,
  listCommentsQuerySchema,
  taskIdParamSchema,
  updateCommentSchema
} from './comment.schemas.js';

export const commentRouter = Router();

commentRouter.post(
  '/tasks/:taskId/comments',
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const params = taskIdParamSchema.parse(req.params);
    const input = createCommentSchema.parse(req.body);
    const comment = await createComment({
      taskId: params.taskId,
      userId: authReq.user.id,
      input
    });

    res.status(201).json({ comment });
  })
);

commentRouter.get(
  '/tasks/:taskId/comments',
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const params = taskIdParamSchema.parse(req.params);
    const query = listCommentsQuerySchema.parse(req.query);
    const page = await listTaskComments({
      taskId: params.taskId,
      userId: authReq.user.id,
      query
    });

    res.status(200).json(page);
  })
);

commentRouter.patch(
  '/comments/:commentId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const params = commentIdParamSchema.parse(req.params);
    const input = updateCommentSchema.parse(req.body);
    const comment = await updateComment({
      commentId: params.commentId,
      userId: authReq.user.id,
      input
    });

    res.status(200).json({ comment });
  })
);

commentRouter.delete(
  '/comments/:commentId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const params = commentIdParamSchema.parse(req.params);
    const comment = await deleteComment({
      commentId: params.commentId,
      userId: authReq.user.id
    });

    res.status(200).json({ comment });
  })
);
