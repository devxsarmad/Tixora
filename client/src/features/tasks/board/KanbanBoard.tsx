import type { DragEvent } from 'react';
import type { TaskSummary } from '../types.js';
import { KanbanColumn } from './KanbanColumn.js';

type TaskColumn = {
  id: TaskSummary['status'];
  title: string;
  tasks: TaskSummary[];
};

type KanbanBoardProps = {
  columns: TaskColumn[];
  selectedTaskId: string | null;
  draggingTaskId: string | null;
  dragOverStatus: TaskSummary['status'] | null;
  priorityLabels: Record<TaskSummary['priority'], string>;
  onOpenTask: (taskId: string) => void;
  onTaskDragStart: (event: DragEvent<HTMLElement>, taskId: string) => void;
  onTaskDragEnd: () => void;
  onColumnDragOver: (event: DragEvent<HTMLElement>, status: TaskSummary['status']) => void;
  onColumnDragLeave: (status: TaskSummary['status']) => void;
  onColumnDrop: (event: DragEvent<HTMLElement>, status: TaskSummary['status']) => void;
};

export function KanbanBoard({
  columns,
  selectedTaskId,
  draggingTaskId,
  dragOverStatus,
  priorityLabels,
  onOpenTask,
  onTaskDragStart,
  onTaskDragEnd,
  onColumnDragOver,
  onColumnDragLeave,
  onColumnDrop
}: KanbanBoardProps) {
  return (
    <div className="kanban-board">
      {columns.map((column) => (
        <KanbanColumn
          key={column.id}
          id={column.id}
          title={column.title}
          tasks={column.tasks}
          selectedTaskId={selectedTaskId}
          draggingTaskId={draggingTaskId}
          isDragOver={dragOverStatus === column.id}
          priorityLabels={priorityLabels}
          onOpenTask={onOpenTask}
          onTaskDragStart={onTaskDragStart}
          onTaskDragEnd={onTaskDragEnd}
          onColumnDragOver={onColumnDragOver}
          onColumnDragLeave={onColumnDragLeave}
          onColumnDrop={onColumnDrop}
        />
      ))}
    </div>
  );
}
