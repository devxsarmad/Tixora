// Usage:
// Raw SQL for task reads/writes. Task access is derived through project/team
// membership joins, and assignment changes are transaction-safe.

import type pg from 'pg';
import { query, withTransaction } from '../../db/pool.js';

type TeamRole = 'owner' | 'admin' | 'member';
type ProjectRole = 'manager' | 'contributor' | 'viewer';
type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TaskEventSummary = {
  id: string;
  taskId: string;
  actorType: 'user' | 'ai_assistant';
  field: string;
  oldValue: string | null;
  newValue: string | null;
  actor: {
    id: string | null;
    email: string | null;
    displayName: string | null;
  };
  createdAt: Date;
};

export type TaskSummary = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  createdBy: string;
  dueAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  commentCount: number;
  assignees: Array<{
    id: string;
    email: string;
    displayName: string;
    hasProjectAccess: boolean;
  }>;
};

export type TaskDetail = TaskSummary & {
  events: TaskEventSummary[];
};

type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  created_by: string;
  due_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  comment_count: number;
  assignees: TaskSummary['assignees'];
};

type TaskEventRow = {
  id: string;
  task_id: string;
  actor_type: 'user' | 'ai_assistant';
  field: string;
  old_value: string | null;
  new_value: string | null;
  actor_id: string | null;
  actor_email: string | null;
  actor_display_name: string | null;
  created_at: Date;
};

type ProjectAccessRow = {
  project_id: string;
  team_role: TeamRole;
  project_role: ProjectRole | null;
  archived_at: Date | null;
};

type TaskAccessRow = ProjectAccessRow & {
  task_id: string;
  created_by: string;
  user_id: string;
  is_assignee: boolean;
};

function toTaskEventSummary(row: TaskEventRow): TaskEventSummary {
  return {
    id: row.id,
    taskId: row.task_id,
    actorType: row.actor_type,
    field: row.field,
    oldValue: row.old_value,
    newValue: row.new_value,
    actor: {
      id: row.actor_id,
      email: row.actor_email,
      displayName: row.actor_display_name
    },
    createdAt: row.created_at
  };
}

function toTaskSummary(row: TaskRow): TaskSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    createdBy: row.created_by,
    dueAt: row.due_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    commentCount: Number(row.comment_count),
    assignees: row.assignees
  };
}

function canWriteTask(access: ProjectAccessRow): boolean {
  return (
    access.team_role === 'owner' ||
    access.team_role === 'admin' ||
    access.project_role === 'manager' ||
    access.project_role === 'contributor'
  );
}

function canManageTask(access: TaskAccessRow): boolean {
  return (
    access.team_role === 'owner' ||
    access.team_role === 'admin' ||
    access.project_role === 'manager' ||
    access.created_by === access.user_id ||
    access.is_assignee
  );
}

async function findProjectAccessForUser(
  client: pg.PoolClient,
  params: { projectId: string; userId: string }
): Promise<ProjectAccessRow | null> {
  const result = await client.query<ProjectAccessRow>(
    `
      SELECT
        p.id AS project_id,
        tm.role AS team_role,
        pm.role AS project_role,
        p.archived_at
      FROM projects AS p
      JOIN team_members AS tm
        ON tm.team_id = p.team_id
       AND tm.user_id = $2
      LEFT JOIN project_members AS pm
        ON pm.project_id = p.id
       AND pm.user_id = $2
      WHERE p.id = $1
        AND p.deleted_at IS NULL
        AND (
          tm.role IN ('owner', 'admin')
          OR pm.user_id IS NOT NULL
        )
      LIMIT 1
    `,
    [params.projectId, params.userId]
  );

  return result.rows[0] ?? null;
}

async function findTaskAccessForUser(
  client: pg.PoolClient,
  params: { taskId: string; userId: string }
): Promise<TaskAccessRow | null> {
  const result = await client.query<TaskAccessRow>(
    `
      SELECT
        task.id AS task_id,
        task.project_id,
        task.created_by,
        $2::uuid AS user_id,
        tm.role AS team_role,
        pm.role AS project_role,
        p.archived_at,
        EXISTS (
          SELECT 1
          FROM task_assignees AS ta
          WHERE ta.task_id = task.id
            AND ta.user_id = $2
        ) AS is_assignee
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

async function findInvalidProjectAssignees(
  client: pg.PoolClient,
  params: { projectId: string; assigneeIds: string[] }
): Promise<string[]> {
  if (params.assigneeIds.length === 0) {
    return [];
  }

  const result = await client.query<{ user_id: string }>(
    `
      SELECT user_id
      FROM project_members
      WHERE project_id = $1
        AND user_id = ANY($2::uuid[])
    `,
    [params.projectId, params.assigneeIds]
  );

  const valid = new Set(result.rows.map((row) => row.user_id));

  return params.assigneeIds.filter((id) => !valid.has(id));
}

async function insertTaskEvent(
  client: pg.PoolClient,
  params: {
    taskId: string;
    actorId: string;
    field: string;
    oldValue?: string | null;
    newValue?: string | null;
  }
) {
  await client.query(
    `
      INSERT INTO task_events (task_id, actor_id, field, old_value, new_value)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [
      params.taskId,
      params.actorId,
      params.field,
      params.oldValue ?? null,
      params.newValue ?? null
    ]
  );
}

async function listTaskEvents(
  client: pg.PoolClient,
  params: { taskId: string }
): Promise<TaskEventSummary[]> {
  const result = await client.query<TaskEventRow>(
    `
      SELECT
        task_events.id,
        task_events.task_id,
        task_events.actor_type,
        task_events.field,
        task_events.old_value,
        task_events.new_value,
        task_events.actor_id,
        users.email AS actor_email,
        users.display_name AS actor_display_name,
        task_events.created_at
      FROM task_events
      LEFT JOIN users
        ON users.id = task_events.actor_id
      WHERE task_events.task_id = $1
      ORDER BY task_events.created_at ASC
    `,
    [params.taskId]
  );

  return result.rows.map(toTaskEventSummary);
}

async function insertTaskAssignees(
  client: pg.PoolClient,
  params: { taskId: string; assigneeIds: string[]; assignedBy: string }
) {
  if (params.assigneeIds.length === 0) {
    return;
  }

  await client.query(
    `
      INSERT INTO task_assignees (task_id, user_id, assigned_by)
      SELECT $1, assignee_id, $3
      FROM unnest($2::uuid[]) AS assignee_id
      ON CONFLICT (task_id, user_id) DO NOTHING
    `,
    [params.taskId, params.assigneeIds, params.assignedBy]
  );
}

async function findTaskByIdForUser(
  client: pg.PoolClient,
  params: { taskId: string; userId: string }
): Promise<TaskSummary | null> {
  const result = await client.query<TaskRow>(
    `
      SELECT
        task.id,
        task.project_id,
        task.title,
        task.description,
        task.status,
        task.priority,
        task.created_by,
        task.due_at,
        task.completed_at,
        task.created_at,
        task.updated_at,
        COUNT(DISTINCT comments.id)::int AS comment_count,
        COALESCE(
          json_agg(
            json_build_object(
              'id', u.id,
              'email', u.email,
              'displayName', u.display_name,
              'hasProjectAccess', project_assignee.user_id IS NOT NULL
            )
            ORDER BY ta.assigned_at ASC
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'::json
        ) AS assignees
      FROM tasks AS task
      JOIN projects AS p
        ON p.id = task.project_id
      JOIN team_members AS tm
        ON tm.team_id = p.team_id
       AND tm.user_id = $2
      LEFT JOIN task_assignees AS ta
        ON ta.task_id = task.id
      LEFT JOIN comments
        ON comments.task_id = task.id
      LEFT JOIN users AS u
        ON u.id = ta.user_id
      LEFT JOIN project_members AS project_assignee
        ON project_assignee.project_id = task.project_id
       AND project_assignee.user_id = ta.user_id
      WHERE task.id = $1
        AND task.deleted_at IS NULL
        AND (
          tm.role IN ('owner', 'admin')
          OR EXISTS (
            SELECT 1
            FROM project_members AS requester_project
            WHERE requester_project.project_id = task.project_id
              AND requester_project.user_id = $2
          )
        )
      GROUP BY task.id
    `,
    [params.taskId, params.userId]
  );

  return result.rows[0] ? toTaskSummary(result.rows[0]) : null;
}

export async function createTaskForProject(params: {
  projectId: string;
  userId: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueAt?: string | null;
  assigneeIds: string[];
}): Promise<TaskSummary | null | 'forbidden' | { invalidAssigneeIds: string[] }> {
  return withTransaction(async (client) => {
    const access = await findProjectAccessForUser(client, params);

    if (!access) {
      return null;
    }

    if (access.archived_at || !canWriteTask(access)) {
      return 'forbidden';
    }

    const invalidAssigneeIds = await findInvalidProjectAssignees(client, {
      projectId: params.projectId,
      assigneeIds: params.assigneeIds
    });

    if (invalidAssigneeIds.length > 0) {
      return { invalidAssigneeIds };
    }

    const result = await client.query<{ id: string }>(
      `
        INSERT INTO tasks (
          project_id,
          title,
          description,
          status,
          priority,
          created_by,
          due_at,
          completed_at
        )
        VALUES (
          $1,
          $2,
          $3,
          COALESCE($4::task_status, 'todo'),
          COALESCE($5::task_priority, 'medium'),
          $6,
          $7,
          CASE WHEN $4::task_status = 'done' THEN now() ELSE NULL END
        )
        RETURNING id
      `,
      [
        params.projectId,
        params.title,
        params.description ?? null,
        params.status ?? null,
        params.priority ?? null,
        params.userId,
        params.dueAt ?? null
      ]
    );

    const taskId = result.rows[0].id;

    await insertTaskAssignees(client, {
      taskId,
      assigneeIds: params.assigneeIds,
      assignedBy: params.userId
    });

    await insertTaskEvent(client, {
      taskId,
      actorId: params.userId,
      field: 'created',
      newValue: params.title
    });

    if (params.assigneeIds.length > 0) {
      await insertTaskEvent(client, {
        taskId,
        actorId: params.userId,
        field: 'assignees',
        newValue: params.assigneeIds.join(',')
      });
    }

    return findTaskByIdForUser(client, { taskId, userId: params.userId });
  });
}

export async function listTasksForProject(params: {
  projectId: string;
  userId: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  due?: 'overdue' | 'upcoming';
}): Promise<TaskSummary[] | null> {
  const result = await query<TaskRow>(
    `
      SELECT
        task.id,
        task.project_id,
        task.title,
        task.description,
        task.status,
        task.priority,
        task.created_by,
        task.due_at,
        task.completed_at,
        task.created_at,
        task.updated_at,
        COUNT(DISTINCT comments.id)::int AS comment_count,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', u.id,
              'email', u.email,
              'displayName', u.display_name,
              'hasProjectAccess', project_assignee.user_id IS NOT NULL
            )
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'::json
        ) AS assignees
      FROM projects AS p
      JOIN team_members AS tm
        ON tm.team_id = p.team_id
       AND tm.user_id = $2
      LEFT JOIN project_members AS requester_project
        ON requester_project.project_id = p.id
       AND requester_project.user_id = $2
      JOIN tasks AS task
        ON task.project_id = p.id
      LEFT JOIN task_assignees AS ta
        ON ta.task_id = task.id
      LEFT JOIN comments
        ON comments.task_id = task.id
      LEFT JOIN users AS u
        ON u.id = ta.user_id
      LEFT JOIN project_members AS project_assignee
        ON project_assignee.project_id = task.project_id
       AND project_assignee.user_id = ta.user_id
      WHERE p.id = $1
        AND p.deleted_at IS NULL
        AND task.deleted_at IS NULL
        AND (
          tm.role IN ('owner', 'admin')
          OR requester_project.user_id IS NOT NULL
        )
        AND ($3::task_status IS NULL OR task.status = $3)
        AND ($4::task_priority IS NULL OR task.priority = $4)
        AND ($5::uuid IS NULL OR EXISTS (
          SELECT 1
          FROM task_assignees AS filter_assignee
          WHERE filter_assignee.task_id = task.id
            AND filter_assignee.user_id = $5
        ))
        AND (
          $6::text IS NULL
          OR ($6 = 'overdue' AND task.due_at < now() AND task.status <> 'done')
          OR ($6 = 'upcoming' AND task.due_at >= now() AND task.status <> 'done')
        )
      GROUP BY task.id
      ORDER BY task.updated_at DESC
    `,
    [
      params.projectId,
      params.userId,
      params.status ?? null,
      params.priority ?? null,
      params.assigneeId ?? null,
      params.due ?? null
    ]
  );

  if (result.rows.length === 0) {
    const projectExists = await query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM projects AS p
          JOIN team_members AS tm
            ON tm.team_id = p.team_id
           AND tm.user_id = $2
          LEFT JOIN project_members AS requester_project
            ON requester_project.project_id = p.id
           AND requester_project.user_id = $2
          WHERE p.id = $1
            AND p.deleted_at IS NULL
            AND (
              tm.role IN ('owner', 'admin')
              OR requester_project.user_id IS NOT NULL
            )
        ) AS exists
      `,
      [params.projectId, params.userId]
    );

    if (!projectExists.rows[0]?.exists) {
      return null;
    }
  }

  return result.rows.map(toTaskSummary);
}

export async function findTaskDetailForUser(params: {
  taskId: string;
  userId: string;
}): Promise<TaskDetail | null> {
  return withTransaction(async (client) => {
    const task = await findTaskByIdForUser(client, params);

    if (!task) return null;

    return {
      ...task,
      events: await listTaskEvents(client, { taskId: params.taskId })
    };
  });
}

export async function updateTaskForUser(params: {
  taskId: string;
  userId: string;
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueAt?: string | null;
}): Promise<TaskSummary | null | 'forbidden'> {
  return withTransaction(async (client) => {
    const access = await findTaskAccessForUser(client, params);

    if (!access) {
      return null;
    }

    if (access.archived_at || !canManageTask(access)) {
      return 'forbidden';
    }

    const before = await findTaskByIdForUser(client, params);

    if (!before) return null;

    await client.query(
      `
        UPDATE tasks AS task
        SET
          title = COALESCE($2, task.title),
          description = CASE WHEN $3::boolean THEN $4 ELSE task.description END,
          status = COALESCE($5::task_status, task.status),
          priority = COALESCE($6::task_priority, task.priority),
          due_at = CASE WHEN $7::boolean THEN $8 ELSE task.due_at END,
          completed_at = CASE
            WHEN $5::task_status = 'done' AND task.completed_at IS NULL THEN now()
            WHEN $5::task_status IS NOT NULL AND $5::task_status <> 'done' THEN NULL
            ELSE task.completed_at
          END
        WHERE task.id = $1
      `,
      [
        params.taskId,
        params.title ?? null,
        params.description !== undefined,
        params.description ?? null,
        params.status ?? null,
        params.priority ?? null,
        params.dueAt !== undefined,
        params.dueAt ?? null
      ]
    );

    const after = await findTaskByIdForUser(client, params);

    if (!after) return null;

    const changedFields: Array<keyof Pick<TaskSummary, 'title' | 'description' | 'status' | 'priority' | 'dueAt'>> = [
      'title',
      'description',
      'status',
      'priority',
      'dueAt'
    ];

    for (const field of changedFields) {
      const oldValue = before[field] instanceof Date ? before[field]?.toISOString() : before[field];
      const newValue = after[field] instanceof Date ? after[field]?.toISOString() : after[field];

      if ((oldValue ?? null) !== (newValue ?? null)) {
        await insertTaskEvent(client, {
          taskId: params.taskId,
          actorId: params.userId,
          field,
          oldValue: oldValue == null ? null : String(oldValue),
          newValue: newValue == null ? null : String(newValue)
        });
      }
    }

    return after;
  });
}

export async function replaceTaskAssigneesForUser(params: {
  taskId: string;
  userId: string;
  assigneeIds: string[];
}): Promise<TaskSummary | null | 'forbidden' | { invalidAssigneeIds: string[] }> {
  return withTransaction(async (client) => {
    const access = await findTaskAccessForUser(client, params);

    if (!access) {
      return null;
    }

    if (access.archived_at || !canManageTask(access)) {
      return 'forbidden';
    }

    const invalidAssigneeIds = await findInvalidProjectAssignees(client, {
      projectId: access.project_id,
      assigneeIds: params.assigneeIds
    });

    if (invalidAssigneeIds.length > 0) {
      return { invalidAssigneeIds };
    }

    const before = await findTaskByIdForUser(client, params);

    await client.query('DELETE FROM task_assignees WHERE task_id = $1', [
      params.taskId
    ]);

    await insertTaskAssignees(client, {
      taskId: params.taskId,
      assigneeIds: params.assigneeIds,
      assignedBy: params.userId
    });

    await insertTaskEvent(client, {
      taskId: params.taskId,
      actorId: params.userId,
      field: 'assignees',
      oldValue: before?.assignees.map((assignee) => assignee.id).join(',') ?? null,
      newValue: params.assigneeIds.join(',')
    });

    return findTaskByIdForUser(client, params);
  });
}
