import { apiRequest, authHeaders } from '../../api/http.js';
import type { CommentSummary } from './types.js';

export function listComments(token: string, taskId: string) {
  return apiRequest<{ comments: CommentSummary[]; nextCursor: string | null }>('/api/tasks/' + taskId + '/comments?limit=20', { headers: authHeaders(token) });
}

export function createComment(token: string, taskId: string, input: { body: string }) {
  return apiRequest<{ comment: CommentSummary }>('/api/tasks/' + taskId + '/comments', { method: 'POST', headers: authHeaders(token), body: JSON.stringify(input) });
}

export function updateComment(token: string, commentId: string, body: string) {
  return apiRequest<{ comment: CommentSummary }>('/api/comments/' + commentId, { method: 'PATCH', headers: authHeaders(token), body: JSON.stringify({ body }) });
}

export function deleteComment(token: string, commentId: string) {
  return apiRequest<{ comment: CommentSummary }>('/api/comments/' + commentId, { method: 'DELETE', headers: authHeaders(token) });
}
