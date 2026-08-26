-- Usage:
-- Enforces that one team cannot have two active projects with the same name.
-- Archived projects are excluded so a team can later reuse a project name.

BEGIN;

CREATE UNIQUE INDEX projects_active_team_name_unique_idx
ON projects (team_id, lower(name))
WHERE archived_at IS NULL;

COMMIT;
