import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as organizationsApi from './api.js';

export const organizationKeys = {
  all: ['organizations'] as const,
  detail: (orgSlug: string | null) => ['organization', orgSlug] as const,
  invitations: (orgSlug: string | null) => ['organization-invitations', orgSlug] as const,
  users: (query: string) => ['users', query] as const
};

export function useOrganizations(token: string) {
  return useQuery({ queryKey: organizationKeys.all, queryFn: () => organizationsApi.listOrganizations(token) });
}

export function useOrganization(token: string, orgSlug: string | null) {
  return useQuery({
    queryKey: organizationKeys.detail(orgSlug),
    queryFn: () => organizationsApi.getOrganization(token, orgSlug ?? ''),
    enabled: Boolean(orgSlug)
  });
}

export function useInvitations(token: string, orgSlug: string | null, enabled = true) {
  return useQuery({
    queryKey: organizationKeys.invitations(orgSlug),
    queryFn: () => organizationsApi.listInvitations(token, orgSlug ?? ''),
    enabled: Boolean(orgSlug) && enabled
  });
}

export function useUserSearch(token: string, query: string) {
  return useQuery({
    queryKey: organizationKeys.users(query.trim()),
    queryFn: () => organizationsApi.searchUsers(token, query),
    enabled: Boolean(query.trim())
  });
}

export function useCreateOrganization(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) => organizationsApi.createOrganization(token, input),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: organizationKeys.all }); }
  });
}

export function useAddOrganizationMember(token: string, orgSlug: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; role: 'admin' | 'member' }) => organizationsApi.addOrganizationMember(token, orgSlug ?? '', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationKeys.detail(orgSlug) });
      void queryClient.invalidateQueries({ queryKey: organizationKeys.all });
    }
  });
}

export function useUpdateOrganizationMember(token: string, orgSlug: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; role: 'admin' | 'member' }) => organizationsApi.updateOrganizationMember(token, orgSlug ?? '', input.userId, input.role),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: organizationKeys.detail(orgSlug) }); }
  });
}

export function useRemoveOrganizationMember(token: string, orgSlug: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => organizationsApi.removeOrganizationMember(token, orgSlug ?? '', userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationKeys.detail(orgSlug) });
      void queryClient.invalidateQueries({ queryKey: organizationKeys.all });
    }
  });
}

export function useCreateInvitation(token: string, orgSlug: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; role: 'admin' | 'member' }) => organizationsApi.createInvitation(token, orgSlug ?? '', input),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: organizationKeys.invitations(orgSlug) }); }
  });
}
