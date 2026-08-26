// Usage:
// Defines runtime validation for auth request bodies. TypeScript checks compile
// time shapes, but Zod checks real JSON sent by clients.

import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(80)
});

export const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1)
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
