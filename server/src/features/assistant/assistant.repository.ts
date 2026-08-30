import { query } from '../../db/pool.js';

type ScopeRow = {
  org_id: string;
};

type TaskCountRow = {
  total_count: number;
  todo_count: number;
  in_progress_count: number;
  blocked_count: number;
  done_count: number;
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


export async function countAccessibleTasks(params: {
  userId: string;
  orgId: string;
  projectId?: string;
}) {
  const result = await query<TaskCountRow>(
    `
      SELECT
        COUNT(task.id)::int AS total_count,
        COUNT(task.id) FILTER (WHERE task.status = 'todo')::int AS todo_count,
        COUNT(task.id) FILTER (WHERE task.status = 'in_progress')::int AS in_progress_count,
        COUNT(task.id) FILTER (WHERE task.status = 'blocked')::int AS blocked_count,
        COUNT(task.id) FILTER (WHERE task.status = 'done')::int AS done_count
      FROM projects AS p
      JOIN team_members AS tm
        ON tm.team_id = p.team_id
       AND tm.user_id = $2
      LEFT JOIN project_members AS pm
        ON pm.project_id = p.id
       AND pm.user_id = $2
      LEFT JOIN tasks AS task
        ON task.project_id = p.id
       AND task.deleted_at IS NULL
      WHERE p.team_id = $1
        AND ($3::uuid IS NULL OR p.id = $3)
        AND p.deleted_at IS NULL
        AND (tm.role IN ('owner', 'admin') OR pm.user_id IS NOT NULL)
    `,
    [params.orgId, params.userId, params.projectId ?? null]
  );

  const row = result.rows[0];

  return {
    total: row?.total_count ?? 0,
    todo: row?.todo_count ?? 0,
    inProgress: row?.in_progress_count ?? 0,
    blocked: row?.blocked_count ?? 0,
    done: row?.done_count ?? 0
  };
}
