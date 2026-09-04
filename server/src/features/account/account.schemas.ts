// Usage:
// Runtime validation for authenticated account/profile actions.

import { z } from 'zod';

export const updateMeSchema = z.object({
  displayName: z.string().trim().min(1, 'Full name is required').max(80).optional(),
  email: z.string().trim().email('Enter a valid email address').transform((value) => value.toLowerCase()).optional()
}).refine((value) => value.displayName !== undefined || value.email !== undefined, {
  message: 'Provide a full name or email to update'
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128, 'New password is too long')
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
