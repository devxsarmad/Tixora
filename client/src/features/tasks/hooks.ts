import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TaskSummary } from './types.js';
import * as tasksApi from './api.js';
import type { TaskFilters } from './api.js';

export const taskKeys = {
  list: (projectId: string | null, filters: TaskFilters) => ['tasks', projectId, filters] as const
};

export function useTasks(token: string, projectId: string | null, filters: TaskFilters = {}) {
  return useQuery({ queryKey: taskKeys.list(projectId, filters), queryFn: () => tasksApi.listTasks(token, projectId ?? '', filters), enabled: Boolean(projectId) });
}

function invalidateTasks(queryClient: ReturnType<typeof useQueryClient>, projectId: string | null) {
  void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
}

export function useCreateTask(token: string, projectId: string | null, filters: TaskFilters = {}) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: { title: string; description?: string; dueAt?: string | null; priority: TaskSummary['priority']; assigneeIds?: string[] }) => tasksApi.createTask(token, projectId ?? '', input), onSuccess: () => { invalidateTasks(queryClient, projectId); } });
}

export function useUpdateTask(token: string, projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: { taskId: string; values: Partial<Pick<TaskSummary, 'status' | 'priority' | 'title' | 'description' | 'dueAt'>> }) => tasksApi.updateTask(token, input.taskId, input.values), onSuccess: () => { invalidateTasks(queryClient, projectId); } });
}

export function useReplaceTaskAssignees(token: string, projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: { taskId: string; assigneeIds: string[] }) => tasksApi.replaceTaskAssignees(token, input.taskId, input.assigneeIds), onSuccess: () => { invalidateTasks(queryClient, projectId); } });
}
