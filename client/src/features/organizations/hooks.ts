import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as organizationsApi from './api.js';

export const organizationKeys = {
  all: ['organizations'] as const,
  detail: (orgSlug: string | null) => ['organization', orgSlug] as const,
  invitations: (orgSlug: string | null) => ['organization-invitations', orgSlug] as const,
  users: (query: string) => ['users', query] as const
};

export function useOrganizations() {
  return useQuery({ queryKey: organizationKeys.all, queryFn: () => organizationsApi.listOrganizations() });
}

export function useOrganization(orgSlug: string | null) {
  return useQuery({
    queryKey: organizationKeys.detail(orgSlug),
    queryFn: () => organizationsApi.getOrganization(orgSlug ?? ''),
    enabled: Boolean(orgSlug)
  });
}

export function useInvitations(orgSlug: string | null, enabled = true) {
  return useQuery({
    queryKey: organizationKeys.invitations(orgSlug),
    queryFn: () => organizationsApi.listInvitations(orgSlug ?? ''),
    enabled: Boolean(orgSlug) && enabled
  });
}

export function useUserSearch(query: string) {
  return useQuery({
    queryKey: organizationKeys.users(query.trim()),
    queryFn: () => organizationsApi.searchUsers(query),
    enabled: Boolean(query.trim())
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) => organizationsApi.createOrganization(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKeys.all })
  });
}

export function useAddOrganizationMember(orgSlug: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; role: 'admin' | 'member' }) => organizationsApi.addOrganizationMember(orgSlug ?? '', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationKeys.detail(orgSlug) });
      void queryClient.invalidateQueries({ queryKey: organizationKeys.all });
    }
  });
}

export function useUpdateOrganizationMember(orgSlug: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; role: 'admin' | 'member' }) => organizationsApi.updateOrganizationMember(orgSlug ?? '', input.userId, input.role),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: organizationKeys.detail(orgSlug) }); }
  });
}

export function useRemoveOrganizationMember(orgSlug: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => organizationsApi.removeOrganizationMember(orgSlug ?? '', userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationKeys.detail(orgSlug) });
      void queryClient.invalidateQueries({ queryKey: organizationKeys.all });
    }
  });
}

export function useCreateInvitation(orgSlug: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; role: 'admin' | 'member' }) => organizationsApi.createInvitation(orgSlug ?? '', input),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: organizationKeys.invitations(orgSlug) }); }
  });
}
