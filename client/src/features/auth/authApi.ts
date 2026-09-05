import { apiRequest } from '../../api/http.js';
import type { AuthResponse } from './types.js';

export function getSession() {
  return apiRequest<AuthResponse>('/api/auth/session');
}

export function logout() {
  return apiRequest<void>('/api/auth/logout', { method: 'POST' });
}

export function login(input: { email: string; password: string }) {
  return apiRequest<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function register(input: {
  displayName: string;
  email: string;
  password: string;
}) {
  return apiRequest<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}
