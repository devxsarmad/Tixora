import { env } from '../../config/env.js';

const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';

type OpenAIEmbeddingResponse = {
  data?: Array<{ embedding?: number[] }>;
  error?: { message?: string };
};

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
