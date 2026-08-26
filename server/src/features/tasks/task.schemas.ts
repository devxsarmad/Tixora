// Usage:
// Runtime validation for task routes, filters, and assignment payloads.

import { z } from 'zod';

const taskStatusSchema = z.enum(['todo', 'in_progress', 'blocked', 'done']);
const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  dueAt: z.string().datetime().nullable().optional(),
  assigneeIds: z.array(z.string().uuid()).max(20).optional()
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    status: taskStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    dueAt: z.string().datetime().nullable().optional()
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.status !== undefined ||
      value.priority !== undefined ||
      value.dueAt !== undefined,
    { message: 'At least one field must be provided' }
  );

export const replaceTaskAssigneesSchema = z.object({
  assigneeIds: z.array(z.string().uuid()).max(20)
});

export const projectIdParamSchema = z.object({
  projectId: z.string().uuid()
});

export const taskIdParamSchema = z.object({
  taskId: z.string().uuid()
});

export const listTasksQuerySchema = z.object({
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assigneeId: z.string().uuid().optional(),
  due: z.enum(['overdue', 'upcoming']).optional()
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ReplaceTaskAssigneesInput = z.infer<typeof replaceTaskAssigneesSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
