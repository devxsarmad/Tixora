// Usage:
// Frontend API functions for workspace data. These functions call the Express
// backend with the logged-in user's JWT and keep endpoint paths in one place.

import { apiRequest, authHeaders } from '../../api/http.js';
import type {
  CommentSummary,
  ProjectDetail,
  ProjectMember,
  ProjectSummary,
  TeamDetail,
  TeamMember,
  TaskSummary,
  TeamSummary,
  UserSummary
} from './types.js';

export function searchUsers(token: string, queryText: string) {
  const params = new URLSearchParams();
  if (queryText.trim()) params.set('q', queryText.trim());

  return apiRequest<{ users: UserSummary[] }>(
    `/api/users${params.toString() ? `?${params.toString()}` : ''}`,
    {
      headers: authHeaders(token)
    }
  );
}

export function listTeams(token: string) {
  return apiRequest<{ teams: TeamSummary[] }>('/api/teams', {
    headers: authHeaders(token)
  });
}

export function getTeam(token: string, teamSlug: string) {
  return apiRequest<{ team: TeamDetail }>(`/api/teams/${teamSlug}`, {
    headers: authHeaders(token)
  });
}

export function createTeam(
  token: string,
  input: { name: string }
) {
  return apiRequest<{ team: TeamSummary }>('/api/teams', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input)
  });
}

export function addTeamMember(
  token: string,
  teamSlug: string,
  input: { email: string; role: 'admin' | 'member' }
) {
  return apiRequest<{ member: TeamMember }>(`/api/teams/${teamSlug}/members`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input)
  });
}

export function updateTeamMember(
  token: string,
  teamSlug: string,
  userId: string,
  role: 'admin' | 'member'
) {
  return apiRequest<{ member: TeamMember }>(
    `/api/teams/${teamSlug}/members/${userId}`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ role })
    }
  );
}

export function removeTeamMember(token: string, teamSlug: string, userId: string) {
  return apiRequest<{ member: { id: string } }>(
    `/api/teams/${teamSlug}/members/${userId}`,
    {
      method: 'DELETE',
      headers: authHeaders(token)
    }
  );
}

export function listProjects(
  token: string,
  teamSlug: string,
  options: { includeArchived?: boolean } = {}
) {
  const params = new URLSearchParams();

  if (options.includeArchived) params.set('includeArchived', 'true');

  const query = params.toString();

  return apiRequest<{ projects: ProjectSummary[] }>(
    `/api/teams/${teamSlug}/projects${query ? `?${query}` : ''}`,
    {
      headers: authHeaders(token)
    }
  );
}

export function createProject(
  token: string,
  teamSlug: string,
  input: { name: string; description?: string }
) {
  return apiRequest<{ project: ProjectSummary }>(
    `/api/teams/${teamSlug}/projects`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(input)
    }
  );
}

export function getProject(token: string, projectId: string) {
  return apiRequest<{ project: ProjectDetail }>(`/api/projects/${projectId}`, {
    headers: authHeaders(token)
  });
}

export function updateProject(
  token: string,
  projectId: string,
  input: { name?: string; description?: string | null }
) {
  return apiRequest<{ project: ProjectSummary }>(`/api/projects/${projectId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(input)
  });
}

export function archiveProject(token: string, projectId: string) {
  return apiRequest<{ project: ProjectSummary }>(
    `/api/projects/${projectId}/archive`,
    {
      method: 'POST',
      headers: authHeaders(token)
    }
  );
}

export function upsertProjectMember(
  token: string,
  projectId: string,
  input: { userId: string; role: ProjectMember['role'] }
) {
  return apiRequest<{ member: ProjectMember }>(
    `/api/projects/${projectId}/members`,
    {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(input)
    }
  );
}

export function removeProjectMember(
  token: string,
  projectId: string,
  userId: string
) {
  return apiRequest<{ member: { id: string } }>(
    `/api/projects/${projectId}/members/${userId}`,
    {
      method: 'DELETE',
      headers: authHeaders(token)
    }
  );
}

export function listTasks(
  token: string,
  projectId: string,
  filters: {
    status?: TaskSummary['status'];
    priority?: TaskSummary['priority'];
    assigneeId?: string;
    due?: 'overdue' | 'upcoming';
  } = {}
) {
  const params = new URLSearchParams();

  if (filters.status) params.set('status', filters.status);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.assigneeId) params.set('assigneeId', filters.assigneeId);
  if (filters.due) params.set('due', filters.due);

  const query = params.toString();

  return apiRequest<{ tasks: TaskSummary[] }>(
    `/api/projects/${projectId}/tasks${query ? `?${query}` : ''}`,
    {
      headers: authHeaders(token)
    }
  );
}

export function createTask(
  token: string,
  projectId: string,
  input: {
    title: string;
    description?: string;
    dueAt?: string | null;
    priority: TaskSummary['priority'];
    assigneeIds?: string[];
  }
) {
  return apiRequest<{ task: TaskSummary }>(`/api/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input)
  });
}

export function updateTask(
  token: string,
  taskId: string,
  input: Partial<
    Pick<TaskSummary, 'status' | 'priority' | 'title' | 'description' | 'dueAt'>
  >
) {
  return apiRequest<{ task: TaskSummary }>(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(input)
  });
}

export function replaceTaskAssignees(
  token: string,
  taskId: string,
  assigneeIds: string[]
) {
  return apiRequest<{ task: TaskSummary }>(`/api/tasks/${taskId}/assignees`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ assigneeIds })
  });
}

export function listComments(token: string, taskId: string) {
  return apiRequest<{ comments: CommentSummary[]; nextCursor: string | null }>(
    `/api/tasks/${taskId}/comments?limit=20`,
    {
      headers: authHeaders(token)
    }
  );
}

export function createComment(
  token: string,
  taskId: string,
  input: { body: string }
) {
  return apiRequest<{ comment: CommentSummary }>(
    `/api/tasks/${taskId}/comments`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(input)
    }
  );
}

export function updateComment(token: string, commentId: string, body: string) {
  return apiRequest<{ comment: CommentSummary }>(`/api/comments/${commentId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ body })
  });
}

export function deleteComment(token: string, commentId: string) {
  return apiRequest<{ comment: CommentSummary }>(`/api/comments/${commentId}`, {
    method: 'DELETE',
    headers: authHeaders(token)
  });
}
