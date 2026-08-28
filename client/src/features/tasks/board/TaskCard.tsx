import type { DragEvent } from 'react';
import { formatDueDate, getInitials } from '../../../lib/formatters.js';
import type { TaskSummary } from '../types.js';

type TaskCardProps = {
  task: TaskSummary;
  isActive: boolean;
  isDragging: boolean;
  priorityLabel: string;
  onOpen: (taskId: string) => void;
  onDragStart: (event: DragEvent<HTMLElement>, taskId: string) => void;
  onDragEnd: () => void;
};

export function TaskCard({
  task,
  isActive,
  isDragging,
  priorityLabel,
  onOpen,
  onDragStart,
  onDragEnd
}: TaskCardProps) {
  return (
    <article
      draggable
      className={[
        isActive ? 'task-card active' : 'task-card',
        isDragging ? 'dragging' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      onDragStart={(event) => onDragStart(event, task.id)}
      onDragEnd={onDragEnd}
    >
      <button
        type="button"
        className="task-card-main"
        onClick={() => onOpen(task.id)}
      >
        <span className="task-card-title-row">
          <strong>{task.title}</strong>
          <span
            className={'priority-icon ' + task.priority}
            aria-label={priorityLabel + ' priority'}
          />
        </span>
        <span className="task-card-footer">
          <span className="task-meta">□ {formatDueDate(task.dueAt)}</span>
          <span className="mini-avatar-stack">
            {task.assignees.slice(0, 3).map((assignee) => (
              <span key={assignee.id} className="avatar mini-avatar">
                {getInitials(assignee.displayName)}
              </span>
            ))}
            {task.assignees.length === 0 ? (
              <span className="task-meta">Unassigned</span>
            ) : null}
            {task.assignees.length > 3 ? (
              <span className="task-meta">+{task.assignees.length - 3}</span>
            ) : null}
          </span>
          <span className="task-meta">◇ {task.commentCount}</span>
        </span>
      </button>
    </article>
  );
}
