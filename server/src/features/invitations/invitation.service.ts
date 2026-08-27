// Usage:
// Invitation business rules and stable HTTP errors.

import { HttpError } from '../../shared/http-error.js';
import {
  acceptInvitationByToken,
  createInvitationForTeam,
  listInvitationsForTeam
} from './invitation.repository.js';
import type { CreateInvitationInput } from './invitation.schemas.js';

function handleInvitationResult<T>(
  result:
    | T
    | null
    | 'forbidden'
    | 'already_member'
    | 'already_invited'
    | 'expired'
): T {
  if (result === 'forbidden') {
    throw new HttpError(403, 'Invitation permission denied', 'INVITATION_FORBIDDEN');
  }

  if (result === 'already_member') {
    throw new HttpError(409, 'User is already in this organization', 'ALREADY_ORG_MEMBER');
  }

  if (result === 'already_invited') {
    throw new HttpError(409, 'This email has already been invited', 'ALREADY_INVITED');
  }

  if (result === 'expired') {
    throw new HttpError(410, 'Invitation is expired', 'INVITATION_EXPIRED');
  }

  if (!result) {
    throw new HttpError(404, 'Invitation or organization not found', 'INVITATION_NOT_FOUND');
  }

  return result;
}

export async function createInvitation(params: {
  teamSlug: string;
  actorId: string;
  input: CreateInvitationInput;
}) {
  const result = await createInvitationForTeam({
    teamSlug: params.teamSlug,
    actorId: params.actorId,
    email: params.input.email,
    role: params.input.role
  });

  return handleInvitationResult(result);
}

export async function listTeamInvitations(params: {
  teamSlug: string;
  actorId: string;
}) {
  const result = await listInvitationsForTeam(params);

  return handleInvitationResult(result);
}

export async function acceptInvitation(params: { token: string; userId: string }) {
  const result = await acceptInvitationByToken(params);

  return handleInvitationResult(result);
}
