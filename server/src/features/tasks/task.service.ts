// Usage:
// Task business rules: convert repository outcomes into stable HTTP errors and
// normalize assignment input before SQL sees it.

import { HttpError } from '../../shared/http-error.js';
import {
  createTaskForProject,
  findTaskDetailForUser,
  listTasksForProject,
  replaceTaskAssigneesForUser,
  updateTaskForUser
} from './task.repository.js';
import type {
  CreateTaskInput,
  ListTasksQuery,
  ReplaceTaskAssigneesInput,
  UpdateTaskInput
} from './task.schemas.js';

function uniqueIds(ids: string[] | undefined): string[] {
  return [...new Set(ids ?? [])];
}

function isInvalidAssigneeResult(
  result: unknown
): result is { invalidAssigneeIds: string[] } {
  return (
    typeof result === 'object' &&
    result !== null &&
    'invalidAssigneeIds' in result
  );
}

function handleTaskWriteResult<T>(
  result: T | null | 'forbidden' | { invalidAssigneeIds: string[] }
): T {
  if (result === 'forbidden') {
    throw new HttpError(403, 'Task permission denied', 'TASK_FORBIDDEN');
  }

  if (!result) {
    throw new HttpError(404, 'Task not found', 'TASK_NOT_FOUND');
  }

  if (isInvalidAssigneeResult(result)) {
    throw new HttpError(
      400,
      'All assignees must be project members',
      'INVALID_TASK_ASSIGNEES'
    );
  }

  return result;
}

export async function createTask(params: {
  projectId: string;
  userId: string;
  input: CreateTaskInput;
}) {
  const result = await createTaskForProject({
    projectId: params.projectId,
    userId: params.userId,
    title: params.input.title,
    description: params.input.description,
    status: params.input.status,
    priority: params.input.priority,
    dueAt: params.input.dueAt,
    assigneeIds: uniqueIds(params.input.assigneeIds)
  });

  if (!result) {
    throw new HttpError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }

  return handleTaskWriteResult(result);
}

export async function listProjectTasks(params: {
  projectId: string;
  userId: string;
  query: ListTasksQuery;
}) {
  const tasks = await listTasksForProject({
    projectId: params.projectId,
    userId: params.userId,
    status: params.query.status,
    priority: params.query.priority,
    assigneeId: params.query.assigneeId,
    due: params.query.due
  });

  if (!tasks) {
    throw new HttpError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }

  return tasks;
}

export async function getTask(params: { taskId: string; userId: string }) {
  const task = await findTaskDetailForUser(params);

  if (!task) {
    throw new HttpError(404, 'Task not found', 'TASK_NOT_FOUND');
  }

  return task;
}

export async function updateTask(params: {
  taskId: string;
  userId: string;
  input: UpdateTaskInput;
}) {
  const result = await updateTaskForUser({
    taskId: params.taskId,
    userId: params.userId,
    title: params.input.title,
    description: params.input.description,
    status: params.input.status,
    priority: params.input.priority,
    dueAt: params.input.dueAt
  });

  return handleTaskWriteResult(result);
}

export async function replaceTaskAssignees(params: {
  taskId: string;
  userId: string;
  input: ReplaceTaskAssigneesInput;
}) {
  const result = await replaceTaskAssigneesForUser({
    taskId: params.taskId,
    userId: params.userId,
    assigneeIds: uniqueIds(params.input.assigneeIds)
  });

  return handleTaskWriteResult(result);
}
