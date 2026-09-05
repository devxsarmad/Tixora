// Usage:
// Frontend API functions for workspace data. These functions call the Express
// backend with the browser-managed session cookie and keep endpoint paths in one place.

import { apiRequest } from '../../api/http.js';
import type {
  CommentSummary,
  InvitationSummary,
  ProjectDetail,
  ProjectMember,
  ProjectSummary,
  TeamDetail,
  TeamMember,
  TaskSummary,
  TeamSummary,
  UserSummary
} from './types.js';

export function searchUsers(queryText: string) {
  const params = new URLSearchParams();
  if (queryText.trim()) params.set('q', queryText.trim());

  return apiRequest<{ users: UserSummary[] }>(
    `/api/users${params.toString() ? `?${params.toString()}` : ''}`,
    {
      }
  );
}

export function listTeams() {
  return apiRequest<{ teams: TeamSummary[] }>('/api/teams');
}

export function getTeam(teamSlug: string) {
  return apiRequest<{ team: TeamDetail }>(`/api/teams/${teamSlug}`);
}

export function createTeam(
  input: { name: string }
) {
  return apiRequest<{ team: TeamSummary }>('/api/teams', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function addTeamMember(
  teamSlug: string,
  input: { email: string; role: 'admin' | 'member' }
) {
  return apiRequest<{ member: TeamMember }>(`/api/teams/${teamSlug}/members`, {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function updateTeamMember(
  teamSlug: string,
  userId: string,
  role: 'admin' | 'member'
) {
  return apiRequest<{ member: TeamMember }>(
    `/api/teams/${teamSlug}/members/${userId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ role })
    }
  );
}

export function removeTeamMember(teamSlug: string, userId: string) {
  return apiRequest<{ member: { id: string } }>(
    `/api/teams/${teamSlug}/members/${userId}`,
    {
      method: 'DELETE',
      }
  );
}

export function listInvitations(teamSlug: string) {
  return apiRequest<{ invitations: InvitationSummary[] }>(
    `/api/teams/${teamSlug}/invitations`,
    {
      }
  );
}

export function createInvitation(
  teamSlug: string,
  input: { email: string; role: 'admin' | 'member' }
) {
  return apiRequest<{ invitation: InvitationSummary }>(
    `/api/teams/${teamSlug}/invitations`,
    {
      method: 'POST',
      body: JSON.stringify(input)
    }
  );
}

export function listProjects(
  teamSlug: string,
  options: { includeArchived?: boolean } = {}
) {
  const params = new URLSearchParams();

  if (options.includeArchived) params.set('includeArchived', 'true');

  const query = params.toString();

  return apiRequest<{ projects: ProjectSummary[] }>(
    `/api/teams/${teamSlug}/projects${query ? `?${query}` : ''}`,
    {
      }
  );
}

export function createProject(
  teamSlug: string,
  input: { name: string; description?: string; memberIds: string[] }
) {
  return apiRequest<{ project: ProjectSummary }>(
    `/api/teams/${teamSlug}/projects`,
    {
      method: 'POST',
      body: JSON.stringify(input)
    }
  );
}

export function getProject(projectId: string) {
  return apiRequest<{ project: ProjectDetail }>(`/api/projects/${projectId}`);
}

export function updateProject(
  projectId: string,
  input: { name?: string; description?: string | null }
) {
  return apiRequest<{ project: ProjectSummary }>(`/api/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  });
}

export function archiveProject(projectId: string) {
  return apiRequest<{ project: ProjectSummary }>(
    `/api/projects/${projectId}/archive`,
    {
      method: 'POST',
      }
  );
}

export function upsertProjectMember(
  projectId: string,
  input: { userId: string; role: ProjectMember['role'] }
) {
  return apiRequest<{ member: ProjectMember }>(
    `/api/projects/${projectId}/members`,
    {
      method: 'PUT',
      body: JSON.stringify(input)
    }
  );
}

export function removeProjectMember(
  projectId: string,
  userId: string
) {
  return apiRequest<{ member: { id: string } }>(
    `/api/projects/${projectId}/members/${userId}`,
    {
      method: 'DELETE',
      }
  );
}

export function listTasks(
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
      }
  );
}

export function createTask(
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
    body: JSON.stringify(input)
  });
}

export function updateTask(
  taskId: string,
  input: Partial<
    Pick<TaskSummary, 'status' | 'priority' | 'title' | 'description' | 'dueAt'>
  >
) {
  return apiRequest<{ task: TaskSummary }>(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  });
}

export function replaceTaskAssignees(
  taskId: string,
  assigneeIds: string[]
) {
  return apiRequest<{ task: TaskSummary }>(`/api/tasks/${taskId}/assignees`, {
    method: 'PUT',
    body: JSON.stringify({ assigneeIds })
  });
}

export function listComments(taskId: string) {
  return apiRequest<{ comments: CommentSummary[]; nextCursor: string | null }>(
    `/api/tasks/${taskId}/comments?limit=20`,
    {
      }
  );
}

export function createComment(
  taskId: string,
  input: { body: string }
) {
  return apiRequest<{ comment: CommentSummary }>(
    `/api/tasks/${taskId}/comments`,
    {
      method: 'POST',
      body: JSON.stringify(input)
    }
  );
}

export function updateComment(commentId: string, body: string) {
  return apiRequest<{ comment: CommentSummary }>(`/api/comments/${commentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ body })
  });
}

export function deleteComment(commentId: string) {
  return apiRequest<{ comment: CommentSummary }>(`/api/comments/${commentId}`, {
    method: 'DELETE'
  });
}
