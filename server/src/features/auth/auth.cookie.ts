import type { CookieOptions, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

export const authCookieName = 'tixora.auth';

export function authCookieOptions(): CookieOptions {
  return { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/api' };
}

export function setAuthCookie(res: Response, token: string) {
  const payload = jwt.decode(token) as jwt.JwtPayload;
  res.cookie(authCookieName, token, { ...authCookieOptions(), expires: new Date(payload.exp! * 1000) });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(authCookieName, authCookieOptions());
}

export function readAuthCookie(header: string | undefined): string | null {
  const value = header?.split(';').map((part) => part.trim()).find((part) => part.startsWith(authCookieName + '='));
  if (!value) return null;
  try { return decodeURIComponent(value.slice(authCookieName.length + 1)) || null; } catch { return null; }
}
