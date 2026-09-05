import { apiRequest } from '../../api/http.js';
import type { ProjectDetail, ProjectMember, ProjectSummary } from './types.js';

export function listProjects(orgSlug: string, options: { includeArchived?: boolean } = {}) {
  const params = new URLSearchParams();
  if (options.includeArchived) params.set('includeArchived', 'true');
  const query = params.toString();
  return apiRequest<{ projects: ProjectSummary[] }>('/api/teams/' + orgSlug + '/projects' + (query ? '?' + query : ''));
}

export function createProject(orgSlug: string, input: { name: string; description?: string }) {
  return apiRequest<{ project: ProjectSummary }>('/api/teams/' + orgSlug + '/projects', { method: 'POST', body: JSON.stringify(input) });
}

export function getProject(projectId: string) {
  return apiRequest<{ project: ProjectDetail }>('/api/projects/' + projectId);
}

export function updateProject(projectId: string, input: { name?: string; description?: string | null }) {
  return apiRequest<{ project: ProjectSummary }>('/api/projects/' + projectId, { method: 'PATCH', body: JSON.stringify(input) });
}

export function archiveProject(projectId: string) {
  return apiRequest<{ project: ProjectSummary }>('/api/projects/' + projectId + '/archive', { method: 'POST', });
}

export function upsertProjectMember(projectId: string, input: { userId: string; role: ProjectMember['role'] }) {
  return apiRequest<{ member: ProjectMember }>('/api/projects/' + projectId + '/members', { method: 'PUT', body: JSON.stringify(input) });
}

export function removeProjectMember(projectId: string, userId: string) {
  return apiRequest<{ member: { id: string } }>('/api/projects/' + projectId + '/members/' + userId, { method: 'DELETE', });
}
