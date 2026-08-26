// Usage:
// Raw SQL for project reads/writes. Authorization joins stay in SQL so the API
// does not load private projects and filter them later in application memory.

import type pg from 'pg';
import { query, withTransaction } from '../../db/pool.js';

type TeamRole = 'owner' | 'admin' | 'member';
type ProjectRole = 'manager' | 'contributor' | 'viewer';

export type ProjectSummary = {
  id: string;
  teamId: string;
  teamSlug: string;
  name: string;
  description: string | null;
  teamRole: TeamRole;
  projectRole: ProjectRole | null;
  memberCount: number;
  taskCount: number;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectDetail = ProjectSummary & {
  members: Array<{
    id: string;
    email: string;
    displayName: string;
    role: ProjectRole;
    addedAt: Date;
  }>;
};

type ProjectRow = {
  id: string;
  team_id: string;
  team_slug: string;
  name: string;
  description: string | null;
  team_role: TeamRole;
  project_role: ProjectRole | null;
  member_count: number | string;
  task_count: number | string;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type ProjectDetailRow = ProjectRow & {
  members: ProjectDetail['members'];
};

type TeamAccessRow = {
  team_id: string;
  team_role: TeamRole;
};

type ProjectAccessRow = {
  project_id: string;
  team_id?: string;
  team_role: TeamRole;
  project_role: ProjectRole | null;
};

type ProjectMemberRow = {
  id: string;
  email: string;
  display_name: string;
  role: ProjectRole;
  added_at: Date;
};

function toNumber(value: number | string): number {
  return typeof value === 'number' ? value : Number(value);
}

function toProjectSummary(row: ProjectRow): ProjectSummary {
  return {
    id: row.id,
    teamId: row.team_id,
    teamSlug: row.team_slug,
    name: row.name,
    description: row.description,
    teamRole: row.team_role,
    projectRole: row.project_role,
    memberCount: toNumber(row.member_count),
    taskCount: toNumber(row.task_count),
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function canCreateProject(role: TeamRole): boolean {
  return role === 'owner' || role === 'admin';
}

function canManageProject(params: {
  team_role: TeamRole;
  project_role: ProjectRole | null;
}): boolean {
  return (
    params.team_role === 'owner' ||
    params.team_role === 'admin' ||
    params.project_role === 'manager'
  );
}

async function findTeamAccessForUser(
  client: pg.PoolClient,
  params: { teamSlug: string; userId: string }
): Promise<TeamAccessRow | null> {
  const result = await client.query<TeamAccessRow>(
    `
      SELECT
        t.id AS team_id,
        tm.role AS team_role
      FROM teams AS t
      JOIN team_members AS tm
        ON tm.team_id = t.id
       AND tm.user_id = $2
      WHERE t.slug = $1
      LIMIT 1
    `,
    [params.teamSlug, params.userId]
  );

  return result.rows[0] ?? null;
}

export async function createProjectForTeam(params: {
  teamSlug: string;
  userId: string;
  name: string;
  description?: string;
}): Promise<ProjectSummary | null | 'forbidden'> {
  return withTransaction(async (client) => {
    const access = await findTeamAccessForUser(client, params);

    if (!access) {
      return null;
    }

    if (!canCreateProject(access.team_role)) {
      return 'forbidden';
    }

    const projectResult = await client.query<ProjectRow>(
      `
        INSERT INTO projects (team_id, name, description, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          team_id,
          $5::text AS team_slug,
          name,
          description,
          $6::team_role AS team_role,
          'manager'::project_role AS project_role,
          1::int AS member_count,
          0::int AS task_count,
          archived_at,
          created_at,
          updated_at
      `,
      [
        access.team_id,
        params.name,
        params.description ?? null,
        params.userId,
        params.teamSlug,
        access.team_role
      ]
    );

    const project = projectResult.rows[0];

    await client.query(
      `
        INSERT INTO project_members (project_id, user_id, role)
        VALUES ($1, $2, 'manager')
      `,
      [project.id, params.userId]
    );

    return toProjectSummary(project);
  });
}

export async function listProjectsForTeam(params: {
  teamSlug: string;
  userId: string;
  includeArchived: boolean;
}): Promise<ProjectSummary[] | null> {
  const result = await query<ProjectRow>(
    `
      WITH accessible_team AS (
        SELECT
          t.id,
          t.slug,
          tm.role AS team_role
        FROM teams AS t
        JOIN team_members AS tm
          ON tm.team_id = t.id
         AND tm.user_id = $2
        WHERE t.slug = $1
        LIMIT 1
      )
      SELECT
        p.id,
        p.team_id,
        accessible_team.slug AS team_slug,
        p.name,
        p.description,
        accessible_team.team_role,
        requester_project.role AS project_role,
        COUNT(DISTINCT pm.user_id)::int AS member_count,
        COUNT(DISTINCT tasks.id)::int AS task_count,
        p.archived_at,
        p.created_at,
        p.updated_at
      FROM accessible_team
      JOIN projects AS p
        ON p.team_id = accessible_team.id
      LEFT JOIN project_members AS requester_project
        ON requester_project.project_id = p.id
       AND requester_project.user_id = $2
      LEFT JOIN project_members AS pm
        ON pm.project_id = p.id
      LEFT JOIN tasks
        ON tasks.project_id = p.id
      WHERE ($3::boolean = true OR p.archived_at IS NULL)
      GROUP BY
        p.id,
        p.team_id,
        accessible_team.slug,
        p.name,
        p.description,
        accessible_team.team_role,
        requester_project.role,
        p.archived_at,
        p.created_at,
        p.updated_at
      ORDER BY p.updated_at DESC
    `,
    [params.teamSlug, params.userId, params.includeArchived]
  );

  if (result.rows.length === 0) {
    const teamExists = await query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM teams AS t
          JOIN team_members AS tm
            ON tm.team_id = t.id
           AND tm.user_id = $2
          WHERE t.slug = $1
        ) AS exists
      `,
      [params.teamSlug, params.userId]
    );

    if (!teamExists.rows[0]?.exists) {
      return null;
    }
  }

  return result.rows.map(toProjectSummary);
}

export async function findProjectDetailForUser(params: {
  projectId: string;
  userId: string;
}): Promise<ProjectDetail | null> {
  const result = await query<ProjectDetailRow>(
    `
      WITH selected_project AS (
        SELECT
          p.id,
          p.team_id,
          t.slug AS team_slug,
          p.name,
          p.description,
          tm.role AS team_role,
          requester_project.role AS project_role,
          p.archived_at,
          p.created_at,
          p.updated_at
        FROM projects AS p
        JOIN teams AS t
          ON t.id = p.team_id
        JOIN team_members AS tm
          ON tm.team_id = p.team_id
         AND tm.user_id = $2
        LEFT JOIN project_members AS requester_project
          ON requester_project.project_id = p.id
         AND requester_project.user_id = $2
        WHERE p.id = $1
        LIMIT 1
      )
      SELECT
        selected_project.id,
        selected_project.team_id,
        selected_project.team_slug,
        selected_project.name,
        selected_project.description,
        selected_project.team_role,
        selected_project.project_role,
        COUNT(DISTINCT pm.user_id)::int AS member_count,
        COUNT(DISTINCT tasks.id)::int AS task_count,
        selected_project.archived_at,
        selected_project.created_at,
        selected_project.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', u.id,
              'email', u.email,
              'displayName', u.display_name,
              'role', pm.role,
              'addedAt', pm.added_at
            )
            ORDER BY pm.added_at ASC
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'::json
        ) AS members
      FROM selected_project
      LEFT JOIN project_members AS pm
        ON pm.project_id = selected_project.id
      LEFT JOIN users AS u
        ON u.id = pm.user_id
      LEFT JOIN tasks
        ON tasks.project_id = selected_project.id
      GROUP BY
        selected_project.id,
        selected_project.team_id,
        selected_project.team_slug,
        selected_project.name,
        selected_project.description,
        selected_project.team_role,
        selected_project.project_role,
        selected_project.archived_at,
        selected_project.created_at,
        selected_project.updated_at
    `,
    [params.projectId, params.userId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    ...toProjectSummary(row),
    members: row.members
  };
}

async function findProjectAccessForUser(
  client: pg.PoolClient,
  params: { projectId: string; userId: string }
): Promise<ProjectAccessRow | null> {
  const result = await client.query<ProjectAccessRow>(
    `
      SELECT
        p.id AS project_id,
        p.team_id,
        tm.role AS team_role,
        pm.role AS project_role
      FROM projects AS p
      JOIN team_members AS tm
        ON tm.team_id = p.team_id
       AND tm.user_id = $2
      LEFT JOIN project_members AS pm
        ON pm.project_id = p.id
       AND pm.user_id = $2
      WHERE p.id = $1
      LIMIT 1
    `,
    [params.projectId, params.userId]
  );

  return result.rows[0] ?? null;
}

function toProjectMember(row: ProjectMemberRow): ProjectDetail['members'][number] {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    addedAt: row.added_at
  };
}

export async function upsertProjectMemberForUser(params: {
  projectId: string;
  actorId: string;
  targetUserId: string;
  role: ProjectRole;
}): Promise<ProjectDetail['members'][number] | null | 'forbidden' | 'not_team_member'> {
  return withTransaction(async (client) => {
    const access = await findProjectAccessForUser(client, {
      projectId: params.projectId,
      userId: params.actorId
    });

    if (!access) return null;
    if (!canManageProject(access)) return 'forbidden';

    const teamMember = await client.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM team_members
          WHERE team_id = $1
            AND user_id = $2
        ) AS exists
      `,
      [access.team_id, params.targetUserId]
    );

    if (!teamMember.rows[0]?.exists) return 'not_team_member';

    const result = await client.query<ProjectMemberRow>(
      `
        INSERT INTO project_members (project_id, user_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (project_id, user_id) DO UPDATE
        SET role = EXCLUDED.role
        RETURNING
          user_id AS id,
          (SELECT email FROM users WHERE users.id = project_members.user_id) AS email,
          (SELECT display_name FROM users WHERE users.id = project_members.user_id) AS display_name,
          role,
          added_at
      `,
      [params.projectId, params.targetUserId, params.role]
    );

    return toProjectMember(result.rows[0]);
  });
}

export async function removeProjectMemberForUser(params: {
  projectId: string;
  actorId: string;
  targetUserId: string;
}): Promise<{ id: string } | null | 'forbidden'> {
  return withTransaction(async (client) => {
    const access = await findProjectAccessForUser(client, {
      projectId: params.projectId,
      userId: params.actorId
    });

    if (!access) return null;
    if (!canManageProject(access)) return 'forbidden';

    const result = await client.query<{ id: string }>(
      `
        DELETE FROM project_members
        WHERE project_id = $1
          AND user_id = $2
          AND NOT (
            user_id = $3
            AND role = 'manager'
          )
        RETURNING user_id AS id
      `,
      [params.projectId, params.targetUserId, params.actorId]
    );

    return result.rows[0] ?? null;
  });
}

export async function updateProjectForUser(params: {
  projectId: string;
  userId: string;
  name?: string;
  description?: string | null;
}): Promise<ProjectSummary | null | 'forbidden'> {
  return withTransaction(async (client) => {
    const access = await findProjectAccessForUser(client, params);

    if (!access) {
      return null;
    }

    if (!canManageProject(access)) {
      return 'forbidden';
    }

    const result = await client.query<ProjectRow>(
      `
        UPDATE projects AS p
        SET
          name = COALESCE($2, p.name),
          description = CASE
            WHEN $3::boolean THEN $4
            ELSE p.description
          END
        FROM teams AS t
        WHERE p.id = $1
          AND t.id = p.team_id
        RETURNING
          p.id,
          p.team_id,
          t.slug AS team_slug,
          p.name,
          p.description,
          $5::team_role AS team_role,
          $6::project_role AS project_role,
          (
            SELECT COUNT(*)::int
            FROM project_members AS pm
            WHERE pm.project_id = p.id
          ) AS member_count,
          (
            SELECT COUNT(*)::int
            FROM tasks
            WHERE tasks.project_id = p.id
          ) AS task_count,
          p.archived_at,
          p.created_at,
          p.updated_at
      `,
      [
        params.projectId,
        params.name ?? null,
        params.description !== undefined,
        params.description ?? null,
        access.team_role,
        access.project_role
      ]
    );

    return toProjectSummary(result.rows[0]);
  });
}

export async function archiveProjectForUser(params: {
  projectId: string;
  userId: string;
}): Promise<ProjectSummary | null | 'forbidden'> {
  return withTransaction(async (client) => {
    const access = await findProjectAccessForUser(client, params);

    if (!access) {
      return null;
    }

    if (!canManageProject(access)) {
      return 'forbidden';
    }

    const result = await client.query<ProjectRow>(
      `
        UPDATE projects AS p
        SET archived_at = COALESCE(p.archived_at, now())
        FROM teams AS t
        WHERE p.id = $1
          AND t.id = p.team_id
        RETURNING
          p.id,
          p.team_id,
          t.slug AS team_slug,
          p.name,
          p.description,
          $2::team_role AS team_role,
          $3::project_role AS project_role,
          (
            SELECT COUNT(*)::int
            FROM project_members AS pm
            WHERE pm.project_id = p.id
          ) AS member_count,
          (
            SELECT COUNT(*)::int
            FROM tasks
            WHERE tasks.project_id = p.id
          ) AS task_count,
          p.archived_at,
          p.created_at,
          p.updated_at
      `,
      [params.projectId, access.team_role, access.project_role]
    );

    return toProjectSummary(result.rows[0]);
  });
}
