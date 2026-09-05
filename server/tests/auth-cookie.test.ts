import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://test:test@localhost/test';
process.env.JWT_SECRET = 'test-only-secret-at-least-32-characters';
process.env.CORS_ORIGIN = 'http://localhost:5173';

const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db/pool.js');
const { env } = await import('../src/config/env.js');
const { authCookieOptions, readAuthCookie } = await import('../src/features/auth/auth.cookie.js');
const user = {
  id: '11111111-1111-4111-8111-111111111111', email: 'cookie@example.test',
  display_name: 'Cookie Tester', created_at: new Date(), is_active: true,
  password_hash: await bcrypt.hash('Password123!', 4)
};
let active = true;
let server: Server;
let base: string;
const originalQuery = pool.query;

before(async () => {
  // Exercise real routes, JWT verification, cookies, and CSRF without touching a database.
  pool.query = (async () => ({ rows: active ? [user] : [], rowCount: active ? 1 : 0 })) as typeof pool.query;
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  pool.query = originalQuery;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await pool.end();
});

function request(path: string, options: RequestInit = {}) {
  return fetch(base + '/api' + path, options);
}

const trustedHeaders = { 'Content-Type': 'application/json', 'X-Tixora-Request': '1', Origin: 'http://localhost:5173' };

test('login and registration issue HttpOnly cookies without exposing JWTs in JSON', async () => {
  for (const route of ['login', 'register']) {
    const response = await request('/auth/' + route, {
      method: 'POST', headers: trustedHeaders,
      body: JSON.stringify({ email: user.email, password: 'Password123!', displayName: 'Cookie Tester' })
    });
    assert.equal(response.status, route === 'login' ? 200 : 201);
    const body = await response.json();
    assert.equal(body.user.id, user.id);
    assert.equal('accessToken' in body, false);
    const cookie = response.headers.get('set-cookie')!;
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Path=\/api/);
    assert.match(cookie, /Expires=/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
    const restored = await request('/auth/session', { headers: { Cookie: cookie.split(';')[0] } });
    assert.equal(restored.status, 200);
    assert.equal((await restored.json()).user.id, user.id);
  }
});

test('rejects missing, malformed, expired and bearer-only credentials', async () => {
  const expired = jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: -1 });
  for (const headers of [{}, { Cookie: 'tixora.auth=%' }, { Cookie: 'tixora.auth=invalid' }, { Cookie: `tixora.auth=${expired}` }, { Authorization: `Bearer ${jwt.sign({ sub: user.id }, env.JWT_SECRET)}` }]) {
    const response = await request('/auth/session', { headers });
    assert.equal(response.status, 401);
  }
});

test('rejects a valid cookie when the account is inactive', async () => {
  active = false;
  try {
    const response = await request('/auth/session', { headers: { Cookie: `tixora.auth=${jwt.sign({ sub: user.id }, env.JWT_SECRET)}` } });
    assert.equal(response.status, 401);
  } finally { active = true; }
});

test('blocks untrusted and simple-form mutation requests, including login and logout', async () => {
  for (const path of ['/auth/login', '/auth/logout', '/me']) {
    for (const headers of [{ Origin: env.CORS_ORIGIN }, { ...trustedHeaders, Origin: 'https://attacker.example' }, { ...trustedHeaders, Origin: 'null' }]) {
      const response = await request(path, { method: path === '/me' ? 'PATCH' : 'POST', headers });
      assert.equal(response.status, 403);
      assert.equal((await response.json()).error.code, 'CSRF_REJECTED');
    }
  }
});

test('logout clears the cookie with matching scope and is safe when already signed out', async () => {
  const response = await request('/auth/logout', { method: 'POST', headers: trustedHeaders });
  assert.equal(response.status, 204);
  assert.match(response.headers.get('set-cookie')!, /tixora.auth=; Path=\/api; Expires=Thu, 01 Jan 1970/);
  assert.match(response.headers.get('set-cookie')!, /HttpOnly; SameSite=Lax/);
  assert.equal((await request('/auth/session')).status, 401);
});

test('production cookies require HTTPS and cookie parsing tolerates unrelated cookies', () => {
  const previous = env.NODE_ENV;
  try {
    env.NODE_ENV = 'production';
    assert.equal(authCookieOptions().secure, true);
  } finally { env.NODE_ENV = previous; }
  assert.equal(readAuthCookie('other=1; tixora.auth=abc; another=2'), 'abc');
  assert.equal(readAuthCookie('other=1'), null);
});
