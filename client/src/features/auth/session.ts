import type { AuthResponse } from './types.js';

const SESSION_KEY = 'tixora.session';

function decodeJwtPayload(token: string): { exp?: number } | null {
  const [, payload] = token.split('.');
  if (!payload) return null;

  try {
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4), '=');
    return JSON.parse(atob(paddedPayload)) as { exp?: number };
  } catch {
    return null;
  }
}

export function isSessionExpired(session: AuthResponse | null) {
  if (!session?.accessToken) return true;

  const payload = decodeJwtPayload(session.accessToken);
  if (!payload?.exp) return true;

  return payload.exp * 1000 <= Date.now();
}

export function saveSession(session: AuthResponse) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): AuthResponse | null {
  const raw = localStorage.getItem(SESSION_KEY);

  if (!raw) {
    return null;
  }

  try {
    const session = JSON.parse(raw) as AuthResponse;
    if (isSessionExpired(session)) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
