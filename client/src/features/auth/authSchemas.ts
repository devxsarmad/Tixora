// Usage:
// Client-side auth validation schemas. They mirror the backend rules closely so
// users get fast form feedback before the API request is sent.

import { z } from 'zod';

export const loginFormSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.')
});

export const registerFormSchema = z.object({
  displayName: z.string().trim().min(1, 'Display name is required.').max(80),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128)
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
export type RegisterFormValues = z.infer<typeof registerFormSchema>;
