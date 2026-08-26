// Usage:
// Small fetch wrapper for frontend API calls. It keeps the API base URL in one
// place and throws clean errors for non-2xx responses.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

type ApiErrorBody = {
  error?: {
    message?: string;
    fields?: Record<string, string[] | undefined>;
  };
};

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...headers
    }
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as T & ApiErrorBody) : null;

  if (!response.ok) {
    const firstFieldError = data?.error?.fields
      ? Object.values(data.error.fields).flat().find(Boolean)
      : null;

    throw new Error(firstFieldError ?? data?.error?.message ?? 'API request failed');
  }

  return data as T;
}

export function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`
  };
}
