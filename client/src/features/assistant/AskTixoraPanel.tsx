import { Bot } from 'lucide-react';
import { type FormEvent, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  askTixora,
  confirmTixoraActions,
  type AskTixoraSource,
  type AskTixoraToolResult,
  type PendingAssistantAction
} from './api.js';
import { chatHistoryKey, chatHistoryStore, type AskMessage } from './chatHistory.js';

type AskTixoraPanelProps = {
  userId: string;
  token: string;
  orgSlug: string | null;
  projectId: string | null;
  onOpenTask: (taskId: string) => void;
};

const suggestionPrompts = [
  'How many tickets are in this project?',
  'List overdue tickets.',
  'Summarize my workload in this project.',
  'What is blocked right now?',
  'Which tickets have no assignee?'
];

function createMessageId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());
}

function uniqueSources(sources: AskTixoraSource[] = []) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = source.contentType + ':' + source.sourceId;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getAnswerModeLabel(message: Pick<AskMessage, 'sources' | 'toolResults' | 'pendingActions' | 'tone'>) {
  if (message.tone === 'error') return 'Needs attention';
  const pendingActions = message.pendingActions ?? [];
  const toolResults = message.toolResults ?? [];
  if (pendingActions.length > 0) return 'Confirmation needed';
  if (toolResults.length > 0) return getToolSummary(toolResults, pendingActions) ?? 'Database answer';
  if ((message.sources ?? []).length > 0) return 'Knowledge answer';
  return null;
}

function getToolSummary(toolResults: AskTixoraToolResult[] = [], pendingActions: PendingAssistantAction[] = []) {
  if (pendingActions.length > 0) return 'Confirmation needed';
  const successfulTools = toolResults.filter((result) => result.ok).map((result) => result.toolName);
  if (successfulTools.includes('create_task')) return 'Created ticket';
  if (successfulTools.includes('update_task_status')) return 'Updated ticket';
  if (successfulTools.includes('update_task_priority')) return 'Updated priority';
  if (successfulTools.includes('update_task_due_date')) return 'Updated due date';
  if (successfulTools.includes('add_task_comment')) return 'Added comment';
  if (successfulTools.includes('list_tasks')) return 'Ticket list';
  if (successfulTools.includes('search_tasks')) return 'Ticket search';
  if (successfulTools.includes('summarize_assignee_workload')) return 'Workload summary';
  if (successfulTools.includes('list_overdue_tasks')) return 'Overdue lookup';
  if (toolResults.some((result) => !result.ok)) return 'Needs attention';
  return null;
}

function parseArguments(argumentsText: string) {
  try {
    const value = JSON.parse(argumentsText) as Record<string, unknown>;
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function serializeFieldValue(value: string, existingValue: unknown) {
  if (Array.isArray(existingValue)) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  if (existingValue === null) return value.trim() ? value.trim() : null;
  return value;
}

function updateActionArgument(action: PendingAssistantAction, argumentKey: string, value: string): PendingAssistantAction {
  const parsed = parseArguments(action.argumentsText);
  const nextArgs = {
    ...parsed,
    [argumentKey]: serializeFieldValue(value, parsed[argumentKey])
  };

  return {
    ...action,
    argumentsText: JSON.stringify(nextArgs),
    preview: {
      ...action.preview,
      fields: action.preview.fields.map((field) =>
        field.argumentKey === argumentKey ? { ...field, value } : field
      )
    }
  };
}

export function AskTixoraPanel({ userId, token, orgSlug, projectId, onOpenTask }: AskTixoraPanelProps) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const historyKey = chatHistoryKey(userId, orgSlug, projectId);
  const messages = useSyncExternalStore(chatHistoryStore.subscribe, () => chatHistoryStore.read(historyKey));
  function setMessages(updater: (current: AskMessage[]) => AskMessage[]) {
    chatHistoryStore.update(historyKey, updater);
  }
  const [isAsking, setIsAsking] = useState(false);
  const [confirmingActionId, setConfirmingActionId] = useState<string | null>(null);

  function invalidateWorkspaceQueries() {
    void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    void queryClient.invalidateQueries({ queryKey: ['projects'] });
    void queryClient.invalidateQueries({ queryKey: ['comments'] });
  }

  async function askQuestion(rawQuery: string) {
    const trimmedQuery = rawQuery.trim();
    if (!trimmedQuery || !orgSlug || isAsking) return;

    setMessages((current) => [
      ...current,
      { id: createMessageId(), role: 'user', content: trimmedQuery }
    ]);
    setQuery('');
    setIsAsking(true);

    try {
      const response = await askTixora({
        token,
        orgSlug,
        projectId: projectId ?? undefined,
        query: trimmedQuery
      });

      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: 'assistant',
          content: response.answer,
          sources: response.sources,
          toolResults: response.toolResults,
          pendingActions: response.pendingActions
        }
      ]);

      if (response.toolResults.some((result) => ['create_task', 'update_task_status', 'update_task_priority', 'update_task_due_date', 'add_task_comment'].includes(result.toolName))) {
        invalidateWorkspaceQueries();
      }
    } catch (askError) {
      const message = askError instanceof Error ? askError.message : 'Ask Tixora failed';
      setMessages((current) => [
        ...current,
        { id: createMessageId(), role: 'assistant', content: message, tone: 'error' }
      ]);
    } finally {
      setIsAsking(false);
    }
  }

  async function confirmAction(messageId: string, action: PendingAssistantAction) {
    if (!orgSlug || confirmingActionId) return;
    setConfirmingActionId(action.id);

    try {
      const response = await confirmTixoraActions({
        token,
        orgSlug,
        pendingActions: [{ id: action.id, toolName: action.toolName, argumentsText: action.argumentsText }],
        confirmedIds: [action.id]
      });

      setMessages((current) => [
        ...current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                pendingActions: (message.pendingActions ?? []).filter((pendingAction) => pendingAction.id !== action.id)
              }
            : message
        ),
        {
          id: createMessageId(),
          role: 'assistant',
          content: response.answer,
          toolResults: response.toolResults
        }
      ]);
      invalidateWorkspaceQueries();
    } catch (confirmError) {
      const message = confirmError instanceof Error ? confirmError.message : 'Confirmation failed';
      setMessages((current) => [
        ...current,
        { id: createMessageId(), role: 'assistant', content: message, tone: 'error' }
      ]);
    } finally {
      setConfirmingActionId(null);
    }
  }

  function cancelAction(messageId: string, actionId: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              pendingActions: (message.pendingActions ?? []).filter((action) => action.id !== actionId)
            }
          : message
      )
    );
  }

  function editPendingAction(messageId: string, actionId: string, argumentKey: string, value: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              pendingActions: (message.pendingActions ?? []).map((action) =>
                action.id === actionId ? updateActionArgument(action, argumentKey, value) : action
              )
            }
          : message
      )
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void askQuestion(query);
  }

  return (
    <section className="workspace-module ask-tixora-panel">
      <div className="module-heading ask-heading">
        <div>
          <p className="section-kicker">Ask Tixora</p>
          <h2>AI project operations</h2>
          <p>Ask about tickets, workload, blockers, or run safe project actions from this workspace.</p>
        </div>
      </div>

      <div className="ask-chat" aria-live="polite">
        {messages.length === 0 ? (
          <div className="ask-empty-state">
            <div className="ask-empty-icon" aria-hidden="true"><Bot /></div>
            <div>
              <h3>Start with a project question</h3>
              <p>Ask Tixora can read your accessible tasks and prepare safe actions like creating tickets or changing status.</p>
            </div>
            <div className="ask-suggestions" aria-label="Suggested questions">
              {suggestionPrompts.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={!orgSlug || isAsking}
                  onClick={() => void askQuestion(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message) => {
          const pendingActions = message.pendingActions ?? [];
          const answerModeLabel = getAnswerModeLabel(message);
          return (
            <article
              key={message.id}
              className={[
                'ask-message',
                message.role,
                message.tone === 'error' ? 'error' : ''
              ].filter(Boolean).join(' ')}
            >
              {message.role === 'assistant' ? (
                <div className="ask-message-meta">
                  <span>Ask Tixora</span>
                  {answerModeLabel ? <small>{answerModeLabel}</small> : null}
                </div>
              ) : null}
              <p>{message.content}</p>
              {pendingActions.length > 0 ? (
                <div className="pending-actions-list">
                  {pendingActions.map((action) => (
                    <section key={action.id} className="pending-action-card">
                      <div className="pending-action-heading">
                        <div>
                          <strong>{action.preview.title}</strong>
                          <p>{action.preview.description}</p>
                        </div>
                        <span>{action.toolName}</span>
                      </div>
                      <div className="pending-action-fields">
                        {action.preview.fields.map((field) => (
                          <label key={action.id + field.argumentKey}>
                            <span>{field.label}</span>
                            <input
                              value={field.value}
                              disabled={!field.editable || confirmingActionId === action.id}
                              onChange={(event) => editPendingAction(message.id, action.id, field.argumentKey, event.target.value)}
                            />
                          </label>
                        ))}
                      </div>
                      <div className="pending-action-controls">
                        <button type="button" className="secondary-button" disabled={confirmingActionId === action.id} onClick={() => cancelAction(message.id, action.id)}>
                          Cancel
                        </button>
                        <button type="button" className="primary-button" disabled={Boolean(confirmingActionId)} onClick={() => void confirmAction(message.id, action)}>
                          {confirmingActionId === action.id ? 'Confirming...' : 'Confirm'}
                        </button>
                      </div>
                    </section>
                  ))}
                </div>
              ) : null}
              {message.sources && message.sources.length > 0 ? (
                <div className="ask-sources" aria-label="Answer sources">
                  {uniqueSources(message.sources).slice(0, 6).map((source) => (
                    <button key={source.contentType + source.sourceId} type="button" onClick={() => onOpenTask(source.taskId)}>
                      {source.contentType === 'comment' ? 'Comment' : 'Task'} - {source.taskTitle}
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}

        {isAsking ? (
          <article className="ask-message assistant loading" aria-label="Ask Tixora is thinking">
            <div className="ask-message-meta"><span>Ask Tixora</span><small>Thinking</small></div>
            <div className="ask-typing" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </article>
        ) : null}
      </div>

      <form className="ask-form" onSubmit={handleSubmit}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={orgSlug ? 'Ask about blockers, ownership, or recent work...' : 'Select an organization first'}
          disabled={!orgSlug || isAsking}
        />
        <button type="submit" className="primary-button" disabled={!orgSlug || !query.trim() || isAsking}>
          {isAsking ? 'Asking...' : 'Ask'}
        </button>
      </form>
    </section>
  );
}
