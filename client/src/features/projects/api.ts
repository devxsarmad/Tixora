import { apiRequest, authHeaders } from '../../api/http.js';
import type { ProjectDetail, ProjectMember, ProjectSummary } from './types.js';

export function listProjects(token: string, orgSlug: string, options: { includeArchived?: boolean } = {}) {
  const params = new URLSearchParams();
  if (options.includeArchived) params.set('includeArchived', 'true');
  const query = params.toString();
  return apiRequest<{ projects: ProjectSummary[] }>('/api/teams/' + orgSlug + '/projects' + (query ? '?' + query : ''), { headers: authHeaders(token) });
}

export function createProject(token: string, orgSlug: string, input: { name: string; description?: string }) {
  return apiRequest<{ project: ProjectSummary }>('/api/teams/' + orgSlug + '/projects', { method: 'POST', headers: authHeaders(token), body: JSON.stringify(input) });
}

export function getProject(token: string, projectId: string) {
  return apiRequest<{ project: ProjectDetail }>('/api/projects/' + projectId, { headers: authHeaders(token) });
}

export function updateProject(token: string, projectId: string, input: { name?: string; description?: string | null }) {
  return apiRequest<{ project: ProjectSummary }>('/api/projects/' + projectId, { method: 'PATCH', headers: authHeaders(token), body: JSON.stringify(input) });
}

export function archiveProject(token: string, projectId: string) {
  return apiRequest<{ project: ProjectSummary }>('/api/projects/' + projectId + '/archive', { method: 'POST', headers: authHeaders(token) });
}

export function upsertProjectMember(token: string, projectId: string, input: { userId: string; role: ProjectMember['role'] }) {
  return apiRequest<{ member: ProjectMember }>('/api/projects/' + projectId + '/members', { method: 'PUT', headers: authHeaders(token), body: JSON.stringify(input) });
}

export function removeProjectMember(token: string, projectId: string, userId: string) {
  return apiRequest<{ member: { id: string } }>('/api/projects/' + projectId + '/members/' + userId, { method: 'DELETE', headers: authHeaders(token) });
}
