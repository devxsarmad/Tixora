-- Ensures every new task assignment points to a user with access to the task's project.

CREATE OR REPLACE FUNCTION enforce_task_assignee_project_membership()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM tasks AS task
    JOIN project_members AS pm
      ON pm.project_id = task.project_id
     AND pm.user_id = NEW.user_id
    WHERE task.id = NEW.task_id
  ) THEN
    RAISE EXCEPTION 'Task assignee must be a project member'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_task_assignee_project_membership_before_write ON task_assignees;

CREATE TRIGGER enforce_task_assignee_project_membership_before_write
BEFORE INSERT OR UPDATE ON task_assignees
FOR EACH ROW EXECUTE FUNCTION enforce_task_assignee_project_membership();
