import { zodResolver } from '@hookform/resolvers/zod';
import type { DragEvent } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { getInitials } from '../../lib/formatters.js';
import type { ProjectMember, ProjectSummary } from '../projects/types.js';
import { KanbanBoard } from '../tasks/board/KanbanBoard.js';
import { TaskFilterPopover } from '../tasks/filters/TaskFilterPopover.js';
import type { TaskFilterState } from '../tasks/filters/useTaskFilters.js';
import type { TaskSummary } from '../tasks/types.js';
import type { TeamSummary } from '../organizations/types.js';
import { projectFormSchema, type ProjectFormValues } from './workspaceSchemas.js';

type TaskColumn = {
  id: TaskSummary['status'];
  title: string;
  tasks: TaskSummary[];
};

type WorkspaceMainProps = {
  error: string | null;
  isLoading: boolean;
  shouldShowSetupFlow: boolean;
  setupStep: number;
  selectedTeamSlug: string | null;
  selectedTeam: TeamSummary | null;
  selectedProject: ProjectSummary | null;
  projectMembers: ProjectMember[];
  tasks: TaskSummary[];
  taskFilters: TaskFilterState;
  taskColumns: TaskColumn[];
  selectedTaskId: string | null;
  draggingTaskId: string | null;
  dragOverStatus: TaskSummary['status'] | null;
  priorityLabels: Record<TaskSummary['priority'], string>;
  statusLabels: Record<TaskSummary['status'], string>;
  isProjectFormOpen: boolean;
  onCreateOrganization: (name: string) => Promise<void> | void;
  onCreateProject: (values: ProjectFormValues) => Promise<void> | void;
  onCloseProjectForm: () => void;
  onProjectValidationError: () => void;
  onOpenProjectSettings: () => void;
  onOpenCreateTask: () => void;
  onOpenOrganizationMembers: () => void;
  onFilterChange: <K extends keyof TaskFilterState>(key: K, value: TaskFilterState[K]) => void;
  onOpenTask: (taskId: string) => void;
  onTaskDragStart: (event: DragEvent<HTMLElement>, taskId: string) => void;
  onTaskDragEnd: () => void;
  onColumnDragOver: (event: DragEvent<HTMLElement>, status: TaskSummary['status']) => void;
  onColumnDragLeave: (status: TaskSummary['status']) => void;
  onColumnDrop: (event: DragEvent<HTMLElement>, status: TaskSummary['status']) => void;
};

export function WorkspaceMain({
  error,
  isLoading,
  shouldShowSetupFlow,
  setupStep,
  selectedTeamSlug,
  selectedTeam,
  selectedProject,
  projectMembers,
  tasks,
  taskFilters,
  taskColumns,
  selectedTaskId,
  draggingTaskId,
  dragOverStatus,
  priorityLabels,
  statusLabels,
  isProjectFormOpen,
  onCreateOrganization,
  onCreateProject,
  onCloseProjectForm,
  onProjectValidationError,
  onOpenProjectSettings,
  onOpenCreateTask,
  onOpenOrganizationMembers,
  onFilterChange,
  onOpenTask,
  onTaskDragStart,
  onTaskDragEnd,
  onColumnDragOver,
  onColumnDragLeave,
  onColumnDrop
}: WorkspaceMainProps) {
  const [workspaceName, setWorkspaceName] = useState('');
  const projectForm = useForm<ProjectFormValues>({
    defaultValues: { name: '', description: '' },
    resolver: zodResolver(projectFormSchema)
  });

  async function handleCreateOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreateOrganization(workspaceName);
    setWorkspaceName('');
  }

  async function handleCreateProject(values: ProjectFormValues) {
    await onCreateProject(values);
    projectForm.reset();
    onCloseProjectForm();
  }

  return (
    <section className="board-workspace">
      {error ? <p className="error-message">{error}</p> : null}

      {isLoading ? (
        <section className="empty-state">Loading organization...</section>
      ) : shouldShowSetupFlow ? (
        <section className="setup-flow">
          <div className="setup-intro">
            <p className="section-kicker">Organization setup</p>
            <h1>Set up your ticket board</h1>
            <p>
              First create the organization and first project. Then you land on
              the board, where task creation and teammate invites are always available.
            </p>
          </div>

          <div className="setup-steps">
            {[
              [1, 'Organization', 'Top-level account'],
              [2, 'Project', 'Board for tickets']
            ].map(([step, title, body]) => (
              <div
                key={step}
                className={
                  setupStep > Number(step)
                    ? 'setup-step done'
                    : setupStep === Number(step)
                      ? 'setup-step active'
                      : 'setup-step'
                }
              >
                <span>{step}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="setup-card">
            {setupStep === 1 ? (
              <>
                <div className="setup-card-heading">
                  <h2>Create organization</h2>
                  <p>This is where your members, projects, and ticket boards live.</p>
                </div>
                <form className="setup-form vertical" onSubmit={handleCreateOrganization}>
                  <label>
                    Organization name
                    <input
                      value={workspaceName}
                      onChange={(event) => setWorkspaceName(event.target.value)}
                      placeholder="Example: Acme Operations"
                    />
                  </label>
                  <button type="submit" className="primary-button">Create organization</button>
                </form>
              </>
            ) : null}

            {setupStep === 2 ? (
              <>
                <div className="setup-card-heading">
                  <h2>Create project</h2>
                  <p>Projects are the boards where your tickets live.</p>
                </div>
                <form
                  className="setup-form vertical"
                  onSubmit={projectForm.handleSubmit(handleCreateProject, onProjectValidationError)}
                >
                  <label>
                    Project name
                    <input {...projectForm.register('name')} placeholder="Example: Website Launch" />
                  </label>
                  <label>
                    Description
                    <input {...projectForm.register('description')} placeholder="Short project purpose" />
                  </label>
                  {projectForm.formState.errors.name ? (
                    <span className="field-error">{projectForm.formState.errors.name.message}</span>
                  ) : null}
                  <button type="submit" className="primary-button">Create project</button>
                </form>
              </>
            ) : null}
          </div>
        </section>
      ) : !selectedTeamSlug ? (
        <section className="board-empty-panel">
          <div>
            <p className="section-kicker">No organization</p>
            <h2>Create an organization to start</h2>
            <p>
              After login, this is your tickets board. Create an organization
              here, then add projects, members, and tasks from the board.
            </p>
          </div>
          <form className="setup-form vertical" onSubmit={handleCreateOrganization}>
            <label>
              Organization name
              <input
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                placeholder="Example: Acme Operations"
              />
            </label>
            <button type="submit" className="primary-button">Create organization</button>
          </form>
        </section>
      ) : (
        <>
          <header className="board-header">
            <div className="project-title">
              <div>
                <h1>{selectedProject?.name ?? 'Select a project'}</h1>
                <p>{selectedProject?.description ?? selectedTeam?.name}</p>
              </div>
            </div>

            <div className="board-actions">
              <div className="assignee-stack header-stack">
                {projectMembers.slice(0, 4).map((member) => (
                  <span key={member.id} className="avatar">{getInitials(member.displayName)}</span>
                ))}
                {projectMembers.length > 4 ? (
                  <span className="avatar overflow-avatar">+{projectMembers.length - 4}</span>
                ) : null}
              </div>
              <button type="button" className="ghost-button" disabled={!selectedProject} onClick={onOpenProjectSettings}>
                Project settings
              </button>
              <button type="button" className="primary-button" disabled={!selectedProject} onClick={onOpenCreateTask}>
                + Create task
              </button>
            </div>
          </header>

          <div className="board-toolbar compact-toolbar">
            <input
              value={taskFilters.search}
              onChange={(event) => onFilterChange('search', event.target.value)}
              disabled={!selectedProject}
              placeholder="Search tasks..."
            />
            <TaskFilterPopover
              disabled={!selectedProject}
              filters={taskFilters}
              projectMembers={projectMembers}
              priorityLabels={priorityLabels}
              statusLabels={statusLabels}
              onFilterChange={onFilterChange}
            />
          </div>

          {isProjectFormOpen ? (
            <form
              id="project-create-form"
              className="inline-create-panel board-create-panel"
              onSubmit={projectForm.handleSubmit(handleCreateProject, onProjectValidationError)}
            >
              <input {...projectForm.register('name')} placeholder="Project name" />
              <input {...projectForm.register('description')} placeholder="Short description" />
              <button type="submit" className="primary-button">Create project</button>
              {projectForm.formState.errors.name ? (
                <span className="field-error form-wide">{projectForm.formState.errors.name.message}</span>
              ) : null}
            </form>
          ) : null}

          {selectedProject && tasks.length === 0 ? (
            <section className="board-empty-panel board-empty-actions">
              <div>
                <p className="section-kicker">Empty board</p>
                <h2>Start your project</h2>
                <p>Create the first ticket or invite teammates before planning work.</p>
              </div>
              <div className="empty-cta-row">
                <button type="button" className="primary-button equal-cta" onClick={onOpenCreateTask}>
                  Create your first task
                </button>
                <button type="button" className="ghost-button equal-cta" onClick={onOpenOrganizationMembers}>
                  Invite your team
                </button>
              </div>
            </section>
          ) : null}

          {!selectedProject ? (
            <section className="locked-panel">
              <p className="section-kicker">Project required</p>
              <h3>Create or select a project</h3>
              <p>
                Use the Projects area in the sidebar to choose a project, or
                create a new one to unlock the board.
              </p>
            </section>
          ) : (
            <KanbanBoard
              columns={taskColumns}
              selectedTaskId={selectedTaskId}
              draggingTaskId={draggingTaskId}
              dragOverStatus={dragOverStatus}
              priorityLabels={priorityLabels}
              onOpenTask={onOpenTask}
              onTaskDragStart={onTaskDragStart}
              onTaskDragEnd={onTaskDragEnd}
              onColumnDragOver={onColumnDragOver}
              onColumnDragLeave={onColumnDragLeave}
              onColumnDrop={onColumnDrop}
            />
          )}
        </>
      )}
    </section>
  );
}
