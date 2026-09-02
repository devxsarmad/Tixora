import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { ProjectMember } from '../projects/types.js';
import type { TaskSummary } from './types.js';
import { taskFormSchema, type TaskFormValues } from '../workspace/workspaceSchemas.js';
import { AssigneePicker } from './components/AssigneePicker.js';

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
            <X aria-hidden="true" />
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
            }
          })}
        >
          <label>
            Task title
            <input {...taskForm.register('title')} placeholder="Review API smoke test" aria-invalid={Boolean(taskForm.formState.errors.title)} />
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
              aria-invalid={Boolean(taskForm.formState.errors.description)}
            />
          </label>
          {taskForm.formState.errors.description ? (
            <span className="field-error">
              {taskForm.formState.errors.description.message}
            </span>
          ) : null}
          <label>
            Due date
            <input {...taskForm.register('dueAt')} type="datetime-local" />
          </label>
          <AssigneePicker
            members={projectMembers}
            selectedIds={taskForm.watch('assigneeIds') ?? []}
            error={taskForm.formState.errors.assigneeIds?.message}
            disabled={isSubmitting}
            onChange={(selectedIds) => taskForm.setValue('assigneeIds', selectedIds, { shouldDirty: true, shouldValidate: true })}
            onManageProjectMembers={onManageProjectMembers}
            onAddOrganizationMember={onAddOrganizationMember}
          />
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
