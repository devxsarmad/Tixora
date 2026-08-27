-- Usage:
-- Run this migration once against a PostgreSQL database to create the initial
-- Tixora schema. It defines tables, relationships, constraints,
-- indexes, enums, and update timestamp triggers. This is raw SQL on purpose:
-- the project is meant to teach what ORMs usually hide.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE team_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE project_role AS ENUM ('manager', 'contributor', 'viewer');
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'blocked', 'done');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_nonempty CHECK (length(trim(email)) > 0),
  CONSTRAINT users_display_name_nonempty CHECK (length(trim(display_name)) > 0),
  CONSTRAINT users_email_lowercase CHECK (email = lower(email))
);

CREATE UNIQUE INDEX users_email_unique_idx ON users (email);

CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  created_by uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teams_name_nonempty CHECK (length(trim(name)) > 0),
  CONSTRAINT teams_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE UNIQUE INDEX teams_slug_unique_idx ON teams (slug);
CREATE INDEX teams_created_by_idx ON teams (created_by);

CREATE TABLE team_members (
  team_id uuid NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role team_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX team_members_user_id_idx ON team_members (user_id);
CREATE INDEX team_members_team_role_idx ON team_members (team_id, role);

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_by uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_name_nonempty CHECK (length(trim(name)) > 0)
);

CREATE INDEX projects_team_id_idx ON projects (team_id);
CREATE INDEX projects_created_by_idx ON projects (created_by);
CREATE INDEX projects_active_by_team_idx ON projects (team_id, updated_at DESC)
WHERE archived_at IS NULL;

CREATE TABLE project_members (
  project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role project_role NOT NULL DEFAULT 'contributor',
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX project_members_user_id_idx ON project_members (user_id);
CREATE INDEX project_members_project_role_idx ON project_members (project_id, role);

CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status task_status NOT NULL DEFAULT 'todo',
  priority task_priority NOT NULL DEFAULT 'medium',
  created_by uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_title_nonempty CHECK (length(trim(title)) > 0),
  CONSTRAINT tasks_completed_status_match CHECK (
    (status = 'done' AND completed_at IS NOT NULL)
    OR (status <> 'done' AND completed_at IS NULL)
  )
);

CREATE INDEX tasks_project_status_idx ON tasks (project_id, status, updated_at DESC);
CREATE INDEX tasks_project_due_idx ON tasks (project_id, due_at)
WHERE due_at IS NOT NULL AND status <> 'done';
CREATE INDEX tasks_created_by_idx ON tasks (created_by);

CREATE TABLE task_assignees (
  task_id uuid NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX task_assignees_user_id_idx ON task_assignees (user_id);
CREATE INDEX task_assignees_assigned_by_idx ON task_assignees (assigned_by);

CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT comments_body_nonempty CHECK (length(trim(body)) > 0)
);

CREATE INDEX comments_task_created_idx ON comments (task_id, created_at ASC)
WHERE deleted_at IS NULL;
CREATE INDEX comments_author_id_idx ON comments (author_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_teams_updated_at
BEFORE UPDATE ON teams
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_tasks_updated_at
BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_comments_updated_at
BEFORE UPDATE ON comments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
