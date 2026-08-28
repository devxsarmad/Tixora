import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { getInitials } from '../../lib/formatters.js';
import type { ProjectMember } from '../projects/types.js';
import type { TaskSummary } from './types.js';
import { taskFormSchema, type TaskFormValues } from '../workspace/workspaceSchemas.js';

type CreateTaskModalProps = {
  isOpen: boolean;
  projectName?: string;
  projectMembers: ProjectMember[];
  priorityLabels: Record<TaskSummary['priority'], string>;
  onClose: () => void;
  isSubmitting?: boolean;
  onSubmit: (values: TaskFormValues) => Promise<boolean | void> | boolean | void;
  onManageProjectMembers: () => void;
  onAddOrganizationMember: () => void;
};

export function CreateTaskModal({
  isOpen,
  projectName,
  projectMembers,
  priorityLabels,
  onClose,
  isSubmitting = false,
  onSubmit,
  onManageProjectMembers,
  onAddOrganizationMember
}: CreateTaskModalProps) {
  const [taskAssigneeSearch, setTaskAssigneeSearch] = useState('');
  const taskForm = useForm<TaskFormValues>({
    defaultValues: {
      title: '',
      description: '',
      dueAt: '',
      priority: 'medium',
      assigneeIds: []
    },
    resolver: zodResolver(taskFormSchema)
  });

  const filteredTaskAssignees = useMemo(() => {
    const query = taskAssigneeSearch.trim().toLowerCase();

    if (!query) return projectMembers;

    return projectMembers.filter((member) =>
      (member.displayName + ' ' + member.email).toLowerCase().includes(query)
    );
  }, [projectMembers, taskAssigneeSearch]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="task-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-task-title"
      >
        <div className="modal-heading">
          <div>
            <h2 id="create-task-title">Create task</h2>
            <p>{projectName}</p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close create task"
          >
            ×
          </button>
        </div>
        <form
          className="modal-form"
          onSubmit={taskForm.handleSubmit(async (values) => {
            const didSubmit = await onSubmit(values);
            if (didSubmit !== false) {
              taskForm.reset({
                title: '',
                description: '',
                dueAt: '',
                priority: 'medium',
                assigneeIds: []
              });
              setTaskAssigneeSearch('');
            }
          })}
        >
          <label>
            Task title
            <input {...taskForm.register('title')} placeholder="Review API smoke test" />
          </label>
          {taskForm.formState.errors.title ? (
            <span className="field-error">
              {taskForm.formState.errors.title.message}
            </span>
          ) : null}
          <label>
            Priority
            <select {...taskForm.register('priority')}>
              {Object.entries(priorityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Description
            <input
              {...taskForm.register('description')}
              placeholder="What needs to be done?"
            />
          </label>
          <label>
            Due date
            <input {...taskForm.register('dueAt')} type="datetime-local" />
          </label>
          <section className="assignee-picker">
            <div className="panel-title-row">
              <h3>Assign to</h3>
              <span className="meta-text">{projectMembers.length} available</span>
            </div>
            <p className="meta-text">
              Only project members can be assigned to this task.
            </p>
            <input
              value={taskAssigneeSearch}
              onChange={(event) => setTaskAssigneeSearch(event.target.value)}
              placeholder="Search project members..."
            />
            {projectMembers.length ? (
              <div className="check-list compact-checks">
                {filteredTaskAssignees.length === 0 ? (
                  <p className="meta-text">No matching project members.</p>
                ) : null}
                {filteredTaskAssignees.map((member) => (
                  <label key={member.id} className="check-row assignee-option">
                    <input
                      type="checkbox"
                      value={member.id}
                      {...taskForm.register('assigneeIds')}
                    />
                    <span className="avatar">{getInitials(member.displayName)}</span>
                    <span>{member.displayName}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="meta-text">
                No project members yet. Add organization members to this project first.
              </p>
            )}
            <div className="assignee-helper-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={onManageProjectMembers}
              >
                Manage project members
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={onAddOrganizationMember}
              >
                Add organization member
              </button>
            </div>
          </section>
          <div className="modal-actions">
            <button type="button" className="ghost-button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create task'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
