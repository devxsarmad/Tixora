import { type FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { askTixora, type AskTixoraSource, type AskTixoraToolResult } from './api.js';

type AskMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: AskTixoraSource[];
  toolResults?: AskTixoraToolResult[];
  tone?: 'normal' | 'error';
};

type AskTixoraPanelProps = {
  token: string;
  orgSlug: string | null;
  projectId: string | null;
  onOpenTask: (taskId: string) => void;
};

const suggestionPrompts = [
  'How many tickets are in this project?',
  'List overdue tickets.',
  'Summarize my workload in this project.',
  'What is blocked right now?'
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

function getToolSummary(toolResults: AskTixoraToolResult[] = []) {
  const successfulTools = toolResults.filter((result) => result.ok).map((result) => result.toolName);
  if (successfulTools.includes('create_task')) return 'Created ticket';
  if (successfulTools.includes('update_task_status')) return 'Updated ticket';
  if (successfulTools.includes('summarize_assignee_workload')) return 'Workload summary';
  if (successfulTools.includes('list_overdue_tasks')) return 'Overdue lookup';
  if (toolResults.some((result) => !result.ok)) return 'Needs attention';
  return null;
}

export function AskTixoraPanel({ token, orgSlug, projectId, onOpenTask }: AskTixoraPanelProps) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [isAsking, setIsAsking] = useState(false);

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
          toolResults: response.toolResults
        }
      ]);

      if (response.toolResults?.some((result) => result.toolName === 'create_task' || result.toolName === 'update_task_status')) {
        void queryClient.invalidateQueries({ queryKey: ['tasks'] });
        void queryClient.invalidateQueries({ queryKey: ['projects'] });
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
            <div className="ask-empty-icon" aria-hidden="true">?</div>
            <div>
              <h3>Start with a project question</h3>
              <p>Ask Tixora can read your accessible tasks and run approved actions like creating tickets or changing status.</p>
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
          const toolSummary = getToolSummary(message.toolResults);
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
                  {toolSummary ? <small>{toolSummary}</small> : null}
                </div>
              ) : null}
              <p>{message.content}</p>
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
