import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  formatDueDate,
  formatTimestamp,
  getInitials,
  toDateTimeInputValue
} from '../../../lib/formatters.js';
import type { CommentSummary } from '../../comments/types.js';
import type { ProjectDetail, ProjectMember, ProjectSummary } from '../../projects/types.js';
import type {
  CommentFormValues,
  TaskEditFormValues
} from '../../workspace/workspaceSchemas.js';
import {
  commentFormSchema,
  taskEditFormSchema
} from '../../workspace/workspaceSchemas.js';
import type { TaskSummary } from '../types.js';
import { AssigneePicker } from '../components/AssigneePicker.js';

type TaskDetailDrawerProps = {
  isOpen: boolean;
  task: TaskSummary | null;
  taskNumber: number | null;
  project: ProjectSummary | null;
  projectDetail: ProjectDetail | null;
  workspaceMemberCount: number;
  projectMembers: ProjectMember[];
  comments: CommentSummary[];
  priorityLabels: Record<TaskSummary['priority'], string>;
  statusLabels: Record<TaskSummary['status'], string>;
  isSavingTask?: boolean;
  isCreatingComment?: boolean;
  isUpdatingComment?: boolean;
  isDeletingComment?: boolean;
  onClose: () => void;
  onUpdateTask: (values: TaskEditFormValues) => Promise<void> | void;
  onCreateComment: (values: CommentFormValues) => Promise<void> | void;
  onUpdateComment: (commentId: string, values: CommentFormValues) => Promise<void> | void;
  onDeleteComment: (commentId: string) => Promise<void> | void;
  onManageProjectMembers: () => void;
  onAddOrganizationMember: () => void;
};

export function TaskDetailDrawer({
  isOpen,
  task,
  taskNumber,
  project,
  projectDetail,
  workspaceMemberCount,
  projectMembers,
  comments,
  priorityLabels,
  statusLabels,
  isSavingTask = false,
  isCreatingComment = false,
  isUpdatingComment = false,
  isDeletingComment = false,
  onClose,
  onUpdateTask,
  onCreateComment,
  onUpdateComment,
  onDeleteComment,
  onManageProjectMembers,
  onAddOrganizationMember
}: TaskDetailDrawerProps) {
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const taskEditForm = useForm<TaskEditFormValues>({
    defaultValues: { title: '', description: '', dueAt: '', priority: 'medium', assigneeIds: [] },
    resolver: zodResolver(taskEditFormSchema)
  });
  const commentForm = useForm<CommentFormValues>({
    defaultValues: { body: '' },
    resolver: zodResolver(commentFormSchema)
  });
  const commentEditForm = useForm<CommentFormValues>({
    defaultValues: { body: '' },
    resolver: zodResolver(commentFormSchema)
  });

  useEffect(() => {
    taskEditForm.reset({
      title: task?.title ?? '',
      description: task?.description ?? '',
      dueAt: toDateTimeInputValue(task?.dueAt ?? null),
      priority: task?.priority ?? 'medium',
      assigneeIds: task?.assignees.map((user) => user.id) ?? []
    });
  }, [task, taskEditForm]);

  if (!isOpen || !task) return null;

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="task-detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading task-drawer-heading">
          <div>
            <p className="drawer-breadcrumb">
              {project?.name ?? 'Project'} / TASK-{taskNumber ?? '--'}
            </p>
            <h2 id="task-detail-title">{task.title}</h2>
            <p>
              {statusLabels[task.status]} · {formatDueDate(task.dueAt)}
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close task details"
          >
            ×
          </button>
        </div>

        <div className="modal-split">
          <div className="modal-column">
            <form
              className="modal-form"
              onSubmit={taskEditForm.handleSubmit(onUpdateTask)}
            >
              <label>
                Task title
                <input {...taskEditForm.register('title')} placeholder="Task title" aria-invalid={Boolean(taskEditForm.formState.errors.title)} />
              </label>
              {taskEditForm.formState.errors.title ? (
                <span className="field-error">{taskEditForm.formState.errors.title.message}</span>
              ) : null}
              <label>
                Priority
                <select {...taskEditForm.register('priority')}>
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
                  {...taskEditForm.register('description')}
                  placeholder="Description"
                  aria-invalid={Boolean(taskEditForm.formState.errors.description)}
                />
              </label>
              {taskEditForm.formState.errors.description ? (
                <span className="field-error">{taskEditForm.formState.errors.description.message}</span>
              ) : null}
              <label>
                Due date
                <input {...taskEditForm.register('dueAt')} type="datetime-local" />
              </label>
              {projectDetail ? (
                <AssigneePicker
                  members={projectMembers}
                  selectedIds={taskEditForm.watch('assigneeIds') ?? []}
                  workspaceMemberCount={workspaceMemberCount}
                  error={taskEditForm.formState.errors.assigneeIds?.message}
                  disabled={isSavingTask}
                  onChange={(selectedIds) => taskEditForm.setValue('assigneeIds', selectedIds, { shouldDirty: true, shouldValidate: true })}
                  onManageProjectMembers={onManageProjectMembers}
                  onAddOrganizationMember={onAddOrganizationMember}
                />
              ) : null}
              <button type="submit" className="primary-button" disabled={isSavingTask}>
                {isSavingTask ? 'Saving...' : 'Save task'}
              </button>
            </form>
          </div>

          <section className="modal-column comments-section">
            <div className="drawer-tabs">
              <strong>Comments</strong>
              <span>{comments.length}</span>
            </div>
            <form
              className="comment-form drawer-comment-form"
              onSubmit={commentForm.handleSubmit(async (values) => {
                await onCreateComment(values);
                commentForm.reset();
              })}
            >
              <input {...commentForm.register('body')} placeholder="Add a comment..." />
              <button type="submit" className="primary-button" disabled={isCreatingComment}>
                {isCreatingComment ? 'Sending...' : 'Send'}
              </button>
              {commentForm.formState.errors.body ? (
                <span className="field-error form-wide">
                  {commentForm.formState.errors.body.message}
                </span>
              ) : null}
            </form>
            <div className="comments-list">
              {comments.length === 0 ? <div className="soft-empty">No comments yet.</div> : null}
              {comments.map((comment) => (
                <article key={comment.id} className="comment-item">
                  <span className="avatar">{getInitials(comment.author.displayName)}</span>
                  <div className="comment-content">
                    <div className="comment-meta">
                      <div>
                        <strong>{comment.author.displayName}</strong>
                        <span>{formatTimestamp(comment.createdAt)}</span>
                      </div>
                      <div className="comment-actions">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => {
                            setEditingCommentId(comment.id);
                            commentEditForm.reset({ body: comment.body });
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => void onDeleteComment(comment.id)}
                          disabled={isDeletingComment}
                        >
                          {isDeletingComment ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                    {editingCommentId === comment.id ? (
                      <form
                        className="comment-edit-form"
                        onSubmit={commentEditForm.handleSubmit(async (values) => {
                          await onUpdateComment(comment.id, values);
                          setEditingCommentId(null);
                          commentEditForm.reset();
                        })}
                      >
                        <input {...commentEditForm.register('body')} placeholder="Edit comment" />
                        <button type="submit" className="primary-button" disabled={isUpdatingComment}>
                          {isUpdatingComment ? 'Saving...' : 'Save'}
                        </button>
                      </form>
                    ) : (
                      <p>{comment.body}</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
