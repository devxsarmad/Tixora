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

export type AskTixoraToolResult = {
  toolCallId: string;
  toolName: 'list_overdue_tasks' | 'summarize_assignee_workload' | 'search_tasks' | 'create_task' | 'update_task_status' | 'update_task_priority' | 'update_task_due_date' | 'add_task_comment';
  ok: boolean;
  result: unknown;
};

export type AskTixoraResponse = {
  answer: string;
  sources: AskTixoraSource[];
  toolResults?: AskTixoraToolResult[];
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
