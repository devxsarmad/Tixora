import { z } from 'zod';
import { query } from '../../db/pool.js';
import { createTask, listProjectTasks, updateTask } from '../tasks/task.service.js';
import type { TaskSummary } from '../tasks/task.repository.js';

const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
const taskStatusSchema = z.enum(['todo', 'in_progress', 'blocked', 'done']);

const listOverdueTasksSchema = z.object({
  projectId: z.string().uuid().optional()
});

const summarizeAssigneeWorkloadSchema = z.object({
  userId: z.string().uuid().optional(),
  userRef: z.string().trim().min(1).optional(),
  projectId: z.string().uuid().optional()
}).refine((value) => Boolean(value.userId || value.userRef), {
  message: 'Provide a userId or userRef',
  path: ['userRef']
});

const createTaskToolSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).optional(),
  priority: taskPrioritySchema.optional(),
  dueAt: z.string().trim().min(1).nullable().optional(),
  assigneeIds: z.array(z.string().trim().min(1)).max(20).optional()
});

const updateTaskStatusSchema = z.object({
  taskId: z.string().uuid().optional(),
  taskTitle: z.string().trim().min(1).optional(),
  projectId: z.string().uuid().optional(),
  status: taskStatusSchema
}).refine((value) => Boolean(value.taskId || value.taskTitle), {
  message: 'Provide a taskId or taskTitle',
  path: ['taskTitle']
});

export type ToolName =
  | 'list_overdue_tasks'
  | 'summarize_assignee_workload'
  | 'create_task'
  | 'update_task_status';

export type AssistantToolCall = {
  id: string;
  name: ToolName;
  argumentsText: string;
};

export type AssistantToolResult = {
  toolCallId: string;
  toolName: ToolName;
  ok: boolean;
  result: unknown;
};

type ToolTaskRow = {
  id: string;
  project_id: string;
  title: string;
  status: TaskSummary['status'];
  priority: TaskSummary['priority'];
  due_at: string | null;
  project_name: string;
  assignee_count: number;
};

type LookupUserRow = {
  user_id: string;
  email: string;
  display_name: string;
};

type LookupTaskRow = {
  id: string;
  title: string;
  project_name: string;
};

type WorkloadRow = {
  user_id: string;
  display_name: string;
  email: string;
  project_id: string;
  project_name: string;
  todo_count: number;
  in_progress_count: number;
  blocked_count: number;
  done_count: number;
  overdue_count: number;
};

export const assistantToolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'list_overdue_tasks',
      description: 'List overdue tasks the requester can access, optionally scoped to a project.',
      parameters: {
        type: 'object',
        properties: { projectId: { type: 'string', format: 'uuid' } },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'summarize_assignee_workload',
      description: 'Summarize workload for one organization/project member. If the user gives a name or email, pass it as userRef; do not invent a UUID.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
          userRef: { type: 'string', description: 'Exact member name or email from the user request.' },
          projectId: { type: 'string', format: 'uuid' }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a task in a project. If assignees are named by the user, pass names/emails in assigneeIds so the server resolves them against project members.',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          dueAt: { type: ['string', 'null'], description: 'Due date as ISO date-time when possible.' },
          assigneeIds: { type: 'array', items: { type: 'string' }, maxItems: 20, description: 'Project member UUIDs, names, or emails.' }
        },
        required: ['projectId', 'title'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_task_status',
      description: 'Update a task status. If the user gives a ticket title, pass taskTitle; do not require a UUID.',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', format: 'uuid' },
          taskTitle: { type: 'string', description: 'Exact or near-exact ticket title from the user request.' },
          projectId: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['todo', 'in_progress', 'blocked', 'done'] }
        },
        required: ['status'],
        additionalProperties: false
      }
    }
  }
] as const;

function formatZodIssues(error: z.ZodError) {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') + ': ' : '';
      return path + issue.message;
    })
    .join('; ');
}

function parseToolArguments<T>(argumentsText: string, schema: z.ZodType<T>): T {
  let parsed: unknown;
  try {
    parsed = argumentsText ? JSON.parse(argumentsText) : {};
  } catch {
    throw new Error('Tool arguments must be valid JSON');
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error('Invalid tool arguments: ' + formatZodIssues(result.error));
  }

  return result.data;
}

function normalizeLookupValue(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function isUuid(value: string) {
  return z.string().uuid().safeParse(value).success;
}

function resolveOneByReference<T extends { email: string; display_name: string }>(rows: T[], reference: string, label: string) {
  const normalizedReference = normalizeLookupValue(reference);
  const exactMatches = rows.filter(
    (row) =>
      normalizeLookupValue(row.display_name) === normalizedReference ||
      normalizeLookupValue(row.email) === normalizedReference
  );
  const matches = exactMatches.length > 0
    ? exactMatches
    : rows.filter(
        (row) =>
          normalizeLookupValue(row.display_name).includes(normalizedReference) ||
          normalizeLookupValue(row.email).includes(normalizedReference)
      );

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error('Multiple ' + label + ' matched "' + reference + '". Use an exact email.');
  }

  throw new Error('Could not find ' + label + ': ' + reference + '.');
}

async function resolveProjectAssigneeReferences(projectId: string, references: string[] | undefined) {
  const uniqueRefs = [...new Set(references ?? [])].map((reference) => reference.trim()).filter(Boolean);
  if (uniqueRefs.length === 0) return [];

  const result = await query<LookupUserRow>(
    `
      SELECT
        users.id AS user_id,
        users.email,
        users.display_name
      FROM project_members
      JOIN users
        ON users.id = project_members.user_id
      WHERE project_members.project_id = $1
    `,
    [projectId]
  );

  const resolvedIds: string[] = [];

  for (const reference of uniqueRefs) {
    if (isUuid(reference)) {
      resolvedIds.push(reference);
      continue;
    }

    try {
      resolvedIds.push(resolveOneByReference(result.rows, reference, 'project member').user_id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not resolve project member.';
      throw new Error(message + ' Add the person to Project members first or use an exact member email.');
    }
  }

  return [...new Set(resolvedIds)];
}

async function resolveWorkloadUserId(params: { orgId: string; userId?: string; userRef?: string; projectId?: string }) {
  if (params.userId) return params.userId;
  if (!params.userRef) throw new Error('Choose a member by name or email.');

  const result = await query<LookupUserRow>(
    `
      SELECT DISTINCT
        users.id AS user_id,
        users.email,
        users.display_name
      FROM team_members AS tm
      JOIN users
        ON users.id = tm.user_id
      LEFT JOIN project_members AS pm
        ON pm.user_id = users.id
       AND pm.project_id = $2
      LEFT JOIN task_assignees AS ta
        ON ta.user_id = users.id
      LEFT JOIN tasks AS assigned_task
        ON assigned_task.id = ta.task_id
       AND assigned_task.project_id = $2
       AND assigned_task.deleted_at IS NULL
      WHERE tm.team_id = $1
        AND ($2::uuid IS NULL OR pm.user_id IS NOT NULL OR assigned_task.id IS NOT NULL OR tm.role IN ('owner', 'admin'))
    `,
    [params.orgId, params.projectId ?? null]
  );

  return resolveOneByReference(result.rows, params.userRef, 'organization member').user_id;
}

async function findAccessibleTaskByTitle(params: { userId: string; orgId: string; projectId?: string; taskTitle: string }) {
  const queryTasks = async (exactOnly: boolean) => query<LookupTaskRow>(
    `
      SELECT
        task.id,
        task.title,
        p.name AS project_name
      FROM tasks AS task
      JOIN projects AS p
        ON p.id = task.project_id
      JOIN team_members AS tm
        ON tm.team_id = p.team_id
       AND tm.user_id = $2
      LEFT JOIN project_members AS pm
        ON pm.project_id = p.id
       AND pm.user_id = $2
      WHERE p.team_id = $1
        AND ($3::uuid IS NULL OR p.id = $3)
        AND p.deleted_at IS NULL
        AND task.deleted_at IS NULL
        AND (tm.role IN ('owner', 'admin') OR pm.user_id IS NOT NULL)
        AND (
          ($5::boolean = true AND lower(task.title) = lower($4)) OR
          ($5::boolean = false AND lower(task.title) LIKE '%' || lower($4) || '%')
        )
      ORDER BY task.updated_at DESC
      LIMIT 10
    `,
    [params.orgId, params.userId, params.projectId ?? null, params.taskTitle, exactOnly]
  );

  const exactMatches = await queryTasks(true);
  const matches = exactMatches.rows.length > 0 ? exactMatches.rows : (await queryTasks(false)).rows;

  if (matches.length === 1) return matches[0].id;
  if (matches.length > 1) {
    const labels = matches.map((task) => '"' + task.title + '" in ' + task.project_name).join(', ');
    throw new Error('Multiple tickets matched "' + params.taskTitle + '": ' + labels + '. Use the exact ticket title.');
  }

  throw new Error('Could not find an accessible ticket named "' + params.taskTitle + '".');
}

function normalizeDueAt(value: string | null | undefined) {
  if (value === undefined || value === null || value.trim() === '') return value ?? null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Could not understand due date "' + value + '". Use a clear date like 2026-08-31.');
  }
  return parsed.toISOString();
}

function formatTask(task: TaskSummary) {
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueAt: task.dueAt,
    assignees: task.assignees.map((assignee) => ({ id: assignee.id, name: assignee.displayName, email: assignee.email }))
  };
}

async function listOverdueTasks(params: { userId: string; orgId: string; projectId?: string }) {
  if (params.projectId) {
    const tasks = await listProjectTasks({
      projectId: params.projectId,
      userId: params.userId,
      query: { due: 'overdue' }
    });
    return tasks.map(formatTask);
  }

  const result = await query<ToolTaskRow>(
    `
      SELECT
        task.id,
        task.project_id,
        task.title,
        task.status,
        task.priority,
        task.due_at,
        p.name AS project_name,
        COUNT(DISTINCT ta.user_id)::int AS assignee_count
      FROM tasks AS task
      JOIN projects AS p
        ON p.id = task.project_id
      JOIN team_members AS tm
        ON tm.team_id = p.team_id
       AND tm.user_id = $2
      LEFT JOIN project_members AS pm
        ON pm.project_id = p.id
       AND pm.user_id = $2
      LEFT JOIN task_assignees AS ta
        ON ta.task_id = task.id
      WHERE p.team_id = $1
        AND p.deleted_at IS NULL
        AND task.deleted_at IS NULL
        AND task.due_at < now()
        AND task.status <> 'done'
        AND (tm.role IN ('owner', 'admin') OR pm.user_id IS NOT NULL)
      GROUP BY task.id, p.name
      ORDER BY task.due_at ASC
      LIMIT 50
    `,
    [params.orgId, params.userId]
  );

  return result.rows.map((task) => ({
    id: task.id,
    projectId: task.project_id,
    projectName: task.project_name,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueAt: task.due_at,
    assigneeCount: task.assignee_count
  }));
}

async function summarizeAssigneeWorkload(params: {
  userId: string;
  orgId: string;
  targetUserId: string;
  projectId?: string;
}) {
  const result = await query<WorkloadRow>(
    `
      SELECT
        assignee.id AS user_id,
        assignee.display_name,
        assignee.email,
        p.id AS project_id,
        p.name AS project_name,
        COUNT(*) FILTER (WHERE task.status = 'todo')::int AS todo_count,
        COUNT(*) FILTER (WHERE task.status = 'in_progress')::int AS in_progress_count,
        COUNT(*) FILTER (WHERE task.status = 'blocked')::int AS blocked_count,
        COUNT(*) FILTER (WHERE task.status = 'done')::int AS done_count,
        COUNT(*) FILTER (WHERE task.due_at < now() AND task.status <> 'done')::int AS overdue_count
      FROM users AS assignee
      JOIN team_members AS target_team
        ON target_team.user_id = assignee.id
       AND target_team.team_id = $1
      JOIN task_assignees AS ta
        ON ta.user_id = assignee.id
      JOIN tasks AS task
        ON task.id = ta.task_id
      JOIN projects AS p
        ON p.id = task.project_id
      JOIN team_members AS requester_team
        ON requester_team.team_id = p.team_id
       AND requester_team.user_id = $2
      LEFT JOIN project_members AS requester_project
        ON requester_project.project_id = p.id
       AND requester_project.user_id = $2
      WHERE assignee.id = $3
        AND p.team_id = $1
        AND ($4::uuid IS NULL OR p.id = $4)
        AND p.deleted_at IS NULL
        AND task.deleted_at IS NULL
        AND (requester_team.role IN ('owner', 'admin') OR requester_project.user_id IS NOT NULL)
      GROUP BY assignee.id, assignee.display_name, assignee.email, p.id, p.name
      ORDER BY p.name ASC
    `,
    [params.orgId, params.userId, params.targetUserId, params.projectId ?? null]
  );

  return result.rows.map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    projectId: row.project_id,
    projectName: row.project_name,
    counts: {
      todo: row.todo_count,
      inProgress: row.in_progress_count,
      blocked: row.blocked_count,
      done: row.done_count,
      overdue: row.overdue_count
    }
  }));
}

export async function executeAssistantToolCall(params: {
  call: AssistantToolCall;
  userId: string;
  orgId: string;
}): Promise<AssistantToolResult> {
  try {
    if (params.call.name === 'list_overdue_tasks') {
      const args = parseToolArguments(params.call.argumentsText, listOverdueTasksSchema);
      return {
        toolCallId: params.call.id,
        toolName: params.call.name,
        ok: true,
        result: await listOverdueTasks({ userId: params.userId, orgId: params.orgId, projectId: args.projectId })
      };
    }

    if (params.call.name === 'summarize_assignee_workload') {
      const args = parseToolArguments(params.call.argumentsText, summarizeAssigneeWorkloadSchema);
      const targetUserId = await resolveWorkloadUserId({
        orgId: params.orgId,
        userId: args.userId,
        userRef: args.userRef,
        projectId: args.projectId
      });
      return {
        toolCallId: params.call.id,
        toolName: params.call.name,
        ok: true,
        result: await summarizeAssigneeWorkload({
          userId: params.userId,
          orgId: params.orgId,
          targetUserId,
          projectId: args.projectId
        })
      };
    }

    if (params.call.name === 'create_task') {
      const args = parseToolArguments(params.call.argumentsText, createTaskToolSchema);
      const assigneeIds = await resolveProjectAssigneeReferences(args.projectId, args.assigneeIds);
      const task = await createTask({
        projectId: args.projectId,
        userId: params.userId,
        input: {
          title: args.title,
          description: args.description,
          priority: args.priority,
          dueAt: normalizeDueAt(args.dueAt),
          assigneeIds
        }
      });
      return { toolCallId: params.call.id, toolName: params.call.name, ok: true, result: formatTask(task) };
    }

    if (params.call.name === 'update_task_status') {
      const args = parseToolArguments(params.call.argumentsText, updateTaskStatusSchema);
      const taskId = args.taskId ?? await findAccessibleTaskByTitle({
        userId: params.userId,
        orgId: params.orgId,
        projectId: args.projectId,
        taskTitle: args.taskTitle ?? ''
      });
      const task = await updateTask({
        taskId,
        userId: params.userId,
        input: { status: args.status }
      });
      return { toolCallId: params.call.id, toolName: params.call.name, ok: true, result: formatTask(task) };
    }

    return { toolCallId: params.call.id, toolName: params.call.name, ok: false, result: 'Unknown tool' };
  } catch (error) {
    return {
      toolCallId: params.call.id,
      toolName: params.call.name,
      ok: false,
      result: error instanceof Error ? error.message : 'Tool execution failed'
    };
  }
}
