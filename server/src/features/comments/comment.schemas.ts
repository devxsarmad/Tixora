// Usage:
// Runtime validation for comment routes and cursor pagination query params.

import { z } from 'zod';

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(4000)
});

export const updateCommentSchema = z.object({
  body: z.string().trim().min(1).max(4000)
});

export const taskIdParamSchema = z.object({
  taskId: z.string().uuid()
});

export const commentIdParamSchema = z.object({
  commentId: z.string().uuid()
});

export const listCommentsQuerySchema = z.object({
  after: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;
