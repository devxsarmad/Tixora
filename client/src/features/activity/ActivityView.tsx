import { formatDueDate } from '../../lib/formatters.js';
import type { TaskSummary } from '../tasks/types.js';

type ActivityViewProps = {
  tasks: TaskSummary[];
  statusLabels: Record<TaskSummary['status'], string>;
  onOpenTask: (taskId: string) => void;
};

function getActivityLabel(task: TaskSummary) {
  if (task.status === 'blocked') return 'Needs attention';
  if (task.status === 'done') return 'Completed';
  if (task.commentCount > 0) return 'Has discussion';
  if (task.assignees.length > 0) return 'Assigned';
  return 'Updated';
}

function parseDueTime(value: string | null) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function getActivityWeight(task: TaskSummary) {
  if (task.status === 'blocked') return 0;
  if (task.commentCount > 0) return 1;
  if (task.assignees.length > 0) return 2;
  if (task.status === 'done') return 3;
  return 4;
}

function sortActivityItems(left: TaskSummary, right: TaskSummary) {
  const weightDiff = getActivityWeight(left) - getActivityWeight(right);
  if (weightDiff !== 0) return weightDiff;
  const dueDiff = parseDueTime(left.dueAt) - parseDueTime(right.dueAt);
  if (dueDiff !== 0) return dueDiff;
  return left.title.localeCompare(right.title);
}

export function ActivityView({ tasks, statusLabels, onOpenTask }: ActivityViewProps) {
  const activityItems = tasks
    .filter((task) => task.commentCount > 0 || task.assignees.length > 0 || task.status !== 'todo')
    .sort(sortActivityItems)
    .slice(0, 20);
  const blockedCount = tasks.filter((task) => task.status === 'blocked').length;
  const discussedCount = tasks.filter((task) => task.commentCount > 0).length;
  const assignedCount = tasks.filter((task) => task.assignees.length > 0).length;

  return (
    <section className="workspace-module activity-module">
      <div className="module-heading">
        <div>
          <h2>Activity</h2>
          <p>Recent project movement summarized from status, assignees, and comments.</p>
        </div>
        <span className="count-badge">{activityItems.length}</span>
      </div>

      <div className="module-summary-grid" aria-label="Project activity summary">
        <div className="module-summary-card urgent">
          <span>{blockedCount}</span>
          <small>Blocked</small>
        </div>
        <div className="module-summary-card">
          <span>{discussedCount}</span>
          <small>Discussed</small>
        </div>
        <div className="module-summary-card done">
          <span>{assignedCount}</span>
          <small>Assigned</small>
        </div>
      </div>

      {activityItems.length === 0 ? (
        <div className="soft-empty module-empty">No activity yet.</div>
      ) : (
        <div className="activity-feed">
          {activityItems.map((task) => (
            <button key={task.id} type="button" className={'activity-row status-' + task.status.replace('_', '-')} onClick={() => onOpenTask(task.id)}>
              <span className="activity-marker" />
              <span className="module-row-main">
                <strong>{task.title}</strong>
                <small>
                  {getActivityLabel(task)} · {statusLabels[task.status]} · {task.assignees.length} assignee{task.assignees.length === 1 ? '' : 's'} · {task.commentCount} comment{task.commentCount === 1 ? '' : 's'} · {formatDueDate(task.dueAt)}
                </small>
              </span>
              <span className={'status-chip status-' + task.status.replace('_', '-')}>{statusLabels[task.status]}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
