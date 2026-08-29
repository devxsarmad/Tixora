// Usage:
// Comment business rules: map repository outcomes into stable API responses and
// keep route handlers thin.

import { enqueueCommentEmbedding } from '../assistant/embedding.service.js';
import { HttpError } from '../../shared/http-error.js';
import {
  createCommentForTask,
  listCommentsForTask,
  softDeleteCommentForUser,
  updateCommentForUser
} from './comment.repository.js';
import type {
  CreateCommentInput,
  ListCommentsQuery,
  UpdateCommentInput
} from './comment.schemas.js';

function handleCommentWriteResult<T>(result: T | null | 'forbidden'): T {
  if (result === 'forbidden') {
    throw new HttpError(403, 'Comment permission denied', 'COMMENT_FORBIDDEN');
  }

  if (!result) {
    throw new HttpError(404, 'Comment not found', 'COMMENT_NOT_FOUND');
  }

  return result;
}

export async function createComment(params: {
  taskId: string;
  userId: string;
  input: CreateCommentInput;
}) {
  const result = await createCommentForTask({
    taskId: params.taskId,
    userId: params.userId,
    body: params.input.body
  });

  if (!result) {
    throw new HttpError(404, 'Task not found', 'TASK_NOT_FOUND');
  }

  const comment = handleCommentWriteResult(result);
  enqueueCommentEmbedding(comment.id);
  return comment;
}

export async function listTaskComments(params: {
  taskId: string;
  userId: string;
  query: ListCommentsQuery;
}) {
  const page = await listCommentsForTask({
    taskId: params.taskId,
    userId: params.userId,
    after: params.query.after,
    limit: params.query.limit
  });

  if (!page) {
    throw new HttpError(404, 'Task not found', 'TASK_NOT_FOUND');
  }

  return page;
}

export async function updateComment(params: {
  commentId: string;
  userId: string;
  input: UpdateCommentInput;
}) {
  const result = await updateCommentForUser({
    commentId: params.commentId,
    userId: params.userId,
    body: params.input.body
  });

  const comment = handleCommentWriteResult(result);
  enqueueCommentEmbedding(comment.id);
  return comment;
}

export async function deleteComment(params: {
  commentId: string;
  userId: string;
}) {
  const result = await softDeleteCommentForUser(params);

  return handleCommentWriteResult(result);
}
