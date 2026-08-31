// Usage:
// Main authenticated workspace UI. Server state is loaded through feature-scoped
// React Query hooks while this screen composes the workspace experience.
import { zodResolver } from '@hookform/resolvers/zod';
import React, {
  type FormEvent,
  useEffect,
  useMemo,
  useState
} from 'react';
import { useForm } from 'react-hook-form';
import { Toast } from '../../components/shared/Toast.js';
import { ActivityView } from '../activity/ActivityView.js';
import { AskTixoraPanel } from '../assistant/AskTixoraPanel.js';
import { CalendarView } from '../calendar/CalendarView.js';
import { MyTasksView } from '../tasks/my-tasks/MyTasksView.js';
import { WorkspaceSidebar } from './WorkspaceSidebar.js';
import type { WorkspaceView } from './workspaceView.js';
import type { AuthResponse } from '../auth/types.js';
import type {
  CommentFormValues,
  ProjectEditFormValues,
  ProjectFormValues,
  TaskEditFormValues,
  TaskFormValues
} from './workspaceSchemas.js';
import {
  projectFormSchema,
} from './workspaceSchemas.js';
import { uniqueById } from '../../lib/collections.js';
import {
  getInitials,
  toApiDateTime
} from '../../lib/formatters.js';
import { OrgMembersModal } from '../organizations/OrgMembersModal.js';
import {
  useAddOrganizationMember,
  useCreateInvitation,
  useCreateOrganization,
  useInvitations,
  useOrganization,
  useOrganizations,
  useRemoveOrganizationMember,
  useUpdateOrganizationMember
} from '../organizations/hooks.js';
import { ProjectSettingsModal } from '../projects/ProjectSettingsModal.js';
import {
  useArchiveProject,
  useCreateProject,
  useProject,
  useProjects,
  useRemoveProjectMember,
  useUpdateProject,
  useUpsertProjectMember
} from '../projects/hooks.js';
import {
  useCreateTask,
  useReplaceTaskAssignees,
  useTasks,
  useUpdateTask
} from '../tasks/hooks.js';
import { KanbanBoard } from '../tasks/board/KanbanBoard.js';
import { CreateTaskModal } from '../tasks/CreateTaskModal.js';
import { TaskDetailDrawer } from '../tasks/task-detail/TaskDetailDrawer.js';
import { useDragAndDrop } from '../tasks/board/useDragAndDrop.js';
import { TaskFilterPopover } from '../tasks/filters/TaskFilterPopover.js';
import { useTaskFilters } from '../tasks/filters/useTaskFilters.js';
import { useTaskKeyboardNav } from '../tasks/task-detail/useTaskKeyboardNav.js';
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useUpdateComment
} from '../comments/hooks.js';
import type {
  CommentSummary,
  ProjectMember,
  TaskSummary
} from './types.js';

type WorkspaceProps = {
  session: AuthResponse;
  entryPoint: 'login' | 'register' | 'restored';
  onLogout: () => void;
};

const priorityLabels: Record<TaskSummary['priority'], string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent'
};

const statusLabels: Record<TaskSummary['status'], string> = {
  todo: 'Todo',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done'
};
const workspaceViews: WorkspaceView[] = ['board', 'my-tasks', 'calendar', 'activity', 'ask'];

function parseWorkspacePath(pathname: string): WorkspaceView {
  const view = pathname.replace(/^\//, '') || 'board';
  return workspaceViews.includes(view as WorkspaceView) ? (view as WorkspaceView) : 'board';
}

function buildWorkspacePath(view: WorkspaceView) {
  return '/' + view;
}

function updateBrowserPath(pathname: string, replace = false) {
  if (window.location.pathname === pathname) return;
  window.history[replace ? 'replaceState' : 'pushState']({}, '', pathname);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function Workspace({ session, entryPoint, onLogout }: WorkspaceProps) {
  const initialView = parseWorkspacePath(window.location.pathname);
  const [routePath, setRoutePath] = useState(() => window.location.pathname);
  const [selectedTeamSlug, setSelectedTeamSlug] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<WorkspaceView>(initialView);
  const [includeArchivedProjects, setIncludeArchivedProjects] = useState(false);
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [isTaskDetailsOpen, setIsTaskDetailsOpen] = useState(false);
  const [isProjectToolsOpen, setIsProjectToolsOpen] = useState(false);
  const [isTeamMembersOpen, setIsTeamMembersOpen] = useState(false);
  const [isOrgSwitcherOpen, setIsOrgSwitcherOpen] = useState(false);
  const [projectSettingsTab, setProjectSettingsTab] = useState<'general' | 'members'>('general');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState(entryPoint !== 'register');
  const [workspaceName, setWorkspaceName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const projectForm = useForm<ProjectFormValues>({
    defaultValues: { name: '', description: '' },
    resolver: zodResolver(projectFormSchema)
  });
  const {
    filters: taskFilters,
    setFilter: setTaskFilter,
    resetFilters: resetTaskFilters,
    queryFilters: taskQueryFilters,
    getFilteredTasks
  } = useTaskFilters();
  const organizationsQuery = useOrganizations(session.accessToken);
  const teams = organizationsQuery.data?.teams ?? [];
  const teamQuery = useOrganization(session.accessToken, selectedTeamSlug);
  const teamDetail = teamQuery.data?.team ?? null;
  const projectsQuery = useProjects(
    session.accessToken,
    selectedTeamSlug,
    includeArchivedProjects
  );
  const projects = projectsQuery.data?.projects ?? [];
  const projectQuery = useProject(session.accessToken, selectedProjectId);
  const projectDetail = projectQuery.data?.project ?? null;
  const tasksQuery = useTasks(
    session.accessToken,
    selectedProjectId,
    taskQueryFilters
  );
  const tasks = tasksQuery.data?.tasks ?? [];
  const commentsQuery = useComments(session.accessToken, selectedTaskId);
  const comments = commentsQuery.data?.comments ?? [];
  const canManageOrganization =
    teamDetail?.role === 'owner' || teamDetail?.role === 'admin';
  const invitationsQuery = useInvitations(
    session.accessToken,
    selectedTeamSlug,
    canManageOrganization
  );
  const invitations = invitationsQuery.data?.invitations ?? [];
  const isLoading = organizationsQuery.isLoading;

  const createOrganizationMutation = useCreateOrganization(session.accessToken);
  const addOrganizationMemberMutation = useAddOrganizationMember(
    session.accessToken,
    selectedTeamSlug
  );
  const updateOrganizationMemberMutation = useUpdateOrganizationMember(
    session.accessToken,
    selectedTeamSlug
  );
  const removeOrganizationMemberMutation = useRemoveOrganizationMember(
    session.accessToken,
    selectedTeamSlug
  );
  const createInvitationMutation = useCreateInvitation(
    session.accessToken,
    selectedTeamSlug
  );
  const createProjectMutation = useCreateProject(
    session.accessToken,
    selectedTeamSlug,
    includeArchivedProjects
  );
  const updateProjectMutation = useUpdateProject(
    session.accessToken,
    selectedProjectId,
    selectedTeamSlug,
    includeArchivedProjects
  );
  const archiveProjectMutation = useArchiveProject(
    session.accessToken,
    selectedProjectId,
    selectedTeamSlug,
    includeArchivedProjects
  );
  const upsertProjectMemberMutation = useUpsertProjectMember(
    session.accessToken,
    selectedProjectId
  );
  const removeProjectMemberMutation = useRemoveProjectMember(
    session.accessToken,
    selectedProjectId
  );
  const createTaskMutation = useCreateTask(
    session.accessToken,
    selectedProjectId,
    taskQueryFilters
  );
  const updateTaskMutation = useUpdateTask(
    session.accessToken,
    selectedProjectId
  );
  const replaceTaskAssigneesMutation = useReplaceTaskAssignees(
    session.accessToken,
    selectedProjectId
  );
  const createCommentMutation = useCreateComment(
    session.accessToken,
    selectedTaskId
  );
  const updateCommentMutation = useUpdateComment(
    session.accessToken,
    selectedTaskId
  );
  const deleteCommentMutation = useDeleteComment(
    session.accessToken,
    selectedTaskId
  );

  const isCreatingOrganization = createOrganizationMutation.isPending;
  const isCreatingProject = createProjectMutation.isPending;
  const isSavingOrganizationMembers =
    addOrganizationMemberMutation.isPending ||
    createInvitationMutation.isPending ||
    updateOrganizationMemberMutation.isPending ||
    removeOrganizationMemberMutation.isPending;
  const isSavingProjectMembers =
    upsertProjectMemberMutation.isPending || removeProjectMemberMutation.isPending;
  const isSavingProject = updateProjectMutation.isPending;
  const isArchivingProject = archiveProjectMutation.isPending;
  const isCreatingTask = createTaskMutation.isPending;
  const isSavingTask = updateTaskMutation.isPending;
  const isSavingAssignees = replaceTaskAssigneesMutation.isPending;
  const isCreatingComment = createCommentMutation.isPending;
  const isUpdatingComment = updateCommentMutation.isPending;
  const isDeletingComment = deleteCommentMutation.isPending;

  const selectedTeam = useMemo(
    () => teams.find((team) => team.slug === selectedTeamSlug) ?? null,
    [selectedTeamSlug, teams]
  );
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks]
  );
  const selectedTaskNumber = useMemo(() => {
    const taskIndex = tasks.findIndex((task) => task.id === selectedTaskId);
    return taskIndex >= 0 ? taskIndex + 1 : null;
  }, [selectedTaskId, tasks]);
  const workspaceMembers = useMemo(
    () => uniqueById(teamDetail?.members ?? []),
    [teamDetail?.members]
  );
  const projectMembers = useMemo(
    () => uniqueById(projectDetail?.members ?? []),
    [projectDetail?.members]
  );
  const setupStep = !selectedTeamSlug ? 1 : 2;
  const shouldShowSetupFlow =
    entryPoint === 'register' && !isSetupComplete && !selectedProject;
  const visibleTasks = useMemo(
    () => getFilteredTasks(tasks),
    [getFilteredTasks, tasks]
  );

  const taskColumns = useMemo<
    Array<{
      id: TaskSummary['status'];
      title: string;
      tasks: TaskSummary[];
    }>
  >(
    () => [
      {
        id: 'todo',
        title: 'To do',
        tasks: visibleTasks.filter((task) => task.status === 'todo')
      },
      {
        id: 'in_progress',
        title: 'In progress',
        tasks: visibleTasks.filter((task) => task.status === 'in_progress')
      },
      {
        id: 'blocked',
        title: 'Blocked',
        tasks: visibleTasks.filter((task) => task.status === 'blocked')
      },
      {
        id: 'done',
        title: 'Done',
        tasks: visibleTasks.filter((task) => task.status === 'done')
      }
    ],
    [visibleTasks]
  );

  function showToast(message: string, tone: 'success' | 'error' = 'success') {
    setToast({ message, tone });
  }

  function showError(fallback: string, caught: unknown) {
    const message = caught instanceof Error ? caught.message : fallback;
    setError(message);
    showToast(message, 'error');
  }

  useEffect(() => {
    if (!toast) return;

    const timeoutId = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    function handlePopState() {
      setRoutePath(window.location.pathname);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const routeView = parseWorkspacePath(routePath);
    setActiveView(routeView);
  }, [routePath]);

  function navigateWorkspace(view: WorkspaceView, replace = false) {
    const nextPath = buildWorkspacePath(view);
    updateBrowserPath(nextPath, replace);
    setRoutePath(nextPath);
  }


  useEffect(() => {
    if (organizationsQuery.isLoading) return;

    if (!selectedTeamSlug && teams[0]) {
      setSelectedTeamSlug(teams[0].slug);
      return;
    }

    if (selectedTeamSlug && !teams.some((team) => team.slug === selectedTeamSlug)) {
      const nextTeamSlug = teams[0]?.slug ?? null;
      setSelectedTeamSlug(nextTeamSlug);
      setSelectedProjectId(null);
      setSelectedTaskId(null);
    }
  }, [organizationsQuery.isLoading, selectedTeamSlug, teams]);

  useEffect(() => {
    if (!selectedTeamSlug) {
      setSelectedProjectId(null);
      return;
    }

    if (projectsQuery.isLoading) return;

    setSelectedProjectId((currentProjectId) => {
      if (projects.some((project) => project.id === currentProjectId)) return currentProjectId;

      const nextProjectId = projects[0]?.id ?? null;
      return nextProjectId;
    });
  }, [projects, projectsQuery.isLoading, selectedTeamSlug]);

  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedTaskId(null);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || tasksQuery.isLoading) return;

    setSelectedTaskId((currentTaskId) => {
      if (!currentTaskId || tasks.some((task) => task.id === currentTaskId)) return currentTaskId;

      setIsTaskDetailsOpen(false);
      return null;
    });
  }, [selectedProjectId, tasks, tasksQuery.isLoading]);



  useEffect(() => {
    if (!selectedTaskId) {
      setIsTaskDetailsOpen(false);
    }
  }, [selectedTaskId]);



  async function handleCreateTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = workspaceName.trim();

    if (!name) {
      setError('Organization name is required.');
      return;
    }

    try {
      setError(null);
      const response = await createOrganizationMutation.mutateAsync({ name });
      setSelectedTeamSlug(response.team.slug);
      navigateWorkspace('board');
      setIsProjectFormOpen(false);
      showToast('Organization created.');
      setWorkspaceName('');
    } catch (createError) {
      showError('Organization creation failed', createError);
    }
  }

  async function handleCreateProject(values: ProjectFormValues) {
    if (!selectedTeamSlug) {
      setError('Select or create an organization before creating a project.');
      return;
    }

    try {
      setError(null);
      const response = await createProjectMutation.mutateAsync({
        name: values.name,
        description: values.description || undefined
      });
      setSelectedProjectId(response.project.id);
      setSelectedTaskId(null);
      navigateWorkspace('board');
      projectForm.reset();
      setIsProjectFormOpen(false);
      showToast('Project created.');
      if (entryPoint === 'register') {
        setIsSetupComplete(true);
      }
    } catch (createError) {
      showError('Project creation failed', createError);
    }
  }

  async function handleAddOrganizationMembers(
    emails: string[],
    role: 'admin' | 'member'
  ) {
    if (!selectedTeamSlug) return;

    if (emails.length === 0) {
      setError('Select registered members or enter an email to invite.');
      return;
    }

    try {
      setError(null);
      await Promise.all(
        emails.map((email) =>
          addOrganizationMemberMutation.mutateAsync({ email, role })
        )
      );
      showToast(emails.length === 1 ? 'Organization member added.' : emails.length + ' organization members added.');
      setIsTeamMembersOpen(false);
    } catch (memberError) {
      showError('Organization user update failed', memberError);
    }
  }

  async function handleInviteOrganizationMember(
    email: string,
    role: 'admin' | 'member'
  ) {
    if (!selectedTeamSlug) return;

    try {
      setError(null);
      await createInvitationMutation.mutateAsync({ email, role });
      showToast('Invitation sent.');
      setIsTeamMembersOpen(false);
    } catch (memberError) {
      showError('Organization user update failed', memberError);
    }
  }

  async function handleTeamRoleChange(
    userId: string,
    role: 'admin' | 'member'
  ) {
    if (!selectedTeamSlug) return;

    try {
      setError(null);
      await updateOrganizationMemberMutation.mutateAsync({ userId, role });
      showToast('Organization role updated.');
      setIsTeamMembersOpen(false);
    } catch (memberError) {
      showError('Organization user role update failed', memberError);
    }
  }

  async function handleRemoveTeamMember(userId: string) {
    if (!selectedTeamSlug) return;

    try {
      setError(null);
      await removeOrganizationMemberMutation.mutateAsync(userId);
      showToast('Organization member removed.');
      setIsTeamMembersOpen(false);
    } catch (memberError) {
      showError('Organization user remove failed', memberError);
    }
  }

  async function handleAddProjectMembers(
    userIds: string[],
    role: ProjectMember['role']
  ) {
    if (!selectedProjectId || userIds.length === 0) {
      setError('Select at least one organization user to add to the project.');
      return;
    }

    try {
      setError(null);
      await Promise.all(
        userIds.map((userId) =>
          upsertProjectMemberMutation.mutateAsync({ userId, role })
        )
      );
      showToast(userIds.length === 1 ? 'Project member added.' : userIds.length + ' project members added.');
      setIsProjectToolsOpen(false);
    } catch (memberError) {
      showError('Project member update failed', memberError);
    }
  }

  async function handleProjectRoleChange(
    userId: string,
    role: ProjectMember['role']
  ) {
    if (!selectedProjectId) return;

    try {
      setError(null);
      await upsertProjectMemberMutation.mutateAsync({ userId, role });
      showToast('Project role updated.');
      setIsProjectToolsOpen(false);
    } catch (memberError) {
      showError('Project member role update failed', memberError);
    }
  }

  async function handleRemoveProjectMember(userId: string) {
    if (!selectedProjectId) return;

    try {
      setError(null);
      await removeProjectMemberMutation.mutateAsync(userId);
      showToast('Project member removed.');
      setIsProjectToolsOpen(false);
    } catch (memberError) {
      showError('Project member remove failed', memberError);
    }
  }

  async function handleUpdateProject(values: ProjectEditFormValues) {
    if (!selectedProjectId) return;

    try {
      setError(null);
      await updateProjectMutation.mutateAsync({
        name: values.name,
        description: values.description?.trim() || null
      });
      showToast('Project saved.');
      setIsProjectToolsOpen(false);
    } catch (updateError) {
      showError('Project update failed', updateError);
    }
  }

  async function handleArchiveProject() {
    if (!selectedProjectId) return;

    try {
      setError(null);
      const response = await archiveProjectMutation.mutateAsync();
      setSelectedProjectId((currentId) => {
        if (currentId !== response.project.id) return currentId;
        const nextProject = projects.find(
          (project) => project.id !== response.project.id
        );
        return nextProject?.id ?? null;
      });
      showToast('Project archived.');
      setIsProjectToolsOpen(false);
    } catch (archiveError) {
      showError('Project archive failed', archiveError);
    }
  }

  async function handleCreateTask(values: TaskFormValues) {
    if (!selectedProjectId) {
      setError('Create or select a project before creating a task.');
      return;
    }

    try {
      setError(null);
      const response = await createTaskMutation.mutateAsync({
        title: values.title,
        description: values.description || undefined,
        dueAt: toApiDateTime(values.dueAt),
        priority: values.priority,
        assigneeIds: values.assigneeIds ?? []
      });
      resetTaskFilters();
      setSelectedTaskId(response.task.id);
      navigateWorkspace('board');
      setIsTaskFormOpen(false);
      setIsSetupComplete(true);
      showToast('Task created.');
      return true;
    } catch (createError) {
      showError('Task creation failed', createError);
      return false;
    }
  }
  async function handleUpdateTask(values: TaskEditFormValues) {
    if (!selectedTaskId) return;

    try {
      setError(null);
      const response = await updateTaskMutation.mutateAsync({
        taskId: selectedTaskId,
        values: {
          title: values.title,
          description: values.description || null,
          dueAt: toApiDateTime(values.dueAt),
          priority: values.priority
        }
      });
      setSelectedTaskId(response.task.id);
      showToast('Task saved.');
      setIsTaskDetailsOpen(false);
    } catch (updateError) {
      showError('Task update failed', updateError);
    }
  }

  async function handleTaskStatusChange(
    taskId: string,
    status: TaskSummary['status']
  ) {
    try {
      setError(null);
      const response = await updateTaskMutation.mutateAsync({
        taskId,
        values: { status }
      });
      setSelectedTaskId(response.task.id);
      showToast('Task status updated.');
    } catch (updateError) {
      showError('Task update failed', updateError);
    }
  }

  const {
    draggingTaskId,
    dragOverStatus,
    handleTaskDragStart,
    handleTaskDragEnd,
    handleColumnDragOver,
    handleColumnDragLeave,
    handleColumnDrop
  } = useDragAndDrop(tasks, handleTaskStatusChange);

  async function handleReplaceAssignees(assigneeIds: string[]) {
    if (!selectedTaskId) return;

    try {
      setError(null);
      const response = await replaceTaskAssigneesMutation.mutateAsync({
        taskId: selectedTaskId,
        assigneeIds
      });
      setSelectedTaskId(response.task.id);
      showToast('Task assignees updated.');
      setIsTaskDetailsOpen(false);
    } catch (updateError) {
      showError('Assignee update failed', updateError);
    }
  }

  async function handleCreateComment(values: CommentFormValues) {
    if (!selectedTaskId) {
      setError('Select a task before adding a comment.');
      return;
    }

    try {
      setError(null);
      await createCommentMutation.mutateAsync({ body: values.body });
      showToast('Comment added.');
    } catch (createError) {
      showError('Comment creation failed', createError);
    }
  }

  async function handleUpdateComment(
    commentId: string,
    values: CommentFormValues
  ) {
    try {
      setError(null);
      await updateCommentMutation.mutateAsync({
        commentId,
        body: values.body
      });
      showToast('Comment updated.');
    } catch (updateError) {
      showError('Comment update failed', updateError);
    }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      setError(null);
      await deleteCommentMutation.mutateAsync(commentId);
      showToast('Comment deleted.');
    } catch (deleteError) {
      showError('Comment delete failed', deleteError);
    }
  }

  function closeTaskDetails() {
    setIsTaskDetailsOpen(false);
    setSelectedTaskId(null);
  }

  function openTaskDetails(taskId: string) {
    setSelectedTaskId(taskId);
    setIsTaskDetailsOpen(true);
  }

  function navigateTaskDetails(taskId: string) {
    setSelectedTaskId(taskId);
  }

  useTaskKeyboardNav(
    isTaskDetailsOpen,
    tasks,
    selectedTaskId,
    navigateTaskDetails,
    closeTaskDetails
  );


  function openProjectMembersSettings() {
    setProjectSettingsTab('members');
    setIsProjectToolsOpen(true);
  }


  return (
    <main
      className={[
        'workspace-shell board-app',
        isSidebarCollapsed ? 'sidebar-collapsed' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <WorkspaceSidebar
        session={session}
        teams={teams}
        teamDetail={teamDetail}
        selectedTeamSlug={selectedTeamSlug}
        projects={projects}
        selectedProjectId={selectedProjectId}
        selectedProject={selectedProject}
        workspaceMemberCount={workspaceMembers.length}
        projectMemberCount={projectMembers.length}
        includeArchivedProjects={includeArchivedProjects}
        isCollapsed={isSidebarCollapsed}
        isOrgSwitcherOpen={isOrgSwitcherOpen}
        activeView={activeView}
        onToggleCollapsed={() => setIsSidebarCollapsed((current) => !current)}
        onToggleOrgSwitcher={() => setIsOrgSwitcherOpen((current) => !current)}
        onSelectOrganization={(slug) => {
          setSelectedTeamSlug(slug);
          setSelectedProjectId(null);
          setSelectedTaskId(null);
          setActiveView('board');
          navigateWorkspace('board');
          setIsOrgSwitcherOpen(false);
        }}
        onCreateOrganization={() => {
          setWorkspaceName('');
          setSelectedTeamSlug(null);
          setSelectedProjectId(null);
          setSelectedTaskId(null);
          navigateWorkspace('board');
          setIsOrgSwitcherOpen(false);
        }}
        onToggleProjectForm={() => setIsProjectFormOpen((current) => !current)}
        onIncludeArchivedChange={setIncludeArchivedProjects}
        onSelectProject={(projectId) => {
          setSelectedProjectId(projectId);
          setSelectedTaskId(null);
          setActiveView('board');
          navigateWorkspace('board');
        }}
        onSelectView={(view) => {
          setActiveView(view);
          setSelectedTaskId(null);
          navigateWorkspace(view);
        }}
        onOpenOrganizationMembers={() => setIsTeamMembersOpen(true)}
        onOpenProjectMembers={openProjectMembersSettings}
        onLogout={onLogout}
      />

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
                [1, "Organization", "Top-level account"],
                [2, "Project", "Board for tickets"]
              ].map(([step, title, body]) => (
                <div
                  key={step}
                  className={
                    setupStep > Number(step)
                      ? "setup-step done"
                      : setupStep === Number(step)
                        ? "setup-step active"
                        : "setup-step"
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
                  <form className="setup-form vertical" onSubmit={handleCreateTeam}>
                    <label>
                      Organization name
                      <input
                        value={workspaceName}
                        onChange={(event) => setWorkspaceName(event.target.value)}
                        placeholder="Example: Acme Operations"
                      />
                    </label>
                    <button type="submit" className="primary-button" disabled={isCreatingOrganization}>
                      {isCreatingOrganization ? 'Creating...' : 'Create organization'}
                    </button>
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
                    onSubmit={projectForm.handleSubmit(handleCreateProject, () => setError("Project name is required."))}
                  >
                    <label>
                      Project name
                      <input {...projectForm.register("name")} placeholder="Example: Website Launch" />
                    </label>
                    <label>
                      Description
                      <input {...projectForm.register("description")} placeholder="Short project purpose" />
                    </label>
                    {projectForm.formState.errors.name ? (
                      <span className="field-error">{projectForm.formState.errors.name.message}</span>
                    ) : null}
                    <button type="submit" className="primary-button" disabled={isCreatingProject}>
                      {isCreatingProject ? 'Creating...' : 'Create project'}
                    </button>
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
            <form className="setup-form vertical" onSubmit={handleCreateTeam}>
              <label>
                Organization name
                <input
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  placeholder="Example: Acme Operations"
                />
              </label>
              <button type="submit" className="primary-button" disabled={isCreatingOrganization}>
                {isCreatingOrganization ? 'Creating...' : 'Create organization'}
              </button>
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
                    <span key={member.id} className="avatar">
                      {getInitials(member.displayName)}
                    </span>
                  ))}
                  {projectMembers.length > 4 ? (
                    <span className="avatar overflow-avatar">
                      +{projectMembers.length - 4}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!selectedProject}
                  onClick={() => {
                    setProjectSettingsTab('general');
                    setIsProjectToolsOpen(true);
                  }}
                >
                  Project settings
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={!selectedProject}
                  onClick={() => setIsTaskFormOpen(true)}
                >
                  + Create task
                </button>
              </div>
            </header>

            <div className="board-toolbar compact-toolbar">
              <input
                value={taskFilters.search}
                onChange={(event) => setTaskFilter('search', event.target.value)}
                disabled={!selectedProject}
                placeholder="Search tasks..."
              />
              <TaskFilterPopover
                disabled={!selectedProject}
                filters={taskFilters}
                projectMembers={projectMembers}
                priorityLabels={priorityLabels}
                statusLabels={statusLabels}
                onFilterChange={setTaskFilter}
              />
            </div>

            {isProjectFormOpen ? (
              <form
                id="project-create-form"
                className="inline-create-panel board-create-panel"
                onSubmit={projectForm.handleSubmit(handleCreateProject, () =>
                  setError('Project name is required.')
                )}
              >
                <input {...projectForm.register('name')} placeholder="Project name" />
                <input
                  {...projectForm.register('description')}
                  placeholder="Short description"
                />
                <button type="submit" className="primary-button" disabled={isCreatingProject}>
                  {isCreatingProject ? 'Creating...' : 'Create project'}
                </button>
                {projectForm.formState.errors.name ? (
                  <span className="field-error form-wide">
                    {projectForm.formState.errors.name.message}
                  </span>
                ) : null}
              </form>
            ) : null}

            {activeView === 'board' ? (
              <>
                {selectedProject && tasks.length === 0 ? (
                  <section className="board-empty-panel board-empty-actions">
                    <div>
                      <p className="section-kicker">Empty board</p>
                      <h2>Start your project</h2>
                      <p>Create the first ticket or invite teammates before planning work.</p>
                    </div>
                    <div className="empty-cta-row">
                      <button
                        type="button"
                        className="primary-button equal-cta"
                        onClick={() => setIsTaskFormOpen(true)}
                      >
                        Create your first task
                      </button>
                      <button
                        type="button"
                        className="ghost-button equal-cta"
                        onClick={() => setIsTeamMembersOpen(true)}
                      >
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
                    onOpenTask={openTaskDetails}
                    onTaskDragStart={handleTaskDragStart}
                    onTaskDragEnd={handleTaskDragEnd}
                    onColumnDragOver={handleColumnDragOver}
                    onColumnDragLeave={handleColumnDragLeave}
                    onColumnDrop={(event, status) => void handleColumnDrop(event, status)}
                  />
                )}
              </>
            ) : null}

            {activeView === 'my-tasks' ? (
              <MyTasksView
                tasks={tasks}
                currentUserId={session.user.id}
                priorityLabels={priorityLabels}
                statusLabels={statusLabels}
                onOpenTask={openTaskDetails}
              />
            ) : null}

            {activeView === 'calendar' ? (
              <CalendarView
                tasks={tasks}
                statusLabels={statusLabels}
                onOpenTask={openTaskDetails}
              />
            ) : null}

            {activeView === 'activity' ? (
              <ActivityView
                tasks={tasks}
                statusLabels={statusLabels}
                onOpenTask={openTaskDetails}
              />
            ) : null}

            {activeView === 'ask' ? (
              <AskTixoraPanel
                token={session.accessToken}
                orgSlug={selectedTeamSlug}
                projectId={selectedProjectId}
                onOpenTask={openTaskDetails}
              />
            ) : null}
          </>
        )}
      </section>

      <CreateTaskModal
        isOpen={isTaskFormOpen}
        projectName={selectedProject?.name}
        projectMembers={projectMembers}
        priorityLabels={priorityLabels}
        onClose={() => setIsTaskFormOpen(false)}
        isSubmitting={isCreatingTask}
        onSubmit={handleCreateTask}
        onManageProjectMembers={() => {
          setIsTaskFormOpen(false);
          openProjectMembersSettings();
        }}
        onAddOrganizationMember={() => {
          setIsTaskFormOpen(false);
          setIsTeamMembersOpen(true);
        }}
      />

      <TaskDetailDrawer
        isOpen={isTaskDetailsOpen}
        task={selectedTask}
        taskNumber={selectedTaskNumber}
        project={selectedProject}
        projectDetail={projectDetail}
        workspaceMemberCount={workspaceMembers.length}
        projectMembers={projectMembers}
        comments={comments}
        priorityLabels={priorityLabels}
        statusLabels={statusLabels}
        isSavingTask={isSavingTask}
        isSavingAssignees={isSavingAssignees}
        isCreatingComment={isCreatingComment}
        isUpdatingComment={isUpdatingComment}
        isDeletingComment={isDeletingComment}
        onClose={closeTaskDetails}
        onUpdateTask={handleUpdateTask}
        onReplaceAssignees={handleReplaceAssignees}
        onCreateComment={handleCreateComment}
        onUpdateComment={handleUpdateComment}
        onDeleteComment={handleDeleteComment}
        onManageProjectMembers={() => {
          setIsTaskDetailsOpen(false);
          openProjectMembersSettings();
        }}
        onAddOrganizationMember={() => {
          setIsTaskDetailsOpen(false);
          setIsTeamMembersOpen(true);
        }}
      />

      <ProjectSettingsModal
        isOpen={isProjectToolsOpen}
        initialTab={projectSettingsTab}
        project={selectedProject}
        workspaceMembers={workspaceMembers}
        projectMembers={projectMembers}
        isSavingProject={isSavingProject}
        isArchivingProject={isArchivingProject}
        isSavingMembers={isSavingProjectMembers}
        onClose={() => setIsProjectToolsOpen(false)}
        onUpdateProject={handleUpdateProject}
        onArchiveProject={handleArchiveProject}
        onAddProjectMembers={handleAddProjectMembers}
        onProjectRoleChange={handleProjectRoleChange}
        onRemoveProjectMember={handleRemoveProjectMember}
      />
      <OrgMembersModal
        isOpen={isTeamMembersOpen}
        token={session.accessToken}
        team={teamDetail}
        members={workspaceMembers}
        invitations={invitations}
        isSaving={isSavingOrganizationMembers}
        onClose={() => setIsTeamMembersOpen(false)}
        onAddMembers={handleAddOrganizationMembers}
        onInviteMember={handleInviteOrganizationMember}
        onRoleChange={handleTeamRoleChange}
        onRemoveMember={handleRemoveTeamMember}
      />
      <Toast message={toast?.message ?? null} tone={toast?.tone} />
    </main>
  );
}
