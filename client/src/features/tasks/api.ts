import { apiRequest, authHeaders } from '../../api/http.js';
import type { TaskSummary } from './types.js';

export type TaskFilters = {
  status?: TaskSummary['status'];
  priority?: TaskSummary['priority'];
  assigneeId?: string;
  due?: 'overdue' | 'upcoming';
};

export function listTasks(token: string, projectId: string, filters: TaskFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.assigneeId) params.set('assigneeId', filters.assigneeId);
  if (filters.due) params.set('due', filters.due);
  const query = params.toString();
  return apiRequest<{ tasks: TaskSummary[] }>('/api/projects/' + projectId + '/tasks' + (query ? '?' + query : ''), { headers: authHeaders(token) });
}

export function createTask(token: string, projectId: string, input: { title: string; description?: string; dueAt?: string | null; priority: TaskSummary['priority']; assigneeIds: string[] }) {
  return apiRequest<{ task: TaskSummary }>('/api/projects/' + projectId + '/tasks', { method: 'POST', headers: authHeaders(token), body: JSON.stringify(input) });
}

export function updateTask(token: string, taskId: string, input: Partial<Pick<TaskSummary, 'status' | 'priority' | 'title' | 'description' | 'dueAt'>> & { assigneeIds?: string[] }) {
  return apiRequest<{ task: TaskSummary }>('/api/tasks/' + taskId, { method: 'PATCH', headers: authHeaders(token), body: JSON.stringify(input) });
}

export function replaceTaskAssignees(token: string, taskId: string, assigneeIds: string[]) {
  return apiRequest<{ task: TaskSummary }>('/api/tasks/' + taskId + '/assignees', { method: 'PUT', headers: authHeaders(token), body: JSON.stringify({ assigneeIds }) });
}
