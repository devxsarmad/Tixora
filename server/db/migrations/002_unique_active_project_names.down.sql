-- Usage:
-- Removes the active-project name uniqueness rule.

BEGIN;

DROP INDEX IF EXISTS projects_active_team_name_unique_idx;

COMMIT;
