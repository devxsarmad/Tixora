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

export type AskTixoraToolName = 'list_overdue_tasks' | 'list_tasks' | 'summarize_assignee_workload' | 'search_tasks' | 'create_task' | 'update_task_status' | 'update_task_priority' | 'update_task_due_date' | 'add_task_comment';

export type AskTixoraToolResult = {
  toolCallId: string;
  toolName: AskTixoraToolName;
  ok: boolean;
  result: unknown;
};

export type PendingAssistantAction = {
  id: string;
  toolName: AskTixoraToolName;
  argumentsText: string;
  preview: {
    title: string;
    description: string;
    fields: Array<{
      label: string;
      value: string;
      editable: boolean;
      argumentKey: string;
    }>;
  };
};

export type AskTixoraResponse = {
  answer: string;
  toolResults: AskTixoraToolResult[];
  pendingActions: PendingAssistantAction[];
  sources: AskTixoraSource[];
};

export type ConfirmTixoraResponse = {
  answer: string;
  toolResults: AskTixoraToolResult[];
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


export function confirmTixoraActions(params: {
  token: string;
  orgSlug: string;
  pendingActions: Array<{ id: string; toolName: AskTixoraToolName; argumentsText: string }>;
  confirmedIds: string[];
}) {
  return apiRequest<ConfirmTixoraResponse>('/api/assistant/confirm', {
    method: 'POST',
    headers: {
      ...authHeaders(params.token),
      'x-tixora-org-slug': params.orgSlug
    },
    body: JSON.stringify({
      pendingActions: params.pendingActions,
      confirmedIds: params.confirmedIds
    })
  });
}
