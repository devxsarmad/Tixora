import { formatDueDate } from '../../lib/formatters.js';
import type { TaskSummary } from '../tasks/types.js';

type ActivityViewProps = {
  tasks: TaskSummary[];
  statusLabels: Record<TaskSummary['status'], string>;
  onOpenTask: (taskId: string) => void;
};

export function ActivityView({ tasks, statusLabels, onOpenTask }: ActivityViewProps) {
  const activityItems = tasks
    .filter((task) => task.commentCount > 0 || task.assignees.length > 0 || task.status !== 'todo')
    .slice(0, 20);

  return (
    <section className="workspace-module">
      <div className="module-heading">
        <div>
          <p className="section-kicker">Recent signals</p>
          <h2>Activity</h2>
          <p>Current project activity summarized from task status, assignees, and comments.</p>
        </div>
        <span className="count-badge">{activityItems.length}</span>
      </div>

      {activityItems.length === 0 ? (
        <div className="soft-empty module-empty">No activity yet.</div>
      ) : (
        <div className="activity-feed">
          {activityItems.map((task) => (
            <button key={task.id} type="button" className="activity-row" onClick={() => onOpenTask(task.id)}>
              <span className="activity-marker" />
              <span className="module-row-main">
                <strong>{task.title}</strong>
                <small>
                  {statusLabels[task.status]} · {task.assignees.length} assignee{task.assignees.length === 1 ? '' : 's'} · {task.commentCount} comment{task.commentCount === 1 ? '' : 's'} · {formatDueDate(task.dueAt)}
                </small>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
