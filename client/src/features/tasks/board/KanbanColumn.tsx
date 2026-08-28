import type { DragEvent } from 'react';
import type { TaskSummary } from '../types.js';
import { TaskCard } from './TaskCard.js';

type KanbanColumnProps = {
  id: TaskSummary['status'];
  title: string;
  tasks: TaskSummary[];
  selectedTaskId: string | null;
  draggingTaskId: string | null;
  isDragOver: boolean;
  priorityLabels: Record<TaskSummary['priority'], string>;
  onOpenTask: (taskId: string) => void;
  onTaskDragStart: (event: DragEvent<HTMLElement>, taskId: string) => void;
  onTaskDragEnd: () => void;
  onColumnDragOver: (event: DragEvent<HTMLElement>, status: TaskSummary['status']) => void;
  onColumnDragLeave: (status: TaskSummary['status']) => void;
  onColumnDrop: (event: DragEvent<HTMLElement>, status: TaskSummary['status']) => void;
};

export function KanbanColumn({
  id,
  title,
  tasks,
  selectedTaskId,
  draggingTaskId,
  isDragOver,
  priorityLabels,
  onOpenTask,
  onTaskDragStart,
  onTaskDragEnd,
  onColumnDragOver,
  onColumnDragLeave,
  onColumnDrop
}: KanbanColumnProps) {
  const statusClass = 'kanban-column status-' + id.replace('_', '-');

  return (
    <section
      className={isDragOver ? statusClass + ' drag-over' : statusClass}
      onDragOver={(event) => onColumnDragOver(event, id)}
      onDragLeave={() => onColumnDragLeave(id)}
      onDrop={(event) => onColumnDrop(event, id)}
    >
      <div className="kanban-column-header">
        <h3>{title}</h3>
        <span>{tasks.length}</span>
      </div>
      <div className="kanban-card-list">
        {tasks.length === 0 ? <div className="soft-empty">No tasks</div> : null}
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            isActive={task.id === selectedTaskId}
            isDragging={draggingTaskId === task.id}
            priorityLabel={priorityLabels[task.priority]}
            onOpen={onOpenTask}
            onDragStart={onTaskDragStart}
            onDragEnd={onTaskDragEnd}
          />
        ))}
      </div>
    </section>
  );
}
