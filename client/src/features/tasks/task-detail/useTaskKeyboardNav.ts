import { useEffect } from 'react';
import type { TaskSummary } from '../types.js';

export function useTaskKeyboardNav(
  isOpen: boolean,
  tasks: TaskSummary[],
  selectedTaskId: string | null,
  onNavigate: (taskId: string) => void,
  onClose: () => void
) {
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (!selectedTaskId || tasks.length === 0) return;
      const currentIndex = tasks.findIndex((task) => task.id === selectedTaskId);
      if (currentIndex < 0) return;

      if (event.key === 'j' || event.key === 'ArrowDown') {
        event.preventDefault();
        onNavigate(tasks[Math.min(currentIndex + 1, tasks.length - 1)].id);
      }

      if (event.key === 'k' || event.key === 'ArrowUp') {
        event.preventDefault();
        onNavigate(tasks[Math.max(currentIndex - 1, 0)].id);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onNavigate, selectedTaskId, tasks]);
}
