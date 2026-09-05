import { z } from 'zod';

const toolNameSchema = z.enum(['list_overdue_tasks', 'list_tasks', 'summarize_assignee_workload', 'search_tasks', 'create_task', 'update_task_status', 'update_task_priority', 'update_task_due_date', 'add_task_comment']);
const messageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  tone: z.enum(['normal', 'error']).optional(),
  sources: z.array(z.object({
    taskId: z.string(), projectId: z.string(), contentType: z.enum(['task', 'comment']),
    sourceId: z.string(), commentId: z.string().nullable(), taskTitle: z.string(), score: z.number()
  })).optional(),
  toolResults: z.array(z.object({
    toolCallId: z.string(), toolName: toolNameSchema, ok: z.boolean(), result: z.unknown()
  })).optional(),
  pendingActions: z.array(z.object({
    id: z.string(), toolName: toolNameSchema, argumentsText: z.string(),
    preview: z.object({
      title: z.string(), description: z.string(),
      fields: z.array(z.object({ label: z.string(), value: z.string(), editable: z.boolean(), argumentKey: z.string() }))
    })
  })).optional()
});

export type AskMessage = z.infer<typeof messageSchema>;
const historySchema = z.array(messageSchema);
const maxMessages = 200;

export function chatHistoryKey(userId: string, orgSlug: string | null, projectId: string | null) {
  return 'tixora.chat.v1:' + JSON.stringify([userId, orgSlug, projectId]);
}

// The store outlives the panel, so responses that arrive after navigation are saved too.
export function createChatHistoryStore(getStorage: () => Pick<Storage, 'getItem' | 'setItem'>) {
  const histories = new Map<string, AskMessage[]>();
  const listeners = new Set<() => void>();

  function read(key: string): AskMessage[] {
    const cached = histories.get(key);
    if (cached) return cached;
    let messages: AskMessage[] = [];
    try {
      const raw = getStorage().getItem(key);
      const parsed = historySchema.safeParse(raw ? JSON.parse(raw) : []);
      if (parsed.success) messages = parsed.data.slice(-maxMessages);
    } catch {
      // Malformed or unavailable browser storage must not prevent using chat.
    }
    histories.set(key, messages);
    return messages;
  }

  function update(key: string, updater: (messages: AskMessage[]) => AskMessage[]) {
    const messages = updater(read(key)).slice(-maxMessages);
    histories.set(key, messages);
    try {
      getStorage().setItem(key, JSON.stringify(messages));
    } catch {
      // Retain navigation persistence in memory if storage is blocked or full.
    }
    listeners.forEach((listener) => listener());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }

  return { read, update, subscribe };
}

export const chatHistoryStore = createChatHistoryStore(() => localStorage);
