import { env } from '../../config/env.js';

const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
const OPENAI_CHAT_MODEL = 'gpt-4o-mini';

type OpenAIEmbeddingResponse = {
  data?: Array<{ embedding?: number[] }>;
  error?: { message?: string };
};

type OpenAIToolCall = {
  id: string;
  type: 'function';
  function?: {
    name?: string;
    arguments?: string;
  };
};

type OpenAIChatResponse = {
  choices?: Array<{ message?: { content?: string; tool_calls?: OpenAIToolCall[] } }>;
  error?: { message?: string };
};

type AssistantToolDefinition = {
  type: 'function';
  mutating?: boolean;
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type SelectedAssistantToolCall = {
  id: string;
  name: string;
  argumentsText: string;
};

const groundedSystemPrompt = [
  'You are Ask Tixora, an assistant for a project management app.',
  'Answer only from the provided retrieved context and executed tool results.',
  'Never fabricate task IDs, user names, project names, dates, or facts.',
  "If the context and tool results do not answer the question, say: I don't have enough information.",
  'If a tool result reports an error, explain it briefly without inventing a workaround.'
].join(' ');

const toolSystemPrompt = [
  'You are Ask Tixora deciding whether a fixed tool is needed.',
  'Use only the provided tools. Never invent tool names or arguments.',
  'Call read tools for structured task questions like overdue tasks, workload, unassigned tickets, blocked tickets, status lists, priority lists, or finding/searching tickets.',
  'Call write tools only when the user clearly asks to create a task, change status, update priority, update due date, or add a comment.',
  'For status/priority/due-date changes with a named ticket, pass taskTitle; do not require a UUID.',
  'For workload questions with a person name or email, call summarize_assignee_workload with userRef; do not require a UUID.',
  'For task creation assignees, pass the exact member name or email the user typed when no UUID is available.',
  'For due dates, pass the exact user phrase for relative dates like today, tomorrow, next week, or 31 August 2026; the server will normalize it.',
  "For requests like find/search/show tickets, call search_tasks with the user\'s search text.",
  'For requests like comment on/add note to a ticket, call add_task_comment with taskTitle and body.',
  'If Current project ID is provided in context, include it as projectId for project-scoped tools.',
  'Ask for clarification by not calling a tool only when the target is genuinely missing or ambiguous.',
  'Use retrieved context only for known task IDs, user IDs, project IDs, names, and facts.'
].join(' ');

export async function generateEmbedding(input: string): Promise<number[] | null> {
  const apiKey = env.OPENAI_API_KEY;

  if (!apiKey) {
    console.warn('Skipping embedding job: OPENAI_API_KEY is not configured.');
    return null;
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: env.OPENAI_EMBEDDING_MODEL ?? OPENAI_EMBEDDING_MODEL,
      input
    })
  });

  const body = (await response.json()) as OpenAIEmbeddingResponse;

  if (!response.ok) {
    throw new Error(body.error?.message ?? 'Embedding request failed');
  }

  return body.data?.[0]?.embedding ?? null;
}


export async function generateGroundedAnswer(params: {
  query: string;
  context: string;
}): Promise<string | null> {
  const apiKey = env.OPENAI_API_KEY;

  if (!apiKey) {
    console.warn('Skipping assistant answer: OPENAI_API_KEY is not configured.');
    return null;
  }

  if (!params.context.trim()) {
    return "I don't have enough information.";
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: env.OPENAI_CHAT_MODEL ?? OPENAI_CHAT_MODEL,
      temperature: 0.1,
      messages: [
        { role: 'system', content: groundedSystemPrompt },
        {
          role: 'user',
          content: 'Retrieved context:\n' + params.context + '\n\nUser question:\n' + params.query
        }
      ]
    })
  });

  const body = (await response.json()) as OpenAIChatResponse;

  if (!response.ok) {
    throw new Error(body.error?.message ?? 'Assistant answer request failed');
  }

  return body.choices?.[0]?.message?.content?.trim() ?? "I don't have enough information.";
}


export async function selectAssistantToolCalls(params: {
  query: string;
  context: string;
  tools: readonly AssistantToolDefinition[];
}): Promise<SelectedAssistantToolCall[]> {
  const apiKey = env.OPENAI_API_KEY;

  if (!apiKey) {
    console.warn('Skipping assistant tool selection: OPENAI_API_KEY is not configured.');
    return [];
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: env.OPENAI_CHAT_MODEL ?? OPENAI_CHAT_MODEL,
      temperature: 0,
      tool_choice: 'auto',
      tools: params.tools.map((tool) => ({ type: tool.type, function: tool.function })),
      messages: [
        { role: 'system', content: toolSystemPrompt },
        {
          role: 'user',
          content: 'Retrieved context:\n' + params.context + '\n\nUser request:\n' + params.query
        }
      ]
    })
  });

  const body = (await response.json()) as OpenAIChatResponse;

  if (!response.ok) {
    throw new Error(body.error?.message ?? 'Assistant tool selection failed');
  }

  return (body.choices?.[0]?.message?.tool_calls ?? [])
    .filter((call) => call.type === 'function' && call.function?.name)
    .map((call) => ({
      id: call.id,
      name: call.function?.name ?? '',
      argumentsText: call.function?.arguments ?? '{}'
    }));
}
