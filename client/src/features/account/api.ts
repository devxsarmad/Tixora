import { apiRequest } from '../../api/http.js';
import type { AuthUser } from '../auth/types.js';

export type UpdateProfileInput = {
  displayName?: string;
  email?: string;
};

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export function updateProfile(input: UpdateProfileInput) {
  return apiRequest<{ user: AuthUser }>('/api/me', {
    method: 'PATCH',
    body: JSON.stringify(input)
  });
}

export function changePassword(input: ChangePasswordInput) {
  return apiRequest<{ changed: true }>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function leaveOrganization(orgSlug: string) {
  return apiRequest<{ organization: { slug: string } }>('/api/teams/' + orgSlug + '/leave', {
    method: 'POST'
  });
}

export function deleteAccount() {
  return apiRequest<{ user: { id: string } }>('/api/me', {
    method: 'DELETE'
  });
}
