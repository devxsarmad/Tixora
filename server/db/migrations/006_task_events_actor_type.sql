-- Adds actor_type so assistant-confirmed task actions can be distinguished from direct user edits.

ALTER TABLE task_events
  ADD COLUMN actor_type text NOT NULL DEFAULT 'user';

ALTER TABLE task_events
  ADD CONSTRAINT task_events_actor_type_check
  CHECK (actor_type IN ('user', 'ai_assistant'));
