// Usage:
// Team business rules: translate database errors, enforce authenticated access,
// and keep route handlers thin.

import { HttpError } from '../../shared/http-error.js';
import {
  isPostgresError,
  POSTGRES_UNIQUE_VIOLATION
} from '../../shared/postgres-errors.js';
import {
  addTeamMemberForUser,
  createTeamWithOwner,
  findTeamDetailForUser,
  listTeamsForUser,
  removeTeamMemberForUser,
  updateTeamMemberForUser
} from './team.repository.js';
import type {
  AddTeamMemberInput,
  CreateTeamInput,
  UpdateTeamMemberInput
} from './team.schemas.js';

function buildSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function appendSlugSuffix(slug: string) {
  const suffix = Date.now().toString(36).slice(-6);
  const base = slug.slice(0, 80 - suffix.length - 1).replace(/-+$/g, '');

  return `${base}-${suffix}`;
}

export async function createTeam(input: CreateTeamInput, ownerId: string) {
  const slug = input.slug ?? buildSlug(input.name);

  if (!slug) {
    throw new HttpError(
      400,
      'Organization name must contain at least one letter or number',
      'INVALID_TEAM_NAME'
    );
  }

  try {
    return await createTeamWithOwner({
      name: input.name,
      slug,
      ownerId
    });
  } catch (error) {
    if (isPostgresError(error) && error.code === POSTGRES_UNIQUE_VIOLATION) {
      if (!input.slug) {
        return createTeamWithOwner({
          name: input.name,
          slug: appendSlugSuffix(slug),
          ownerId
        });
      }

      throw new HttpError(409, 'Organization slug is already taken', 'TEAM_SLUG_TAKEN');
    }

    throw error;
  }
}

export async function listMyTeams(userId: string) {
  return listTeamsForUser(userId);
}

export async function getMyTeamBySlug(slug: string, userId: string) {
  const team = await findTeamDetailForUser({ slug, userId });

  if (!team) {
    throw new HttpError(404, 'Organization not found', 'TEAM_NOT_FOUND');
  }

  return team;
}

function handleMemberResult<T>(
  result: T | null | 'forbidden' | 'user_not_found'
): T {
  if (result === 'forbidden') {
    throw new HttpError(403, 'Organization permission denied', 'TEAM_FORBIDDEN');
  }

  if (result === 'user_not_found') {
    throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');
  }

  if (!result) {
    throw new HttpError(404, 'Organization member not found', 'TEAM_MEMBER_NOT_FOUND');
  }

  return result;
}

export async function addTeamMember(params: {
  slug: string;
  actorId: string;
  input: AddTeamMemberInput;
}) {
  const result = await addTeamMemberForUser({
    slug: params.slug,
    actorId: params.actorId,
    email: params.input.email,
    role: params.input.role
  });

  return handleMemberResult(result);
}

export async function updateTeamMember(params: {
  slug: string;
  actorId: string;
  targetUserId: string;
  input: UpdateTeamMemberInput;
}) {
  const result = await updateTeamMemberForUser({
    slug: params.slug,
    actorId: params.actorId,
    targetUserId: params.targetUserId,
    role: params.input.role
  });

  return handleMemberResult(result);
}

export async function removeTeamMember(params: {
  slug: string;
  actorId: string;
  targetUserId: string;
}) {
  const result = await removeTeamMemberForUser(params);

  return handleMemberResult(result);
}
