import { apiRequest } from '../../api/http.js';
import type { CommentSummary } from './types.js';

export function listComments(taskId: string) {
  return apiRequest<{ comments: CommentSummary[]; nextCursor: string | null }>('/api/tasks/' + taskId + '/comments?limit=20');
}

export function createComment(taskId: string, input: { body: string }) {
  return apiRequest<{ comment: CommentSummary }>('/api/tasks/' + taskId + '/comments', { method: 'POST', body: JSON.stringify(input) });
}

export function updateComment(commentId: string, body: string) {
  return apiRequest<{ comment: CommentSummary }>('/api/comments/' + commentId, { method: 'PATCH', body: JSON.stringify({ body }) });
}

export function deleteComment(commentId: string) {
  return apiRequest<{ comment: CommentSummary }>('/api/comments/' + commentId, { method: 'DELETE', });
}
