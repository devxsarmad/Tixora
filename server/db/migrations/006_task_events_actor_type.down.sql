ALTER TABLE task_events
  DROP CONSTRAINT IF EXISTS task_events_actor_type_check;

ALTER TABLE task_events
  DROP COLUMN IF EXISTS actor_type;
