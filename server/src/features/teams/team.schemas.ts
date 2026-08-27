// Usage:
// Runtime validation for team routes. Slugs are normalized before they reach SQL
// so the database receives predictable values.

import { z } from 'zod';

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug can only contain lowercase letters, numbers, and hyphens'
  })
  .min(3)
  .max(80);

export const createTeamSchema = z.object({
  name: z
    .string({
      required_error: 'Organization name is required',
      invalid_type_error: 'Organization name must be text'
    })
    .trim()
    .min(1, 'Organization name is required')
    .max(100, 'Organization name must be 100 characters or less'),
  slug: z.preprocess(
    (value) => (value === '' ? undefined : value),
    slugSchema.optional()
  )
});

export const teamSlugParamSchema = z.object({
  slug: slugSchema
});

export const addTeamMemberSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  role: z.enum(['admin', 'member']).default('member')
});

export const updateTeamMemberSchema = z.object({
  role: z.enum(['admin', 'member'])
});

export const teamMemberParamsSchema = z.object({
  slug: slugSchema,
  userId: z.string().uuid()
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;
