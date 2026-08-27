-- Usage:
-- Rolls back invitation tracking, task activity events, soft-delete columns, and
-- the organization-member project-access cascade trigger.

BEGIN;

DROP INDEX IF EXISTS tasks_project_status_not_deleted_idx;
DROP INDEX IF EXISTS projects_active_not_deleted_by_team_idx;
DROP TRIGGER IF EXISTS set_invitations_updated_at ON invitations;
DROP TRIGGER IF EXISTS cascade_project_access_after_team_member_delete ON team_members;
DROP FUNCTION IF EXISTS remove_project_access_after_team_member_delete();

DROP TABLE IF EXISTS task_events;
ALTER TABLE tasks DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE projects DROP COLUMN IF EXISTS deleted_at;
DROP TABLE IF EXISTS invitations;
DROP TYPE IF EXISTS invitation_status;

COMMIT;
