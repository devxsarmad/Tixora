import { type FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { askTixora, type AskTixoraSource } from './api.js';

type AskMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: AskTixoraSource[];
};

type AskTixoraPanelProps = {
  token: string;
  orgSlug: string | null;
  projectId: string | null;
  onOpenTask: (taskId: string) => void;
};

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

export function AskTixoraPanel({ token, orgSlug, projectId, onOpenTask }: AskTixoraPanelProps) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuery = query.trim();
    if (!trimmedQuery || !orgSlug || isAsking) return;

    setMessages((current) => [
      ...current,
      { id: createMessageId(), role: 'user', content: trimmedQuery }
    ]);
    setQuery('');
    setError(null);
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
          sources: response.sources
        }
      ]);

      if (response.toolResults?.some((result) => result.toolName === 'create_task' || result.toolName === 'update_task_status')) {
        void queryClient.invalidateQueries({ queryKey: ['tasks'] });
        void queryClient.invalidateQueries({ queryKey: ['projects'] });
      }
    } catch (askError) {
      const message = askError instanceof Error ? askError.message : 'Ask Tixora failed';
      setError(message);
      setMessages((current) => [
        ...current,
        { id: createMessageId(), role: 'assistant', content: message }
      ]);
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <section className="workspace-module ask-tixora-panel">
      <div className="module-heading">
        <div>
          <p className="section-kicker">Ask Tixora</p>
          <h2>Project answers from your tasks</h2>
          <p>Read-only answers grounded in your organization and project access.</p>
        </div>
      </div>

      <div className="ask-chat" aria-live="polite">
        {messages.length === 0 ? (
          <div className="soft-empty module-empty">Ask what is blocked, who worked on what, or what needs attention.</div>
        ) : null}

        {messages.map((message) => (
          <article key={message.id} className={message.role === 'user' ? 'ask-message user' : 'ask-message assistant'}>
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
        ))}
      </div>

      {error ? <p className="error-message">{error}</p> : null}

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
