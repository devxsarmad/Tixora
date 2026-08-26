import { apiRequest } from '../../api/http.js';
import type { AuthResponse } from './types.js';

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
