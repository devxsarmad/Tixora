// Usage:
// SQL for authenticated account mutations. User deletion is soft-delete via
// is_active=false so historical tasks/comments keep their author references.

import type pg from 'pg';
import { query, withTransaction } from '../../db/pool.js';

export type AccountUser = {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
};

export type AccountUserWithPassword = AccountUser & {
  passwordHash: string;
  isActive: boolean;
};

type AccountUserRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  is_active: boolean;
  created_at: Date;
};

function toAccountUser(row: Pick<AccountUserRow, 'id' | 'email' | 'display_name' | 'created_at'>): AccountUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at
  };
}

export async function updateUserProfile(params: {
  userId: string;
  displayName?: string;
  email?: string;
}): Promise<AccountUser | null> {
  const result = await query<AccountUserRow>(
    `
      UPDATE users
      SET
        display_name = COALESCE($2, display_name),
        email = COALESCE($3, email),
        updated_at = now()
      WHERE id = $1
        AND is_active = true
      RETURNING id, email, display_name, password_hash, is_active, created_at
    `,
    [params.userId, params.displayName ?? null, params.email ?? null]
  );

  return result.rows[0] ? toAccountUser(result.rows[0]) : null;
}

export async function findUserPasswordById(userId: string): Promise<AccountUserWithPassword | null> {
  const result = await query<AccountUserRow>(
    `
      SELECT id, email, display_name, password_hash, is_active, created_at
      FROM users
      WHERE id = $1
        AND is_active = true
      LIMIT 1
    `,
    [userId]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    ...toAccountUser(row),
    passwordHash: row.password_hash,
    isActive: row.is_active
  };
}

export async function updateUserPassword(params: { userId: string; passwordHash: string }): Promise<boolean> {
  const result = await query(
    `
      UPDATE users
      SET password_hash = $2,
          updated_at = now()
      WHERE id = $1
        AND is_active = true
    `,
    [params.userId, params.passwordHash]
  );

  return (result.rowCount ?? 0) > 0;
}

async function hasLastOwnedOrganization(client: pg.PoolClient, userId: string): Promise<boolean> {
  const result = await client.query<{ has_last_owned_organization: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM team_members AS owner_membership
        WHERE owner_membership.user_id = $1
          AND owner_membership.role = 'owner'
          AND (
            SELECT COUNT(*)
            FROM team_members AS other_owner
            WHERE other_owner.team_id = owner_membership.team_id
              AND other_owner.role = 'owner'
          ) = 1
      ) AS has_last_owned_organization
    `,
    [userId]
  );

  return result.rows[0]?.has_last_owned_organization ?? false;
}

export async function leaveTeamForUser(params: {
  slug: string;
  userId: string;
}): Promise<{ slug: string } | null | 'owner_transfer_required'> {
  return withTransaction(async (client) => {
    const membershipResult = await client.query<{ team_id: string; role: 'owner' | 'admin' | 'member' }>(
      `
        SELECT t.id AS team_id, tm.role
        FROM teams AS t
        JOIN team_members AS tm
          ON tm.team_id = t.id
         AND tm.user_id = $2
        WHERE t.slug = $1
        LIMIT 1
      `,
      [params.slug, params.userId]
    );

    const membership = membershipResult.rows[0];
    if (!membership) return null;

    if (membership.role === 'owner') {
      const ownerCountResult = await client.query<{ owner_count: number | string }>(
        `
          SELECT COUNT(*)::int AS owner_count
          FROM team_members
          WHERE team_id = $1
            AND role = 'owner'
        `,
        [membership.team_id]
      );

      if (Number(ownerCountResult.rows[0]?.owner_count ?? 0) <= 1) {
        return 'owner_transfer_required';
      }
    }

    await client.query(
      `
        DELETE FROM project_members AS pm
        USING projects AS p
        WHERE p.id = pm.project_id
          AND p.team_id = $1
          AND pm.user_id = $2
      `,
      [membership.team_id, params.userId]
    );

    await client.query(
      `
        DELETE FROM team_members
        WHERE team_id = $1
          AND user_id = $2
      `,
      [membership.team_id, params.userId]
    );

    return { slug: params.slug };
  });
}

export async function deactivateUserAccount(userId: string): Promise<{ id: string } | 'owner_transfer_required' | null> {
  return withTransaction(async (client) => {
    if (await hasLastOwnedOrganization(client, userId)) {
      return 'owner_transfer_required';
    }

    await client.query(
      `
        DELETE FROM project_members
        WHERE user_id = $1
      `,
      [userId]
    );

    await client.query(
      `
        DELETE FROM team_members
        WHERE user_id = $1
      `,
      [userId]
    );

    const result = await client.query<{ id: string }>(
      `
        UPDATE users
        SET is_active = false,
            updated_at = now()
        WHERE id = $1
          AND is_active = true
        RETURNING id
      `,
      [userId]
    );

    return result.rows[0] ?? null;
  });
}
