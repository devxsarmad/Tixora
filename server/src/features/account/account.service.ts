// Usage:
// Account business rules for profile updates, password changes, organization
// leaving, and soft account deletion.

import bcrypt from 'bcryptjs';
import { HttpError } from '../../shared/http-error.js';
import { isPostgresError, POSTGRES_UNIQUE_VIOLATION } from '../../shared/postgres-errors.js';
import {
  deactivateUserAccount,
  findUserPasswordById,
  leaveTeamForUser,
  updateUserPassword,
  updateUserProfile
} from './account.repository.js';
import type { ChangePasswordInput, UpdateMeInput } from './account.schemas.js';

const BCRYPT_COST = 12;

function handleOwnerTransferRequired() {
  throw new HttpError(
    409,
    'Transfer organization ownership before leaving or deleting this account',
    'ORGANIZATION_OWNER_TRANSFER_REQUIRED'
  );
}

export async function updateMe(userId: string, input: UpdateMeInput) {
  try {
    const user = await updateUserProfile({
      userId,
      displayName: input.displayName,
      email: input.email
    });

    if (!user) throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');
    return user;
  } catch (error) {
    if (isPostgresError(error) && error.code === POSTGRES_UNIQUE_VIOLATION) {
      throw new HttpError(409, 'Email is already registered', 'EMAIL_TAKEN');
    }

    throw error;
  }
}

export async function changePassword(userId: string, input: ChangePasswordInput) {
  const user = await findUserPasswordById(userId);
  if (!user) throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');

  const passwordMatches = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!passwordMatches) {
    throw new HttpError(401, 'Current password is incorrect', 'INVALID_CURRENT_PASSWORD');
  }

  const nextPasswordHash = await bcrypt.hash(input.newPassword, BCRYPT_COST);
  const updated = await updateUserPassword({ userId, passwordHash: nextPasswordHash });

  if (!updated) throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');
  return { changed: true };
}

export async function leaveOrganization(params: { slug: string; userId: string }) {
  const result = await leaveTeamForUser(params);

  if (result === 'owner_transfer_required') handleOwnerTransferRequired();
  if (!result) throw new HttpError(404, 'Organization membership not found', 'TEAM_MEMBER_NOT_FOUND');

  return result;
}

export async function deleteMe(userId: string) {
  const result = await deactivateUserAccount(userId);

  if (result === 'owner_transfer_required') handleOwnerTransferRequired();
  if (!result) throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');

  return result;
}
