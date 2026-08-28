import { useState } from 'react';
import type { ProjectMember } from '../../projects/types.js';
import type { TaskSummary } from '../types.js';
import type { TaskFilterState } from './useTaskFilters.js';

type TaskFilterPopoverProps = {
  disabled?: boolean;
  filters: TaskFilterState;
  projectMembers: ProjectMember[];
  priorityLabels: Record<TaskSummary['priority'], string>;
  statusLabels: Record<TaskSummary['status'], string>;
  onFilterChange: <K extends keyof TaskFilterState>(
    key: K,
    value: TaskFilterState[K]
  ) => void;
};

export function TaskFilterPopover({
  disabled,
  filters,
  projectMembers,
  priorityLabels,
  statusLabels,
  onFilterChange
}: TaskFilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="filters-menu">
      <button
        type="button"
        className="ghost-button filters-button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
      >
        Filters
      </button>
      {isOpen ? (
        <div className="filters-popover">
          <label>
            Status
            <select
              value={filters.status}
              onChange={(event) =>
                onFilterChange(
                  'status',
                  event.target.value as TaskSummary['status'] | 'all'
                )
              }
            >
              <option value="all">All status</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Assignee
            <select
              value={filters.assigneeId}
              onChange={(event) => onFilterChange('assigneeId', event.target.value)}
            >
              <option value="all">All assignees</option>
              {projectMembers.map((member) => (
                <option key={member.id} value={member.id}>{member.displayName}</option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select
              value={filters.priority}
              onChange={(event) =>
                onFilterChange(
                  'priority',
                  event.target.value as TaskSummary['priority'] | 'all'
                )
              }
            >
              <option value="all">All priority</option>
              {Object.entries(priorityLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Due date
            <select
              value={filters.due}
              onChange={(event) =>
                onFilterChange('due', event.target.value as TaskFilterState['due'])
              }
            >
              <option value="all">All due dates</option>
              <option value="overdue">Overdue</option>
              <option value="upcoming">Upcoming</option>
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
}
