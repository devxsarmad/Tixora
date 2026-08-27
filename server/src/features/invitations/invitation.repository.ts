// Usage:
// SQL-backed organization invitation reads/writes. Invitations are separate from
// organization membership until the invited user accepts.

import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { withTransaction } from '../../db/pool.js';

type TeamRole = 'owner' | 'admin' | 'member';
type InvitationStatus = 'pending' | 'accepted' | 'expired';

export type InvitationSummary = {
  id: string;
  teamId: string;
  email: string;
  token: string;
  status: InvitationStatus;
  role: TeamRole;
  inviter: {
    id: string;
    email: string;
    displayName: string;
  };
  acceptedBy: string | null;
  acceptedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type TeamAccessRow = {
  team_id: string;
  role: TeamRole;
};

type InvitationRow = {
  id: string;
  team_id: string;
  email: string;
  token: string;
  status: InvitationStatus;
  role: TeamRole;
  inviter_id: string;
  inviter_email: string;
  inviter_display_name: string;
  accepted_by: string | null;
  accepted_at: Date | null;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
};

function sql(lines: string[]) {
  return lines.join('\n');
}

function toInvitationSummary(row: InvitationRow): InvitationSummary {
  return {
    id: row.id,
    teamId: row.team_id,
    email: row.email,
    token: row.token,
    status: row.status,
    role: row.role,
    inviter: {
      id: row.inviter_id,
      email: row.inviter_email,
      displayName: row.inviter_display_name
    },
    acceptedBy: row.accepted_by,
    acceptedAt: row.accepted_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function createToken() {
  return randomBytes(32).toString('hex');
}

async function findTeamAccess(
  client: pg.PoolClient,
  params: { teamSlug: string; userId: string }
): Promise<TeamAccessRow | null> {
  const result = await client.query<TeamAccessRow>(
    sql([
      'SELECT t.id AS team_id, tm.role',
      'FROM teams AS t',
      'JOIN team_members AS tm',
      '  ON tm.team_id = t.id',
      ' AND tm.user_id = $2',
      'WHERE t.slug = $1',
      'LIMIT 1'
    ]),
    [params.teamSlug, params.userId]
  );

  return result.rows[0] ?? null;
}

async function findInvitationByToken(
  client: pg.PoolClient,
  token: string
): Promise<(InvitationRow & { accepted_user_id: string | null }) | null> {
  const result = await client.query<InvitationRow & { accepted_user_id: string | null }>(
    sql([
      'SELECT',
      '  invitations.id,',
      '  invitations.team_id,',
      '  invitations.email,',
      '  invitations.token,',
      '  invitations.status,',
      '  invitations.role,',
      '  invitations.inviter_id,',
      '  inviter.email AS inviter_email,',
      '  inviter.display_name AS inviter_display_name,',
      '  invitations.accepted_by,',
      '  invitations.accepted_at,',
      '  invitations.expires_at,',
      '  invitations.created_at,',
      '  invitations.updated_at,',
      '  accepted_user.id AS accepted_user_id',
      'FROM invitations',
      'JOIN users AS inviter',
      '  ON inviter.id = invitations.inviter_id',
      'LEFT JOIN users AS accepted_user',
      '  ON accepted_user.email = invitations.email',
      ' AND accepted_user.is_active = true',
      'WHERE invitations.token = $1',
      'LIMIT 1'
    ]),
    [token]
  );

  return result.rows[0] ?? null;
}

export async function createInvitationForTeam(params: {
  teamSlug: string;
  actorId: string;
  email: string;
  role: 'admin' | 'member';
}): Promise<InvitationSummary | null | 'forbidden' | 'already_member' | 'already_invited'> {
  return withTransaction(async (client) => {
    const access = await findTeamAccess(client, {
      teamSlug: params.teamSlug,
      userId: params.actorId
    });

    if (!access) return null;
    if (access.role !== 'owner' && access.role !== 'admin') return 'forbidden';

    const memberResult = await client.query<{ exists: boolean }>(
      sql([
        'SELECT EXISTS (',
        '  SELECT 1',
        '  FROM team_members',
        '  JOIN users ON users.id = team_members.user_id',
        '  WHERE team_members.team_id = $1',
        '    AND users.email = $2',
        ') AS exists'
      ]),
      [access.team_id, params.email]
    );

    if (memberResult.rows[0]?.exists) return 'already_member';

    const pendingInvite = await client.query<{ exists: boolean }>(
      sql([
        'SELECT EXISTS (',
        '  SELECT 1',
        '  FROM invitations',
        '  WHERE team_id = $1',
        '    AND email = $2',
        "    AND status = 'pending'",
        ') AS exists'
      ]),
      [access.team_id, params.email]
    );

    if (pendingInvite.rows[0]?.exists) return 'already_invited';

    const result = await client.query<InvitationRow>(
      sql([
        'INSERT INTO invitations (team_id, email, token, role, inviter_id, expires_at)',
        "VALUES ($1, $2, $3, $4, $5, now() + interval '7 days')",
        'RETURNING',
        '  invitations.id,',
        '  invitations.team_id,',
        '  invitations.email,',
        '  invitations.token,',
        '  invitations.status,',
        '  invitations.role,',
        '  invitations.inviter_id,',
        '  (SELECT email FROM users WHERE users.id = invitations.inviter_id) AS inviter_email,',
        '  (SELECT display_name FROM users WHERE users.id = invitations.inviter_id) AS inviter_display_name,',
        '  invitations.accepted_by,',
        '  invitations.accepted_at,',
        '  invitations.expires_at,',
        '  invitations.created_at,',
        '  invitations.updated_at'
      ]),
      [access.team_id, params.email, createToken(), params.role, params.actorId]
    );

    return toInvitationSummary(result.rows[0]);
  });
}

export async function listInvitationsForTeam(params: {
  teamSlug: string;
  actorId: string;
}): Promise<InvitationSummary[] | null | 'forbidden'> {
  return withTransaction(async (client) => {
    const access = await findTeamAccess(client, {
      teamSlug: params.teamSlug,
      userId: params.actorId
    });

    if (!access) return null;
    if (access.role !== 'owner' && access.role !== 'admin') return 'forbidden';

    const result = await client.query<InvitationRow>(
      sql([
        'SELECT',
        '  invitations.id,',
        '  invitations.team_id,',
        '  invitations.email,',
        '  invitations.token,',
        '  invitations.status,',
        '  invitations.role,',
        '  invitations.inviter_id,',
        '  inviter.email AS inviter_email,',
        '  inviter.display_name AS inviter_display_name,',
        '  invitations.accepted_by,',
        '  invitations.accepted_at,',
        '  invitations.expires_at,',
        '  invitations.created_at,',
        '  invitations.updated_at',
        'FROM invitations',
        'JOIN users AS inviter',
        '  ON inviter.id = invitations.inviter_id',
        'WHERE invitations.team_id = $1',
        'ORDER BY invitations.created_at DESC'
      ]),
      [access.team_id]
    );

    return result.rows.map(toInvitationSummary);
  });
}

export async function acceptInvitationByToken(params: {
  token: string;
  userId: string;
}): Promise<InvitationSummary | null | 'forbidden' | 'expired'> {
  return withTransaction(async (client) => {
    const invitation = await findInvitationByToken(client, params.token);

    if (!invitation) return null;
    if (invitation.accepted_user_id !== params.userId) return 'forbidden';

    if (invitation.status !== 'pending' || invitation.expires_at <= new Date()) {
      await client.query(
        "UPDATE invitations SET status = 'expired' WHERE id = $1 AND status = 'pending'",
        [invitation.id]
      );
      return 'expired';
    }

    await client.query(
      sql([
        'INSERT INTO team_members (team_id, user_id, role)',
        'VALUES ($1, $2, $3)',
        'ON CONFLICT (team_id, user_id) DO UPDATE',
        'SET role = EXCLUDED.role'
      ]),
      [invitation.team_id, params.userId, invitation.role]
    );

    const result = await client.query<InvitationRow>(
      sql([
        'UPDATE invitations',
        "SET status = 'accepted', accepted_by = $2, accepted_at = now()",
        'FROM users AS inviter',
        'WHERE invitations.id = $1',
        '  AND inviter.id = invitations.inviter_id',
        'RETURNING',
        '  invitations.id,',
        '  invitations.team_id,',
        '  invitations.email,',
        '  invitations.token,',
        '  invitations.status,',
        '  invitations.role,',
        '  invitations.inviter_id,',
        '  inviter.email AS inviter_email,',
        '  inviter.display_name AS inviter_display_name,',
        '  invitations.accepted_by,',
        '  invitations.accepted_at,',
        '  invitations.expires_at,',
        '  invitations.created_at,',
        '  invitations.updated_at'
      ]),
      [invitation.id, params.userId]
    );

    return toInvitationSummary(result.rows[0]);
  });
}
