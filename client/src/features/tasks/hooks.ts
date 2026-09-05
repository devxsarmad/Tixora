import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TaskSummary } from './types.js';
import * as tasksApi from './api.js';
import type { TaskFilters } from './api.js';

export const taskKeys = {
  list: (projectId: string | null, filters: TaskFilters) => ['tasks', projectId, filters] as const
};

export function useTasks(projectId: string | null, filters: TaskFilters = {}) {
  return useQuery({ queryKey: taskKeys.list(projectId, filters), queryFn: () => tasksApi.listTasks(projectId ?? '', filters), enabled: Boolean(projectId) });
}

function invalidateTasks(queryClient: ReturnType<typeof useQueryClient>, projectId: string | null) {
  void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
}

export function useCreateTask(projectId: string | null, filters: TaskFilters = {}) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: { title: string; description?: string; dueAt?: string | null; priority: TaskSummary['priority']; assigneeIds: string[] }) => tasksApi.createTask(projectId ?? '', input), onSuccess: () => { invalidateTasks(queryClient, projectId); } });
}

export function useUpdateTask(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: { taskId: string; values: Partial<Pick<TaskSummary, 'status' | 'priority' | 'title' | 'description' | 'dueAt'>> & { assigneeIds?: string[] } }) => tasksApi.updateTask(input.taskId, input.values), onSuccess: () => { invalidateTasks(queryClient, projectId); } });
}

export function useReplaceTaskAssignees(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: { taskId: string; assigneeIds: string[] }) => tasksApi.replaceTaskAssignees(input.taskId, input.assigneeIds), onSuccess: () => { invalidateTasks(queryClient, projectId); } });
}
