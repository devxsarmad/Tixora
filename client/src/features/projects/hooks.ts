import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProjectMember } from './types.js';
import * as projectsApi from './api.js';

export const projectKeys = {
  list: (orgSlug: string | null, includeArchived: boolean) => ['projects', orgSlug, includeArchived] as const,
  detail: (projectId: string | null) => ['project', projectId] as const
};

export function useProjects(token: string, orgSlug: string | null, includeArchived = false) {
  return useQuery({ queryKey: projectKeys.list(orgSlug, includeArchived), queryFn: () => projectsApi.listProjects(token, orgSlug ?? '', { includeArchived }), enabled: Boolean(orgSlug) });
}

export function useProject(token: string, projectId: string | null) {
  return useQuery({ queryKey: projectKeys.detail(projectId), queryFn: () => projectsApi.getProject(token, projectId ?? ''), enabled: Boolean(projectId) });
}

export function useCreateProject(token: string, orgSlug: string | null, includeArchived = false) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: { name: string; description?: string }) => projectsApi.createProject(token, orgSlug ?? '', input), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: projectKeys.list(orgSlug, includeArchived) }); } });
}

export function useUpdateProject(token: string, projectId: string | null, orgSlug: string | null, includeArchived = false) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: { name?: string; description?: string | null }) => projectsApi.updateProject(token, projectId ?? '', input), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) }); void queryClient.invalidateQueries({ queryKey: projectKeys.list(orgSlug, includeArchived) }); } });
}

export function useArchiveProject(token: string, projectId: string | null, orgSlug: string | null, includeArchived = false) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: () => projectsApi.archiveProject(token, projectId ?? ''), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: projectKeys.list(orgSlug, includeArchived) }); } });
}

export function useUpsertProjectMember(token: string, projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: { userId: string; role: ProjectMember['role'] }) => projectsApi.upsertProjectMember(token, projectId ?? '', input), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) }); } });
}

export function useRemoveProjectMember(token: string, projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (userId: string) => projectsApi.removeProjectMember(token, projectId ?? '', userId), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) }); } });
}
