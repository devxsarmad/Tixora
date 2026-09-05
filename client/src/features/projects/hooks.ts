import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProjectMember } from './types.js';
import * as projectsApi from './api.js';

export const projectKeys = {
  list: (orgSlug: string | null, includeArchived: boolean) => ['projects', orgSlug, includeArchived] as const,
  detail: (projectId: string | null) => ['project', projectId] as const
};

export function useProjects(orgSlug: string | null, includeArchived = false) {
  return useQuery({ queryKey: projectKeys.list(orgSlug, includeArchived), queryFn: () => projectsApi.listProjects(orgSlug ?? '', { includeArchived }), enabled: Boolean(orgSlug) });
}

export function useProject(projectId: string | null) {
  return useQuery({ queryKey: projectKeys.detail(projectId), queryFn: () => projectsApi.getProject(projectId ?? ''), enabled: Boolean(projectId) });
}

export function useCreateProject(orgSlug: string | null, includeArchived = false) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: { name: string; description?: string }) => projectsApi.createProject(orgSlug ?? '', input), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: projectKeys.list(orgSlug, includeArchived) }); } });
}

export function useUpdateProject(projectId: string | null, orgSlug: string | null, includeArchived = false) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: { name?: string; description?: string | null }) => projectsApi.updateProject(projectId ?? '', input), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) }); void queryClient.invalidateQueries({ queryKey: projectKeys.list(orgSlug, includeArchived) }); } });
}

export function useArchiveProject(projectId: string | null, orgSlug: string | null, includeArchived = false) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: () => projectsApi.archiveProject(projectId ?? ''), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: projectKeys.list(orgSlug, includeArchived) }); } });
}

export function useUpsertProjectMember(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: { userId: string; role: ProjectMember['role'] }) => projectsApi.upsertProjectMember(projectId ?? '', input), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) }); } });
}

export function useRemoveProjectMember(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (userId: string) => projectsApi.removeProjectMember(projectId ?? '', userId), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) }); } });
}
