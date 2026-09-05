import { apiRequest } from '../../api/http.js';
import type { InvitationSummary, TeamDetail, TeamMember, TeamSummary, UserSummary } from './types.js';

export function searchUsers(queryText: string) {
  const params = new URLSearchParams();
  if (queryText.trim()) params.set('q', queryText.trim());
  const query = params.toString();
  return apiRequest<{ users: UserSummary[] }>('/api/users' + (query ? '?' + query : ''));
}

export function listOrganizations() {
  return apiRequest<{ teams: TeamSummary[] }>('/api/teams');
}

export function getOrganization(orgSlug: string) {
  return apiRequest<{ team: TeamDetail }>('/api/teams/' + orgSlug);
}

export function createOrganization(input: { name: string }) {
  return apiRequest<{ team: TeamSummary }>('/api/teams', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function addOrganizationMember(orgSlug: string, input: { email: string; role: 'admin' | 'member' }) {
  return apiRequest<{ member: TeamMember }>('/api/teams/' + orgSlug + '/members', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function updateOrganizationMember(orgSlug: string, userId: string, role: 'admin' | 'member') {
  return apiRequest<{ member: TeamMember }>('/api/teams/' + orgSlug + '/members/' + userId, {
    method: 'PATCH',
    body: JSON.stringify({ role })
  });
}

export function removeOrganizationMember(orgSlug: string, userId: string) {
  return apiRequest<{ member: { id: string } }>('/api/teams/' + orgSlug + '/members/' + userId, {
    method: 'DELETE'
  });
}

export function listInvitations(orgSlug: string) {
  return apiRequest<{ invitations: InvitationSummary[] }>('/api/teams/' + orgSlug + '/invitations');
}

export function createInvitation(orgSlug: string, input: { email: string; role: 'admin' | 'member' }) {
  return apiRequest<{ invitation: InvitationSummary }>('/api/teams/' + orgSlug + '/invitations', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}
