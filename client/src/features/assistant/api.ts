import { apiRequest, authHeaders } from '../../api/http.js';

export type AskTixoraSource = {
  taskId: string;
  projectId: string;
  contentType: 'task' | 'comment';
  sourceId: string;
  commentId: string | null;
  taskTitle: string;
  score: number;
};

export type AskTixoraResponse = {
  answer: string;
  sources: AskTixoraSource[];
};

export function askTixora(params: {
  token: string;
  orgSlug: string;
  query: string;
  projectId?: string;
}) {
  return apiRequest<AskTixoraResponse>('/api/assistant/ask', {
    method: 'POST',
    headers: {
      ...authHeaders(params.token),
      'x-tixora-org-slug': params.orgSlug
    },
    body: JSON.stringify({
      query: params.query,
      projectId: params.projectId
    })
  });
}
