import { useCallback, useMemo, useState } from 'react';
import type { TaskSummary } from '../types.js';
import type { TaskFilters } from '../api.js';

export type TaskFilterState = {
  status: TaskSummary['status'] | 'all';
  priority: TaskSummary['priority'] | 'all';
  assigneeId: string;
  due: 'all' | 'overdue' | 'upcoming';
  search: string;
};

const defaultFilters: TaskFilterState = {
  status: 'all',
  priority: 'all',
  assigneeId: 'all',
  due: 'all',
  search: ''
};

export function useTaskFilters() {
  const [filters, setFilters] = useState<TaskFilterState>(defaultFilters);

  const setFilter = useCallback(<K extends keyof TaskFilterState>(
    key: K,
    value: TaskFilterState[K]
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const queryFilters = useMemo<TaskFilters>(
    () => ({
      status: filters.status === 'all' ? undefined : filters.status,
      priority: filters.priority === 'all' ? undefined : filters.priority,
      assigneeId: filters.assigneeId === 'all' ? undefined : filters.assigneeId,
      due: filters.due === 'all' ? undefined : filters.due
    }),
    [filters.assigneeId, filters.due, filters.priority, filters.status]
  );

  const getFilteredTasks = useCallback(
    (tasks: TaskSummary[]) => {
      const query = filters.search.trim().toLowerCase();
      if (!query) return tasks;

      return tasks.filter((task) =>
        [
          task.title,
          task.description ?? '',
          ...task.assignees.map((user) => user.displayName)
        ]
          .join(' ')
          .toLowerCase()
          .includes(query)
      );
    },
    [filters.search]
  );

  return { filters, setFilter, resetFilters, queryFilters, getFilteredTasks };
}
