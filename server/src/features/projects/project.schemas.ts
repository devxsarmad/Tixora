// Usage:
// Runtime validation for project routes. These schemas keep route handlers from
// accepting unknown or malformed project input.

import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  memberIds: z.array(z.string().uuid()).min(1, 'Select at least one project member.').max(100)
    .refine((ids) => new Set(ids).size === ids.length, 'Select each member only once.')
});

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional()
  })
  .refine((value) => value.name !== undefined || value.description !== undefined, {
    message: 'At least one field must be provided'
  });

export const teamSlugParamSchema = z.object({
  teamSlug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
});

export const projectIdParamSchema = z.object({
  projectId: z.string().uuid()
});

export const listProjectsQuerySchema = z.object({
  includeArchived: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true')
});

export const upsertProjectMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['manager', 'contributor', 'viewer']).default('contributor')
});

export const projectMemberParamsSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid()
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type UpsertProjectMemberInput = z.infer<typeof upsertProjectMemberSchema>;
