import { apiRequest, authHeaders } from '../../api/http.js';
import type { InvitationSummary, TeamDetail, TeamMember, TeamSummary, UserSummary } from './types.js';

export function searchUsers(token: string, queryText: string) {
  const params = new URLSearchParams();
  if (queryText.trim()) params.set('q', queryText.trim());
  const query = params.toString();
  return apiRequest<{ users: UserSummary[] }>('/api/users' + (query ? '?' + query : ''), {
    headers: authHeaders(token)
  });
}

export function listOrganizations(token: string) {
  return apiRequest<{ teams: TeamSummary[] }>('/api/teams', { headers: authHeaders(token) });
}

export function getOrganization(token: string, orgSlug: string) {
  return apiRequest<{ team: TeamDetail }>('/api/teams/' + orgSlug, { headers: authHeaders(token) });
}

export function createOrganization(token: string, input: { name: string }) {
  return apiRequest<{ team: TeamSummary }>('/api/teams', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input)
  });
}

export function addOrganizationMember(token: string, orgSlug: string, input: { email: string; role: 'admin' | 'member' }) {
  return apiRequest<{ member: TeamMember }>('/api/teams/' + orgSlug + '/members', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input)
  });
}

export function updateOrganizationMember(token: string, orgSlug: string, userId: string, role: 'admin' | 'member') {
  return apiRequest<{ member: TeamMember }>('/api/teams/' + orgSlug + '/members/' + userId, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ role })
  });
}

export function removeOrganizationMember(token: string, orgSlug: string, userId: string) {
  return apiRequest<{ member: { id: string } }>('/api/teams/' + orgSlug + '/members/' + userId, {
    method: 'DELETE',
    headers: authHeaders(token)
  });
}

export function listInvitations(token: string, orgSlug: string) {
  return apiRequest<{ invitations: InvitationSummary[] }>('/api/teams/' + orgSlug + '/invitations', { headers: authHeaders(token) });
}

export function createInvitation(token: string, orgSlug: string, input: { email: string; role: 'admin' | 'member' }) {
  return apiRequest<{ invitation: InvitationSummary }>('/api/teams/' + orgSlug + '/invitations', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input)
  });
}
