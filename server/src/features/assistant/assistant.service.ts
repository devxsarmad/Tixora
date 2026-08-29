import { HttpError } from '../../shared/http-error.js';
import { generateGroundedAnswer } from './llmClient.js';
import { resolveAssistantScope } from './assistant.repository.js';
import { retrieveRelevantChunks } from './embedding.service.js';
import type { AskAssistantInput } from './assistant.schemas.js';
import type { RetrievalChunk } from './types.js';

function buildContext(chunks: RetrievalChunk[]) {
  return chunks
    .map((chunk, index) => {
      const sourceLabel = chunk.contentType === 'comment'
        ? 'comment ' + chunk.sourceId + ' on task ' + chunk.taskId
        : 'task ' + chunk.taskId;
      return [
        'SOURCE ' + (index + 1),
        'Type: ' + chunk.contentType,
        'Source: ' + sourceLabel,
        'Task title: ' + chunk.taskTitle,
        'Content: ' + chunk.contentText
      ].join('\n');
    })
    .join('\n\n');
}

function buildFallbackAnswer(chunks: RetrievalChunk[]) {
  if (chunks.length === 0) return "I don't have enough information.";

  const taskTitles = [...new Set(chunks.map((chunk) => chunk.taskTitle))].slice(0, 3);
  return (
    'I found related Tixora items, but the AI answer model is not configured yet. Relevant tasks: ' +
    taskTitles.join(', ')
  );
}

export async function askAssistant(params: {
  userId: string;
  orgSlug?: string;
  input: AskAssistantInput;
}) {
  const scope = await resolveAssistantScope({
    userId: params.userId,
    orgSlug: params.orgSlug,
    projectId: params.input.projectId
  });

  if (!scope) {
    throw new HttpError(404, 'Assistant scope not found', 'ASSISTANT_SCOPE_NOT_FOUND');
  }

  const chunks = await retrieveRelevantChunks({
    query: params.input.query,
    userId: params.userId,
    orgId: scope.orgId,
    projectId: params.input.projectId,
    limit: 8
  });

  const answer = await generateGroundedAnswer({
    query: params.input.query,
    context: buildContext(chunks)
  });

  return {
    answer: answer ?? buildFallbackAnswer(chunks),
    sources: chunks.map((chunk) => ({
      taskId: chunk.taskId,
      projectId: chunk.projectId,
      contentType: chunk.contentType,
      sourceId: chunk.sourceId,
      commentId: chunk.commentId,
      taskTitle: chunk.taskTitle,
      score: chunk.score
    }))
  };
}
