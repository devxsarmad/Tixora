// Usage:
// Client-side validation schemas for workspace forms. These match the backend
// limits so invalid project/task/comment data is stopped before submission.

import { z } from 'zod';

export const teamFormSchema = z.object({
  name: z.string().trim().min(1, 'Organization name is required.').max(100)
});

export const projectFormSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required.').max(120),
  description: z.string().trim().max(2000).optional(),
  memberIds: z.array(z.string().uuid()).min(1, 'Select at least one project member.').max(100)
});

export const projectEditFormSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required.').max(120),
  description: z.string().trim().max(2000).optional()
});

export const taskFormSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required.').max(160),
  description: z.string().trim().max(4000).optional(),
  dueAt: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  assigneeIds: z.array(z.string().uuid()).min(1, 'Assign at least one project member.').max(20)
});

export const taskEditFormSchema = taskFormSchema;

export const commentFormSchema = z.object({
  body: z.string().trim().min(1, 'Comment is required.').max(4000)
});

export type TeamFormValues = z.infer<typeof teamFormSchema>;
export type ProjectFormValues = z.infer<typeof projectFormSchema>;
export type ProjectEditFormValues = z.infer<typeof projectEditFormSchema>;
export type TaskFormValues = z.infer<typeof taskFormSchema>;
export type TaskEditFormValues = z.infer<typeof taskEditFormSchema>;
export type CommentFormValues = z.infer<typeof commentFormSchema>;
