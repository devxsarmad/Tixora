import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chatHistoryKey, createChatHistoryStore, type AskMessage } from '../src/features/assistant/chatHistory.js';

function storageFixture() {
  const entries = new Map<string, string>();
  return { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
}

const question: AskMessage = { id: 'question', role: 'user', content: 'What is blocked?' };
const answer: AskMessage = {
  id: 'answer', role: 'assistant', content: 'Review this change.',
  sources: [{ taskId: 'task', projectId: 'project', contentType: 'task', sourceId: 'task', commentId: null, taskTitle: 'Ship feature', score: 0.9 }],
  toolResults: [{ toolCallId: 'read', toolName: 'list_tasks', ok: true, result: [] }],
  pendingActions: [{ id: 'write', toolName: 'update_task_status', argumentsText: '{"status":"done"}', preview: {
    title: 'Update status', description: 'Ship feature', fields: [{ label: 'Status', value: 'done', editable: true, argumentKey: 'status' }]
  } }]
};

test('restores messages and action/source metadata after a fresh store is created', () => {
  const storage = storageFixture();
  const key = chatHistoryKey('user', 'org', 'project');
  createChatHistoryStore(() => storage).update(key, () => [question, answer]);
  assert.deepEqual(createChatHistoryStore(() => storage).read(key), [question, answer]);
});

test('isolates users, organizations, projects and organization-wide chat', () => {
  const store = createChatHistoryStore(storageFixture);
  const key = chatHistoryKey('user', 'org', 'project');
  store.update(key, () => [question]);
  for (const other of [chatHistoryKey('other', 'org', 'project'), chatHistoryKey('user', 'other', 'project'), chatHistoryKey('user', 'org', 'other'), chatHistoryKey('user', 'org', null)]) {
    assert.deepEqual(store.read(other), []);
  }
  assert.deepEqual(store.read(key), [question]);
});

test('saves a late response after the panel unsubscribes without changing another scope', () => {
  const storage = storageFixture();
  const store = createChatHistoryStore(() => storage);
  const key = chatHistoryKey('user', 'org', 'project');
  const other = chatHistoryKey('user', 'org', 'other');
  let notifications = 0;
  const unsubscribe = store.subscribe(() => { notifications += 1; });
  store.update(key, () => [question]);
  unsubscribe();
  store.update(key, (messages) => [...messages, answer]);
  assert.equal(notifications, 1);
  assert.deepEqual(store.read(other), []);
  assert.deepEqual(createChatHistoryStore(() => storage).read(key), [question, answer]);
});

test('persists removal of resolved or cancelled actions', () => {
  const storage = storageFixture();
  const store = createChatHistoryStore(() => storage);
  store.update('chat', () => [answer]);
  store.update('chat', (messages) => messages.map((message) => ({ ...message, pendingActions: [] })));
  assert.deepEqual(createChatHistoryStore(() => storage).read('chat')[0].pendingActions, []);
});

test('handles malformed data and unavailable storage without crashing', () => {
  const storage = storageFixture();
  for (const malformed of ['{', '{}', '[{"role":"assistant","content":42}]']) {
    storage.setItem('chat', malformed);
    assert.deepEqual(createChatHistoryStore(() => storage).read('chat'), []);
  }
  const store = createChatHistoryStore(() => { throw new Error('Storage blocked'); });
  store.update('chat', () => [question]);
  assert.deepEqual(store.read('chat'), [question]);
});

test('bounds stored history and keeps a stable snapshot between updates', () => {
  const storage = storageFixture();
  const store = createChatHistoryStore(() => storage);
  store.update('chat', () => Array.from({ length: 205 }, (_, index) => ({ ...question, id: String(index) })));
  assert.equal(store.read('chat').length, 200);
  assert.equal(store.read('chat')[0].id, '5');
  assert.equal(store.read('chat'), store.read('chat'));
  assert.equal(createChatHistoryStore(() => storage).read('chat').length, 200);
});
