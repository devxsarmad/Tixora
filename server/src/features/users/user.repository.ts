// Usage:
// Read-only SQL for the authenticated user directory.

import { query } from '../../db/pool.js';

export type UserSummary = {
  id: string;
  email: string;
  displayName: string;
};

type UserRow = {
  id: string;
  email: string;
  display_name: string;
};

function toUserSummary(row: UserRow): UserSummary {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name
  };
}

export async function searchUsers(params: {
  queryText?: string;
  requesterId: string;
}): Promise<UserSummary[]> {
  const result = await query<UserRow>(
    `
      SELECT id, email, display_name
      FROM users
      WHERE is_active = true
        AND id <> $2
        AND (
          $1::text IS NULL
          OR email ILIKE '%' || $1 || '%'
          OR display_name ILIKE '%' || $1 || '%'
        )
      ORDER BY display_name ASC, email ASC
      LIMIT 20
    `,
    [params.queryText?.trim() || null, params.requesterId]
  );

  return result.rows.map(toUserSummary);
}
