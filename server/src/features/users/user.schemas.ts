// Usage:
// Runtime validation for user directory search queries.

import { z } from 'zod';

export const listUsersQuerySchema = z.object({
  q: z.string().trim().max(120).optional()
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
