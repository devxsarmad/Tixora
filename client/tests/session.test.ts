import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearLegacySession } from '../src/features/auth/session.js';

test('removes legacy login storage without removing chat history', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const entries = new Map([['tixora.session', '{"accessToken":"legacy"}'], ['tixora.chat.v1:example', '[]']]);
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { removeItem: (key: string) => entries.delete(key) } });
    clearLegacySession();
    assert.equal(entries.has('tixora.session'), false);
    assert.equal(entries.has('tixora.chat.v1:example'), true);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('legacy cleanup tolerates blocked browser storage', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('Storage blocked'); } });
    assert.doesNotThrow(clearLegacySession);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
