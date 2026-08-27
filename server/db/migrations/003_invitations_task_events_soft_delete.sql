-- Usage:
-- Adds invitation tracking, task activity events, and soft-delete support for
-- projects/tasks. Also cascades project access when an organization member is
-- removed without deleting task assignment history.

BEGIN;

CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired');

CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL,
  status invitation_status NOT NULL DEFAULT 'pending',
  role team_role NOT NULL DEFAULT 'member',
  inviter_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  accepted_by uuid REFERENCES users (id) ON DELETE SET NULL,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitations_email_nonempty CHECK (length(trim(email)) > 0),
  CONSTRAINT invitations_email_lowercase CHECK (email = lower(email)),
  CONSTRAINT invitations_token_nonempty CHECK (length(trim(token)) > 0)
);

CREATE UNIQUE INDEX invitations_token_unique_idx ON invitations (token);
CREATE UNIQUE INDEX invitations_pending_team_email_unique_idx
  ON invitations (team_id, email)
  WHERE status = 'pending';
CREATE INDEX invitations_team_status_idx ON invitations (team_id, status, created_at DESC);
CREATE INDEX invitations_inviter_id_idx ON invitations (inviter_id);

ALTER TABLE projects ADD COLUMN deleted_at timestamptz;
ALTER TABLE tasks ADD COLUMN deleted_at timestamptz;

CREATE TABLE task_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users (id) ON DELETE SET NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_events_field_nonempty CHECK (length(trim(field)) > 0)
);

CREATE INDEX task_events_task_created_idx ON task_events (task_id, created_at ASC);
CREATE INDEX task_events_actor_id_idx ON task_events (actor_id);

CREATE OR REPLACE FUNCTION remove_project_access_after_team_member_delete()
RETURNS trigger AS $$
BEGIN
  DELETE FROM project_members AS pm
  USING projects AS p
  WHERE p.id = pm.project_id
    AND p.team_id = OLD.team_id
    AND pm.user_id = OLD.user_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cascade_project_access_after_team_member_delete
AFTER DELETE ON team_members
FOR EACH ROW EXECUTE FUNCTION remove_project_access_after_team_member_delete();

CREATE TRIGGER set_invitations_updated_at
BEFORE UPDATE ON invitations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX projects_active_not_deleted_by_team_idx ON projects (team_id, updated_at DESC)
WHERE archived_at IS NULL AND deleted_at IS NULL;
CREATE INDEX tasks_project_status_not_deleted_idx ON tasks (project_id, status, updated_at DESC)
WHERE deleted_at IS NULL;

COMMIT;
