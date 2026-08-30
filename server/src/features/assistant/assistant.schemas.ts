import { z } from 'zod';

const pendingAssistantActionSchema = z.object({
  id: z.string().trim().min(1),
  toolName: z.string().trim().min(1),
  argumentsText: z.string()
});

export const askAssistantSchema = z.object({
  query: z.string().trim().min(1).max(2000),
  projectId: z.string().uuid().optional()
});

export const confirmAssistantActionsSchema = z.object({
  pendingActions: z.array(pendingAssistantActionSchema).max(10),
  confirmedIds: z.array(z.string().trim().min(1)).max(10)
});

export type AskAssistantInput = z.infer<typeof askAssistantSchema>;
export type ConfirmAssistantActionsInput = z.infer<typeof confirmAssistantActionsSchema>;
export type PendingAssistantActionInput = z.infer<typeof pendingAssistantActionSchema>;
