import { query } from '../../db/pool.js';
import type { EmbeddingContentType, EmbeddingSource, RetrievalChunk } from './types.js';

type TaskEmbeddingSourceRow = {
  task_id: string;
  project_id: string;
  org_id: string;
  title: string;
  description: string | null;
};

type CommentEmbeddingSourceRow = {
  comment_id: string;
  task_id: string;
  project_id: string;
  org_id: string;
  body: string;
  task_title: string;
};

type RetrievalChunkRow = {
  id: string;
  task_id: string;
  project_id: string;
  org_id: string;
  content_type: EmbeddingContentType;
  source_id: string;
  content_text: string;
  score: string;
  task_title: string;
  comment_id: string | null;
};

function toVectorLiteral(embedding: number[]) {
  return '[' + embedding.join(',') + ']';
}

function normalizeContentText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function buildTaskContent(row: TaskEmbeddingSourceRow) {
  const content = row.description
    ? 'Task: ' + row.title + '\nDescription: ' + row.description
    : 'Task: ' + row.title;
  return normalizeContentText(content).slice(0, 12000);
}

export async function findTaskEmbeddingSource(taskId: string): Promise<EmbeddingSource | null> {
  const result = await query<TaskEmbeddingSourceRow>(
    `
      SELECT
        task.id AS task_id,
        task.project_id,
        p.team_id AS org_id,
        task.title,
        task.description
      FROM tasks AS task
      JOIN projects AS p
        ON p.id = task.project_id
      WHERE task.id = $1
        AND task.deleted_at IS NULL
        AND p.deleted_at IS NULL
    `,
    [taskId]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    taskId: row.task_id,
    projectId: row.project_id,
    orgId: row.org_id,
    contentType: 'task',
    sourceId: row.task_id,
    contentText: buildTaskContent(row)
  };
}

export async function findCommentEmbeddingSource(commentId: string): Promise<EmbeddingSource | null> {
  const result = await query<CommentEmbeddingSourceRow>(
    `
      SELECT
        comments.id AS comment_id,
        comments.task_id,
        task.project_id,
        p.team_id AS org_id,
        comments.body,
        task.title AS task_title
      FROM comments
      JOIN tasks AS task
        ON task.id = comments.task_id
      JOIN projects AS p
        ON p.id = task.project_id
      WHERE comments.id = $1
        AND comments.deleted_at IS NULL
        AND task.deleted_at IS NULL
        AND p.deleted_at IS NULL
    `,
    [commentId]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    taskId: row.task_id,
    projectId: row.project_id,
    orgId: row.org_id,
    contentType: 'comment',
    sourceId: row.comment_id,
    contentText: normalizeContentText('Comment on ' + row.task_title + ': ' + row.body).slice(0, 12000)
  };
}

export async function upsertTaskEmbedding(params: EmbeddingSource & { embedding: number[] }) {
  await query(
    `
      INSERT INTO task_embeddings (
        task_id,
        project_id,
        org_id,
        content_type,
        source_id,
        embedding,
        content_text
      )
      VALUES ($1, $2, $3, $4, $5, $6::vector, $7)
      ON CONFLICT (content_type, source_id)
      DO UPDATE SET
        task_id = EXCLUDED.task_id,
        project_id = EXCLUDED.project_id,
        org_id = EXCLUDED.org_id,
        embedding = EXCLUDED.embedding,
        content_text = EXCLUDED.content_text,
        updated_at = now()
    `,
    [
      params.taskId,
      params.projectId,
      params.orgId,
      params.contentType,
      params.sourceId,
      toVectorLiteral(params.embedding),
      params.contentText
    ]
  );
}

export async function deleteEmbeddingForSource(contentType: EmbeddingContentType, sourceId: string) {
  await query(
    'DELETE FROM task_embeddings WHERE content_type = $1 AND source_id = $2',
    [contentType, sourceId]
  );
}

export async function retrieveRelevantTaskChunks(params: {
  userId: string;
  orgId: string;
  projectId?: string;
  queryEmbedding: number[];
  limit?: number;
}): Promise<RetrievalChunk[]> {
  const result = await query<RetrievalChunkRow>(
    `
      SELECT
        embedding.id,
        embedding.task_id,
        embedding.project_id,
        embedding.org_id,
        embedding.content_type,
        embedding.source_id,
        embedding.content_text,
        (1 - (embedding.embedding <=> $4::vector))::text AS score,
        task.title AS task_title,
        CASE WHEN embedding.content_type = 'comment' THEN embedding.source_id ELSE NULL END AS comment_id
      FROM task_embeddings AS embedding
      JOIN tasks AS task
        ON task.id = embedding.task_id
       AND task.deleted_at IS NULL
      JOIN projects AS p
        ON p.id = embedding.project_id
       AND p.deleted_at IS NULL
      WHERE embedding.org_id = $1
        AND ($2::uuid IS NULL OR embedding.project_id = $2)
        AND embedding.project_id IN (
          SELECT accessible_project.id
          FROM projects AS accessible_project
          JOIN team_members AS requester_team
            ON requester_team.team_id = accessible_project.team_id
           AND requester_team.user_id = $3
          LEFT JOIN project_members AS requester_project
            ON requester_project.project_id = accessible_project.id
           AND requester_project.user_id = $3
          WHERE accessible_project.team_id = $1
            AND accessible_project.deleted_at IS NULL
            AND (
              requester_team.role IN ('owner', 'admin')
              OR requester_project.user_id IS NOT NULL
            )
        )
      ORDER BY embedding.embedding <=> $4::vector
      LIMIT $5
    `,
    [
      params.orgId,
      params.projectId ?? null,
      params.userId,
      toVectorLiteral(params.queryEmbedding),
      params.limit ?? 8
    ]
  );

  return result.rows.map((row) => ({
    id: row.id,
    taskId: row.task_id,
    projectId: row.project_id,
    orgId: row.org_id,
    contentType: row.content_type,
    sourceId: row.source_id,
    contentText: row.content_text,
    score: Number(row.score),
    taskTitle: row.task_title,
    commentId: row.comment_id
  }));
}
