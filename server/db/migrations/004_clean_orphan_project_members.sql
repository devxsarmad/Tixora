-- Usage:
-- Removes project access rows for users who no longer belong to the owning
-- organization. Project members must always be chosen from organization members.

BEGIN;

DELETE FROM project_members AS pm
USING projects AS p
WHERE p.id = pm.project_id
  AND NOT EXISTS (
    SELECT 1
    FROM team_members AS tm
    WHERE tm.team_id = p.team_id
      AND tm.user_id = pm.user_id
  );

COMMIT;
