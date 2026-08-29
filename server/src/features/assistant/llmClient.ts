import { env } from '../../config/env.js';

const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
const OPENAI_CHAT_MODEL = 'gpt-4o-mini';

type OpenAIEmbeddingResponse = {
  data?: Array<{ embedding?: number[] }>;
  error?: { message?: string };
};

type OpenAIChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

const groundedSystemPrompt = [
  'You are Ask Tixora, a read-only assistant for a project management app.',
  'Answer only from the provided retrieved context.',
  'Never fabricate task IDs, user names, project names, dates, or facts.',
  "If the context does not answer the question, say: I don't have enough information.",
  'Do not claim to perform actions. Phase 2 is read-only.'
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
