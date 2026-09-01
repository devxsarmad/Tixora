// Usage:
// Raw SQL for task comments. Comment access is derived through task -> project ->
// team membership, and normal reads exclude soft-deleted rows.

import type pg from 'pg';
import { query, withTransaction } from '../../db/pool.js';

type TeamRole = 'owner' | 'admin' | 'member';
type ProjectRole = 'manager' | 'contributor' | 'viewer';

export type CommentSummary = {
  id: string;
  taskId: string;
  author: {
    id: string;
    email: string;
    displayName: string;
  };
  body: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CommentPage = {
  comments: CommentSummary[];
  nextCursor: Date | null;
};

type CommentRow = {
  id: string;
  task_id: string;
  author_id: string;
  author_email: string;
  author_display_name: string;
  body: string;
  created_at: Date;
  updated_at: Date;
};

type TaskAccessRow = {
  task_id: string;
  team_role: TeamRole;
  project_role: ProjectRole | null;
  archived_at: Date | null;
};

type CommentAccessRow = TaskAccessRow & {
  comment_id: string;
  author_id: string;
};

function toCommentSummary(row: CommentRow): CommentSummary {
  return {
    id: row.id,
    taskId: row.task_id,
    author: {
      id: row.author_id,
      email: row.author_email,
      displayName: row.author_display_name
    },
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function canDeleteComment(params: {
  userId: string;
  authorId: string;
  teamRole: TeamRole;
  projectRole: ProjectRole | null;
}): boolean {
  return (
    params.userId === params.authorId ||
    params.teamRole === 'owner' ||
    params.teamRole === 'admin' ||
    params.projectRole === 'manager'
  );
}

async function findTaskAccessForUser(
  client: pg.PoolClient,
  params: { taskId: string; userId: string }
): Promise<TaskAccessRow | null> {
  const result = await client.query<TaskAccessRow>(
    `
      SELECT
        task.id AS task_id,
        tm.role AS team_role,
        pm.role AS project_role,
        p.archived_at
      FROM tasks AS task
      JOIN projects AS p
        ON p.id = task.project_id
      JOIN team_members AS tm
        ON tm.team_id = p.team_id
       AND tm.user_id = $2
      LEFT JOIN project_members AS pm
        ON pm.project_id = p.id
       AND pm.user_id = $2
      WHERE task.id = $1
        AND task.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND (
          tm.role IN ('owner', 'admin')
          OR pm.user_id IS NOT NULL
        )
      LIMIT 1
    `,
    [params.taskId, params.userId]
  );

  return result.rows[0] ?? null;
}

async function findCommentAccessForUser(
  client: pg.PoolClient,
  params: { commentId: string; userId: string }
): Promise<CommentAccessRow | null> {
  const result = await client.query<CommentAccessRow>(
    `
      SELECT
        comments.id AS comment_id,
        comments.author_id,
        task.id AS task_id,
        tm.role AS team_role,
        pm.role AS project_role,
        p.archived_at
      FROM comments
      JOIN tasks AS task
        ON task.id = comments.task_id
      JOIN projects AS p
        ON p.id = task.project_id
      JOIN team_members AS tm
        ON tm.team_id = p.team_id
       AND tm.user_id = $2
      LEFT JOIN project_members AS pm
        ON pm.project_id = p.id
       AND pm.user_id = $2
      WHERE comments.id = $1
        AND comments.deleted_at IS NULL
        AND task.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND (
          tm.role IN ('owner', 'admin')
          OR pm.user_id IS NOT NULL
        )
      LIMIT 1
    `,
    [params.commentId, params.userId]
  );

  return result.rows[0] ?? null;
}

export async function createCommentForTask(params: {
  taskId: string;
  userId: string;
  body: string;
}): Promise<CommentSummary | null | 'forbidden'> {
  return withTransaction(async (client) => {
    const access = await findTaskAccessForUser(client, params);

    if (!access) {
      return null;
    }

    if (access.archived_at) {
      return 'forbidden';
    }

    const result = await client.query<CommentRow>(
      `
        INSERT INTO comments (task_id, author_id, body)
        VALUES ($1, $2, $3)
        RETURNING
          id,
          task_id,
          author_id,
          (
            SELECT email
            FROM users
            WHERE users.id = comments.author_id
          ) AS author_email,
          (
            SELECT display_name
            FROM users
            WHERE users.id = comments.author_id
          ) AS author_display_name,
          body,
          created_at,
          updated_at
      `,
      [params.taskId, params.userId, params.body]
    );

    return toCommentSummary(result.rows[0]);
  });
}

export async function listCommentsForTask(params: {
  taskId: string;
  userId: string;
  after?: string;
  limit: number;
}): Promise<CommentPage | null> {
  const result = await query<CommentRow>(
    `
      SELECT
        comments.id,
        comments.task_id,
        comments.author_id,
        users.email AS author_email,
        users.display_name AS author_display_name,
        comments.body,
        comments.created_at,
        comments.updated_at
      FROM tasks AS task
      JOIN projects AS p
        ON p.id = task.project_id
      JOIN team_members AS tm
        ON tm.team_id = p.team_id
       AND tm.user_id = $2
      LEFT JOIN project_members AS requester_project
        ON requester_project.project_id = p.id
       AND requester_project.user_id = $2
      JOIN comments
        ON comments.task_id = task.id
       AND comments.deleted_at IS NULL
      JOIN users
        ON users.id = comments.author_id
      WHERE task.id = $1
        AND task.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND (
          tm.role IN ('owner', 'admin')
          OR requester_project.user_id IS NOT NULL
        )
        AND ($3::timestamptz IS NULL OR comments.created_at > $3)
      ORDER BY comments.created_at ASC
      LIMIT $4
    `,
    [params.taskId, params.userId, params.after ?? null, params.limit + 1]
  );

  if (result.rows.length === 0) {
    const taskExists = await query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM tasks AS task
          JOIN projects AS p
            ON p.id = task.project_id
          JOIN team_members AS tm
            ON tm.team_id = p.team_id
           AND tm.user_id = $2
          LEFT JOIN project_members AS requester_project
            ON requester_project.project_id = p.id
           AND requester_project.user_id = $2
          WHERE task.id = $1
            AND task.deleted_at IS NULL
            AND p.deleted_at IS NULL
            AND (
              tm.role IN ('owner', 'admin')
              OR requester_project.user_id IS NOT NULL
            )
        ) AS exists
      `,
      [params.taskId, params.userId]
    );

    if (!taskExists.rows[0]?.exists) {
      return null;
    }
  }

  const pageRows = result.rows.slice(0, params.limit);
  const overflowRow = result.rows[params.limit];

  return {
    comments: pageRows.map(toCommentSummary),
    nextCursor: overflowRow?.created_at ?? null
  };
}

export async function updateCommentForUser(params: {
  commentId: string;
  userId: string;
  body: string;
}): Promise<CommentSummary | null | 'forbidden'> {
  return withTransaction(async (client) => {
    const access = await findCommentAccessForUser(client, params);

    if (!access) {
      return null;
    }

    if (access.archived_at || access.author_id !== params.userId) {
      return 'forbidden';
    }

    const result = await client.query<CommentRow>(
      `
        UPDATE comments
        SET body = $2
        FROM users
        WHERE comments.id = $1
          AND users.id = comments.author_id
        RETURNING
          comments.id,
          comments.task_id,
          comments.author_id,
          users.email AS author_email,
          users.display_name AS author_display_name,
          comments.body,
          comments.created_at,
          comments.updated_at
      `,
      [params.commentId, params.body]
    );

    return toCommentSummary(result.rows[0]);
  });
}

export async function softDeleteCommentForUser(params: {
  commentId: string;
  userId: string;
}): Promise<CommentSummary | null | 'forbidden'> {
  return withTransaction(async (client) => {
    const access = await findCommentAccessForUser(client, params);

    if (!access) {
      return null;
    }

    if (access.archived_at) {
      return 'forbidden';
    }

    if (
      !canDeleteComment({
        userId: params.userId,
        authorId: access.author_id,
        teamRole: access.team_role,
        projectRole: access.project_role
      })
    ) {
      return 'forbidden';
    }

    const result = await client.query<CommentRow>(
      `
        UPDATE comments
        SET deleted_at = now()
        FROM users
        WHERE comments.id = $1
          AND users.id = comments.author_id
        RETURNING
          comments.id,
          comments.task_id,
          comments.author_id,
          users.email AS author_email,
          users.display_name AS author_display_name,
          comments.body,
          comments.created_at,
          comments.updated_at
      `,
      [params.commentId]
    );

    return toCommentSummary(result.rows[0]);
  });
}
