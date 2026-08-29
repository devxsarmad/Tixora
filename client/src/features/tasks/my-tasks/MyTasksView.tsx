import { formatDueDate, getInitials } from '../../../lib/formatters.js';
import type { TaskSummary } from '../types.js';

type MyTasksViewProps = {
  tasks: TaskSummary[];
  currentUserId: string;
  priorityLabels: Record<TaskSummary['priority'], string>;
  statusLabels: Record<TaskSummary['status'], string>;
  onOpenTask: (taskId: string) => void;
};

export function MyTasksView({
  tasks,
  currentUserId,
  priorityLabels,
  statusLabels,
  onOpenTask
}: MyTasksViewProps) {
  const assignedTasks = tasks.filter((task) =>
    task.assignees.some((assignee) => assignee.id === currentUserId)
  );

  return (
    <section className="workspace-module">
      <div className="module-heading">
        <div>
            <h2>My tasks</h2>
          <p>Tasks assigned to you in the selected project.</p>
        </div>
        <span className="count-badge">{assignedTasks.length}</span>
      </div>

      {assignedTasks.length === 0 ? (
        <div className="soft-empty module-empty">No tasks assigned to you.</div>
      ) : (
        <div className="module-list">
          {assignedTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              className="module-row"
              onClick={() => onOpenTask(task.id)}
            >
              <span className="module-row-main">
                <strong>{task.title}</strong>
                <small>{statusLabels[task.status]} · {formatDueDate(task.dueAt)}</small>
              </span>
              <span className={"priority-icon " + task.priority} aria-label={priorityLabels[task.priority] + ' priority'} />
              <span className="mini-avatar-stack">
                {task.assignees.slice(0, 3).map((assignee) => (
                  <span key={assignee.id} className="avatar mini-avatar">
                    {getInitials(assignee.displayName)}
                  </span>
                ))}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
