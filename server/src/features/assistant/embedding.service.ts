import { generateEmbedding } from './llmClient.js';
import {
  deleteEmbeddingForSource,
  findCommentEmbeddingSource,
  findTaskEmbeddingSource,
  retrieveRelevantTaskChunks,
  upsertTaskEmbedding
} from './embedding.repository.js';
import type { RetrievalChunk } from './types.js';

async function embedAndUpsertTask(taskId: string) {
  const source = await findTaskEmbeddingSource(taskId);
  if (!source) {
    await deleteEmbeddingForSource('task', taskId);
    return;
  }

  const embedding = await generateEmbedding(source.contentText);
  if (!embedding) return;

  await upsertTaskEmbedding({ ...source, embedding });
}

async function embedAndUpsertComment(commentId: string) {
  const source = await findCommentEmbeddingSource(commentId);
  if (!source) {
    await deleteEmbeddingForSource('comment', commentId);
    return;
  }

  const embedding = await generateEmbedding(source.contentText);
  if (!embedding) return;

  await upsertTaskEmbedding({ ...source, embedding });
}

function runEmbeddingJob(job: () => Promise<void>) {
  void job().catch((error) => {
    console.error('Embedding job failed', error);
  });
}

export function enqueueTaskEmbedding(taskId: string) {
  runEmbeddingJob(() => embedAndUpsertTask(taskId));
}

export function enqueueCommentEmbedding(commentId: string) {
  runEmbeddingJob(() => embedAndUpsertComment(commentId));
}

export async function retrieveRelevantChunks(params: {
  query: string;
  userId: string;
  orgId: string;
  projectId?: string;
  limit?: number;
}): Promise<RetrievalChunk[]> {
  const queryEmbedding = await generateEmbedding(params.query);
  if (!queryEmbedding) return [];

  return retrieveRelevantTaskChunks({
    userId: params.userId,
    orgId: params.orgId,
    projectId: params.projectId,
    queryEmbedding,
    limit: params.limit ?? 8
  });
}
