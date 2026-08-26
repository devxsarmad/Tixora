-- Usage:
-- Run this rollback migration if you need to undo db/migrations/001_init.sql
-- during local development. It drops triggers, tables, and custom enum types
-- in dependency order so PostgreSQL does not reject the rollback.

BEGIN;

DROP TRIGGER IF EXISTS set_comments_updated_at ON comments;
DROP TRIGGER IF EXISTS set_tasks_updated_at ON tasks;
DROP TRIGGER IF EXISTS set_projects_updated_at ON projects;
DROP TRIGGER IF EXISTS set_teams_updated_at ON teams;
DROP TRIGGER IF EXISTS set_users_updated_at ON users;
DROP FUNCTION IF EXISTS set_updated_at();

DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS task_assignees;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS project_members;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS team_members;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS users;

DROP TYPE IF EXISTS task_priority;
DROP TYPE IF EXISTS task_status;
DROP TYPE IF EXISTS project_role;
DROP TYPE IF EXISTS team_role;

COMMIT;
