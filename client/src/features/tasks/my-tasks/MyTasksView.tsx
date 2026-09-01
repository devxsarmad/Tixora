import { formatDueDate, getInitials } from '../../../lib/formatters.js';
import type { TaskSummary } from '../types.js';

type MyTasksViewProps = {
  tasks: TaskSummary[];
  currentUserId: string;
  priorityLabels: Record<TaskSummary['priority'], string>;
  statusLabels: Record<TaskSummary['status'], string>;
  onOpenTask: (taskId: string) => void;
};

function parseDueTime(value: string | null) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function isOverdue(task: TaskSummary) {
  return Boolean(task.dueAt && task.status !== 'done' && parseDueTime(task.dueAt) < Date.now());
}

function sortMyTasks(left: TaskSummary, right: TaskSummary) {
  const leftOverdue = isOverdue(left) ? 0 : 1;
  const rightOverdue = isOverdue(right) ? 0 : 1;
  if (leftOverdue !== rightOverdue) return leftOverdue - rightOverdue;
  const leftDone = left.status === 'done' ? 1 : 0;
  const rightDone = right.status === 'done' ? 1 : 0;
  if (leftDone !== rightDone) return leftDone - rightDone;
  const dueDiff = parseDueTime(left.dueAt) - parseDueTime(right.dueAt);
  if (dueDiff !== 0) return dueDiff;
  return left.title.localeCompare(right.title);
}

export function MyTasksView({
  tasks,
  currentUserId,
  priorityLabels,
  statusLabels,
  onOpenTask
}: MyTasksViewProps) {
  const assignedTasks = tasks
    .filter((task) => task.assignees.some((assignee) => assignee.id === currentUserId))
    .sort(sortMyTasks);
  const openTasks = assignedTasks.filter((task) => task.status !== 'done');
  const overdueTasks = assignedTasks.filter(isOverdue);
  const doneTasks = assignedTasks.filter((task) => task.status === 'done');

  return (
    <section className="workspace-module my-tasks-module">
      <div className="module-heading">
        <div>
          <p className="section-kicker">My work</p>
          <h2>My tasks</h2>
          <p>Tasks assigned to you in the selected project, ordered by urgency.</p>
        </div>
        <span className="count-badge">{assignedTasks.length}</span>
      </div>

      <div className="module-summary-grid" aria-label="My task summary">
        <div className="module-summary-card urgent">
          <span>{overdueTasks.length}</span>
          <small>Overdue</small>
        </div>
        <div className="module-summary-card">
          <span>{openTasks.length}</span>
          <small>Open</small>
        </div>
        <div className="module-summary-card done">
          <span>{doneTasks.length}</span>
          <small>Done</small>
        </div>
      </div>

      {assignedTasks.length === 0 ? (
        <div className="soft-empty module-empty">No tasks assigned to you.</div>
      ) : (
        <div className="module-list">
          {assignedTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              className={['module-row', isOverdue(task) ? 'is-overdue' : ''].filter(Boolean).join(' ')}
              onClick={() => onOpenTask(task.id)}
            >
              <span className="module-row-main">
                <strong>{task.title}</strong>
                <small>{statusLabels[task.status]} · {formatDueDate(task.dueAt)}</small>
              </span>
              <span className={'status-chip status-' + task.status.replace('_', '-')}>{statusLabels[task.status]}</span>
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
