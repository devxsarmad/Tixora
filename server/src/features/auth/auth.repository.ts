// Usage:
// Contains the raw parameterized SQL for auth-related user reads/writes. Keeping
// SQL here makes it easier to review query shape, indexes, and injection safety.

import { query } from '../../db/pool.js';

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
};

export type UserWithPassword = PublicUser & {
  passwordHash: string;
  isActive: boolean;
};

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  is_active: boolean;
  created_at: Date;
};

function toPublicUser(row: Pick<UserRow, 'id' | 'email' | 'display_name' | 'created_at'>): PublicUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at
  };
}

export async function createUser(params: {
  email: string;
  passwordHash: string;
  displayName: string;
}): Promise<PublicUser> {
  const result = await query<UserRow>(
    `
      INSERT INTO users (email, password_hash, display_name)
      VALUES ($1, $2, $3)
      RETURNING id, email, display_name, password_hash, is_active, created_at
    `,
    [params.email, params.passwordHash, params.displayName]
  );

  return toPublicUser(result.rows[0]);
}

export async function findUserByEmail(
  email: string
): Promise<UserWithPassword | null> {
  const result = await query<UserRow>(
    `
      SELECT id, email, display_name, password_hash, is_active, created_at
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    ...toPublicUser(row),
    passwordHash: row.password_hash,
    isActive: row.is_active
  };
}
