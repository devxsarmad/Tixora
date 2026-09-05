import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as accountApi from './api.js';
import { organizationKeys } from '../organizations/hooks.js';

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (input: accountApi.UpdateProfileInput) => accountApi.updateProfile(input)
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: accountApi.ChangePasswordInput) => accountApi.changePassword(input)
  });
}

export function useLeaveOrganization(orgSlug: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => accountApi.leaveOrganization(orgSlug ?? ''),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationKeys.all });
      void queryClient.invalidateQueries({ queryKey: organizationKeys.detail(orgSlug) });
    }
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => accountApi.deleteAccount(),
    onSuccess: () => {
      queryClient.clear();
    }
  });
}
