// Usage:
// Runtime validation for organization invitation routes.

import { z } from 'zod';

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .min(3)
  .max(80);

export const createInvitationSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  role: z.enum(['admin', 'member']).default('member')
});

export const teamSlugParamSchema = z.object({
  teamSlug: slugSchema
});

export const invitationTokenParamSchema = z.object({
  token: z.string().trim().min(16).max(200)
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
