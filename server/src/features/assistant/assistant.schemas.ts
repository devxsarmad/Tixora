import { z } from 'zod';

export const askAssistantSchema = z.object({
  query: z.string().trim().min(1).max(2000),
  projectId: z.string().uuid().optional()
});

export type AskAssistantInput = z.infer<typeof askAssistantSchema>;
