import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as accountApi from './api.js';
import { organizationKeys } from '../organizations/hooks.js';

export function useUpdateProfile(token: string) {
  return useMutation({
    mutationFn: (input: accountApi.UpdateProfileInput) => accountApi.updateProfile(token, input)
  });
}

export function useChangePassword(token: string) {
  return useMutation({
    mutationFn: (input: accountApi.ChangePasswordInput) => accountApi.changePassword(token, input)
  });
}

export function useLeaveOrganization(token: string, orgSlug: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => accountApi.leaveOrganization(token, orgSlug ?? ''),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationKeys.all });
      void queryClient.invalidateQueries({ queryKey: organizationKeys.detail(orgSlug) });
    }
  });
}

export function useDeleteAccount(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => accountApi.deleteAccount(token),
    onSuccess: () => {
      queryClient.clear();
    }
  });
}
