import { useState, type DragEvent } from 'react';
import type { TaskSummary } from '../types.js';

type Status = TaskSummary['status'];

export function useDragAndDrop(
  tasks: TaskSummary[],
  onStatusChange: (taskId: string, status: Status) => Promise<void> | void
) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<Status | null>(null);

  function handleTaskDragStart(event: DragEvent<HTMLElement>, taskId: string) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', taskId);
    setDraggingTaskId(taskId);
  }

  function handleTaskDragEnd() {
    setDraggingTaskId(null);
    setDragOverStatus(null);
  }

  function handleColumnDragOver(event: DragEvent<HTMLElement>, status: Status) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  }

  function handleColumnDragLeave(status: Status) {
    setDragOverStatus((current) => (current === status ? null : current));
  }

  async function handleColumnDrop(event: DragEvent<HTMLElement>, status: Status) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData('text/plain') || draggingTaskId;
    setDraggingTaskId(null);
    setDragOverStatus(null);

    if (!taskId) return;

    const task = tasks.find((currentTask) => currentTask.id === taskId);
    if (!task || task.status === status) return;

    await onStatusChange(taskId, status);
  }

  return {
    draggingTaskId,
    dragOverStatus,
    handleTaskDragStart,
    handleTaskDragEnd,
    handleColumnDragOver,
    handleColumnDragLeave,
    handleColumnDrop
  };
}
