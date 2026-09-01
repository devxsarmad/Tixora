// Usage:
// Raw SQL for team reads/writes. These queries intentionally use joins so team
// access, roles, and counts come from the database in one round trip.

import type pg from 'pg';
import { query, withTransaction } from '../../db/pool.js';

export type TeamSummary = {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'admin' | 'member';
  memberCount: number;
  activeProjectCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type TeamDetail = TeamSummary & {
  members: Array<{
    id: string;
    email: string;
    displayName: string;
    role: 'owner' | 'admin' | 'member';
    joinedAt: Date;
  }>;
};

type TeamSummaryRow = {
  id: string;
  name: string;
  slug: string;
  role: TeamSummary['role'];
  member_count: number | string;
  active_project_count: number | string;
  created_at: Date;
  updated_at: Date;
};

type TeamDetailRow = TeamSummaryRow & {
  members: TeamDetail['members'];
};

type TeamAccessRow = {
  team_id: string;
  role: TeamSummary['role'];
};

type TeamMemberRow = {
  id: string;
  email: string;
  display_name: string;
  role: TeamSummary['role'];
  joined_at: Date;
};

function toNumber(value: number | string): number {
  return typeof value === 'number' ? value : Number(value);
}

function toTeamSummary(row: TeamSummaryRow): TeamSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    role: row.role,
    memberCount: toNumber(row.member_count),
    activeProjectCount: toNumber(row.active_project_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function createTeamWithOwner(params: {
  name: string;
  slug: string;
  ownerId: string;
}): Promise<TeamSummary> {
  return withTransaction(async (client: pg.PoolClient) => {
    const teamResult = await client.query<TeamSummaryRow>(
      `
        INSERT INTO teams (name, slug, created_by)
        VALUES ($1, $2, $3)
        RETURNING
          id,
          name,
          slug,
          'owner'::team_role AS role,
          1::int AS member_count,
          0::int AS active_project_count,
          created_at,
          updated_at
      `,
      [params.name, params.slug, params.ownerId]
    );

    const team = teamResult.rows[0];

    await client.query(
      `
        INSERT INTO team_members (team_id, user_id, role)
        VALUES ($1, $2, 'owner')
      `,
      [team.id, params.ownerId]
    );

    return toTeamSummary(team);
  });
}

export async function listTeamsForUser(userId: string): Promise<TeamSummary[]> {
  const result = await query<TeamSummaryRow>(
    `
      SELECT
        t.id,
        t.name,
        t.slug,
        requester.role,
        COUNT(DISTINCT all_members.user_id)::int AS member_count,
        COUNT(DISTINCT p.id) FILTER (WHERE p.archived_at IS NULL)::int AS active_project_count,
        t.created_at,
        t.updated_at
      FROM team_members AS requester
      JOIN teams AS t
        ON t.id = requester.team_id
      LEFT JOIN team_members AS all_members
        ON all_members.team_id = t.id
      LEFT JOIN projects AS p
        ON p.team_id = t.id
      WHERE requester.user_id = $1
      GROUP BY
        t.id,
        t.name,
        t.slug,
        requester.role,
        t.created_at,
        t.updated_at
      ORDER BY t.updated_at DESC
    `,
    [userId]
  );

  return result.rows.map(toTeamSummary);
}

export async function findTeamDetailForUser(params: {
  slug: string;
  userId: string;
}): Promise<TeamDetail | null> {
  const result = await query<TeamDetailRow>(
    `
      WITH selected_team AS (
        SELECT
          t.id,
          t.name,
          t.slug,
          requester.role,
          t.created_at,
          t.updated_at
        FROM teams AS t
        JOIN team_members AS requester
          ON requester.team_id = t.id
         AND requester.user_id = $2
        WHERE t.slug = $1
        LIMIT 1
      )
      SELECT
        selected_team.id,
        selected_team.name,
        selected_team.slug,
        selected_team.role,
        COUNT(DISTINCT all_members.user_id)::int AS member_count,
        COUNT(DISTINCT p.id) FILTER (WHERE p.archived_at IS NULL)::int AS active_project_count,
        selected_team.created_at,
        selected_team.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', u.id,
              'email', u.email,
              'displayName', u.display_name,
              'role', all_members.role,
              'joinedAt', all_members.joined_at
            )
            ORDER BY all_members.joined_at ASC
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'::json
        ) AS members
      FROM selected_team
      LEFT JOIN team_members AS all_members
        ON all_members.team_id = selected_team.id
      LEFT JOIN users AS u
        ON u.id = all_members.user_id
      LEFT JOIN projects AS p
        ON p.team_id = selected_team.id
      GROUP BY
        selected_team.id,
        selected_team.name,
        selected_team.slug,
        selected_team.role,
        selected_team.created_at,
        selected_team.updated_at
    `,
    [params.slug, params.userId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    ...toTeamSummary(row),
    members: row.members
  };
}

function toTeamMember(row: TeamMemberRow): TeamDetail['members'][number] {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    joinedAt: row.joined_at
  };
}

async function findTeamAccess(
  client: pg.PoolClient,
  params: { slug: string; userId: string }
): Promise<TeamAccessRow | null> {
  const result = await client.query<TeamAccessRow>(
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

  return result.rows[0] ?? null;
}

export async function addTeamMemberForUser(params: {
  slug: string;
  actorId: string;
  email: string;
  role: 'admin' | 'member';
}): Promise<TeamDetail['members'][number] | null | 'forbidden' | 'user_not_found'> {
  return withTransaction(async (client) => {
    const access = await findTeamAccess(client, {
      slug: params.slug,
      userId: params.actorId
    });

    if (!access) return null;
    if (access.role !== 'owner' && access.role !== 'admin') return 'forbidden';

    const userResult = await client.query<{ id: string }>(
      `
        SELECT id
        FROM users
        WHERE email = $1
          AND is_active = true
        LIMIT 1
      `,
      [params.email]
    );

    const user = userResult.rows[0];
    if (!user) return 'user_not_found';

    const memberResult = await client.query<TeamMemberRow>(
      `
        INSERT INTO team_members (team_id, user_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (team_id, user_id) DO UPDATE
        SET role = EXCLUDED.role
        RETURNING
          user_id AS id,
          (SELECT email FROM users WHERE users.id = team_members.user_id) AS email,
          (SELECT display_name FROM users WHERE users.id = team_members.user_id) AS display_name,
          role,
          joined_at
      `,
      [access.team_id, user.id, params.role]
    );

    return toTeamMember(memberResult.rows[0]);
  });
}

export async function updateTeamMemberForUser(params: {
  slug: string;
  actorId: string;
  targetUserId: string;
  role: 'admin' | 'member';
}): Promise<TeamDetail['members'][number] | null | 'forbidden'> {
  return withTransaction(async (client) => {
    const access = await findTeamAccess(client, {
      slug: params.slug,
      userId: params.actorId
    });

    if (!access) return null;
    if (access.role !== 'owner') return 'forbidden';

    const memberResult = await client.query<TeamMemberRow>(
      `
        UPDATE team_members
        SET role = $3::team_role
        WHERE team_id = $1
          AND user_id = $2
          AND role <> 'owner'
        RETURNING
          user_id AS id,
          (SELECT email FROM users WHERE users.id = team_members.user_id) AS email,
          (SELECT display_name FROM users WHERE users.id = team_members.user_id) AS display_name,
          role,
          joined_at
      `,
      [access.team_id, params.targetUserId, params.role]
    );

    return memberResult.rows[0] ? toTeamMember(memberResult.rows[0]) : null;
  });
}

export async function removeTeamMemberForUser(params: {
  slug: string;
  actorId: string;
  targetUserId: string;
}): Promise<{ id: string } | null | 'forbidden' | 'owner_transfer_required'> {
  return withTransaction(async (client) => {
    const access = await findTeamAccess(client, {
      slug: params.slug,
      userId: params.actorId
    });

    if (!access) return null;
    if (access.role !== 'owner' && access.role !== 'admin') return 'forbidden';

    const targetMember = await client.query<{ role: 'owner' | 'admin' | 'member' }>(
      `
        SELECT role
        FROM team_members
        WHERE team_id = $1
          AND user_id = $2
      `,
      [access.team_id, params.targetUserId]
    );

    if (!targetMember.rows[0]) return null;
    if (targetMember.rows[0].role === 'owner') return 'owner_transfer_required';

    const result = await client.query<{ id: string }>(
      `
        DELETE FROM team_members
        WHERE team_id = $1
          AND user_id = $2
          AND ($3::team_role = 'owner' OR role = 'member')
        RETURNING user_id AS id
      `,
      [access.team_id, params.targetUserId, access.role]
    );

    return result.rows[0] ?? null;
  });
}
