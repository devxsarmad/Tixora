import { query } from '../../db/pool.js';

type ScopeRow = {
  org_id: string;
};

export async function resolveAssistantScope(params: {
  userId: string;
  orgSlug?: string;
  projectId?: string;
}): Promise<{ orgId: string } | null> {
  if (params.projectId) {
    const result = await query<ScopeRow>(
      `
        SELECT p.team_id AS org_id
        FROM projects AS p
        JOIN team_members AS tm
          ON tm.team_id = p.team_id
         AND tm.user_id = $2
        LEFT JOIN project_members AS pm
          ON pm.project_id = p.id
         AND pm.user_id = $2
        WHERE p.id = $1
          AND p.deleted_at IS NULL
          AND ($3::text IS NULL OR EXISTS (
            SELECT 1
            FROM teams
            WHERE teams.id = p.team_id
              AND teams.slug = $3
          ))
          AND (
            tm.role IN ('owner', 'admin')
            OR pm.user_id IS NOT NULL
          )
      `,
      [params.projectId, params.userId, params.orgSlug ?? null]
    );

    return result.rows[0] ? { orgId: result.rows[0].org_id } : null;
  }

  if (!params.orgSlug) return null;

  const result = await query<ScopeRow>(
    `
      SELECT teams.id AS org_id
      FROM teams
      JOIN team_members AS tm
        ON tm.team_id = teams.id
       AND tm.user_id = $2
      WHERE teams.slug = $1
    `,
    [params.orgSlug, params.userId]
  );

  return result.rows[0] ? { orgId: result.rows[0].org_id } : null;
}
