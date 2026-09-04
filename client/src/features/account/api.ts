import { apiRequest, authHeaders } from '../../api/http.js';
import type { AuthUser } from '../auth/types.js';

export type UpdateProfileInput = {
  displayName?: string;
  email?: string;
};

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export function updateProfile(token: string, input: UpdateProfileInput) {
  return apiRequest<{ user: AuthUser }>('/api/me', {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(input)
  });
}

export function changePassword(token: string, input: ChangePasswordInput) {
  return apiRequest<{ changed: true }>('/api/auth/change-password', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input)
  });
}

export function leaveOrganization(token: string, orgSlug: string) {
  return apiRequest<{ organization: { slug: string } }>('/api/teams/' + orgSlug + '/leave', {
    method: 'POST',
    headers: authHeaders(token)
  });
}

export function deleteAccount(token: string) {
  return apiRequest<{ user: { id: string } }>('/api/me', {
    method: 'DELETE',
    headers: authHeaders(token)
  });
}
