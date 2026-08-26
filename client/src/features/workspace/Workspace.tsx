// Usage:
// Main authenticated workspace UI. It loads teams, projects, tasks, comments,
// and team members, then lets the user create/update the core work items.
import { zodResolver } from '@hookform/resolvers/zod';
import React, {
  type DragEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState
} from 'react';
import { useForm } from 'react-hook-form';
import type { AuthResponse } from '../auth/types.js';
import type {
  CommentFormValues,
  ProjectEditFormValues,
  ProjectFormValues,
  TaskEditFormValues,
  TaskFormValues
} from './workspaceSchemas.js';
import {
  commentFormSchema,
  projectEditFormSchema,
  projectFormSchema,
  taskEditFormSchema,
  taskFormSchema
} from './workspaceSchemas.js';
import {
  addTeamMember,
  archiveProject,
  createComment,
  createProject,
  createTask,
  createTeam,
  deleteComment,
  getProject,
  getTeam,
  listComments,
  listProjects,
  listTasks,
  listTeams,
  removeProjectMember,
  removeTeamMember,
  replaceTaskAssignees,
  searchUsers,
  updateTeamMember,
  updateComment,
  updateProject,
  updateTask,
  upsertProjectMember
} from './workspaceApi.js';
import type {
  CommentSummary,
  ProjectDetail,
  ProjectMember,
  ProjectSummary,
  TaskSummary,
  TeamDetail,
  TeamSummary,
  UserSummary
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

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export function Workspace({ session, entryPoint, onLogout }: WorkspaceProps) {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null);
  const [selectedTeamSlug, setSelectedTeamSlug] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState<TaskSummary['status'] | 'all'>(
    'all'
  );
  const [priorityFilter, setPriorityFilter] =
    useState<TaskSummary['priority'] | 'all'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [taskSearch, setTaskSearch] = useState('');
  const [dueFilter, setDueFilter] = useState<'all' | 'overdue' | 'upcoming'>(
    'all'
  );
  const [includeArchivedProjects, setIncludeArchivedProjects] = useState(false);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [isTaskDetailsOpen, setIsTaskDetailsOpen] = useState(false);
  const [isProjectToolsOpen, setIsProjectToolsOpen] = useState(false);
  const [isTeamMembersOpen, setIsTeamMembersOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState(entryPoint !== 'register');
  const [isWorkspaceMembersStepComplete, setIsWorkspaceMembersStepComplete] =
    useState(false);
  const [isProjectAccessStepComplete, setIsProjectAccessStepComplete] =
    useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [teamMemberEmail, setTeamMemberEmail] = useState('');
  const [userDirectorySearch, setUserDirectorySearch] = useState('');
  const [userDirectoryResults, setUserDirectoryResults] = useState<UserSummary[]>(
    []
  );
  const [selectedDirectoryUserIds, setSelectedDirectoryUserIds] = useState<string[]>([]);
  const [workspaceMemberSearch, setWorkspaceMemberSearch] = useState('');
  const [projectMemberSearch, setProjectMemberSearch] = useState('');
  const [taskAssigneeSearch, setTaskAssigneeSearch] = useState('');
  const [teamMemberRole, setTeamMemberRole] = useState<'admin' | 'member'>(
    'member'
  );
  const [projectMemberUserId, setProjectMemberUserId] = useState('');
  const [projectMemberRole, setProjectMemberRole] =
    useState<ProjectMember['role']>('contributor');
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] =
    useState<TaskSummary['status'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const projectForm = useForm<ProjectFormValues>({
    defaultValues: { name: '', description: '' },
    resolver: zodResolver(projectFormSchema)
  });
  const projectEditForm = useForm<ProjectEditFormValues>({
    defaultValues: { name: '', description: '' },
    resolver: zodResolver(projectEditFormSchema)
  });
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
  const taskEditForm = useForm<TaskEditFormValues>({
    defaultValues: { title: '', description: '', dueAt: '', priority: 'medium' },
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
  const workspaceMembers = useMemo(
    () => uniqueById(teamDetail?.members ?? []),
    [teamDetail?.members]
  );
  const projectMembers = useMemo(
    () => uniqueById(projectDetail?.members ?? []),
    [projectDetail?.members]
  );
  const filteredWorkspaceMembers = useMemo(() => {
    const query = workspaceMemberSearch.trim().toLowerCase();

    if (!query) return workspaceMembers;

    return workspaceMembers.filter((member) =>
      `${member.displayName} ${member.email}`.toLowerCase().includes(query)
    );
  }, [workspaceMemberSearch, workspaceMembers]);
  const filteredProjectAccessCandidates = useMemo(() => {
    const query = projectMemberSearch.trim().toLowerCase();
    const projectMemberIds = new Set(projectMembers.map((member) => member.id));
    const members = workspaceMembers.filter(
      (member) => !projectMemberIds.has(member.id)
    );

    if (!query) return members;

    return members.filter((member) =>
      `${member.displayName} ${member.email}`.toLowerCase().includes(query)
    );
  }, [projectMemberSearch, projectMembers, workspaceMembers]);
  const filteredTaskAssignees = useMemo(() => {
    const query = taskAssigneeSearch.trim().toLowerCase();

    if (!query) return projectMembers;

    return projectMembers.filter((member) =>
      `${member.displayName} ${member.email}`.toLowerCase().includes(query)
    );
  }, [projectMembers, taskAssigneeSearch]);
  const setupStep = !selectedTeamSlug
    ? 1
    : !isWorkspaceMembersStepComplete
      ? 2
      : !selectedProject
        ? 3
        : !isProjectAccessStepComplete
          ? 4
          : 5;
  const shouldShowSetupFlow = entryPoint === 'register' && !isSetupComplete;

  const availableDirectoryUsers = useMemo(() => {
    const organizationUserIds = new Set(
      workspaceMembers.map((member) => member.id)
    );

    return userDirectoryResults.filter(
      (user) => !organizationUserIds.has(user.id)
    );
  }, [userDirectoryResults, workspaceMembers]);
  const visibleTasks = useMemo(() => {
    const query = taskSearch.trim().toLowerCase();
    if (!query) return tasks;

    return tasks.filter((task) =>
      [task.title, task.description ?? '', ...task.assignees.map((user) => user.displayName)]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [taskSearch, tasks]);

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

  function showError(fallback: string, caught: unknown) {
    setError(caught instanceof Error ? caught.message : fallback);
  }

  function taskMatchesActiveFilters(task: TaskSummary) {
    return (
      (statusFilter === 'all' || task.status === statusFilter) &&
      (priorityFilter === 'all' || task.priority === priorityFilter) &&
      (assigneeFilter === 'all' ||
        task.assignees.some((assignee) => assignee.id === assigneeFilter)) &&
      (dueFilter === 'all' ||
        (dueFilter === 'overdue' &&
          task.dueAt &&
          new Date(task.dueAt) < new Date() &&
          task.status !== 'done') ||
        (dueFilter === 'upcoming' &&
          task.dueAt &&
          new Date(task.dueAt) >= new Date() &&
          task.status !== 'done'))
    );
  }

  function toApiDateTime(value?: string) {
    return value ? new Date(value).toISOString() : null;
  }

  function toDateTimeInputValue(value: string | null) {
    if (!value) return '';

    const date = new Date(value);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  }

  function getInitials(name: string) {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  function formatTimestamp(value: string) {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(value));
  }

  async function loadTeams() {
    const response = await listTeams(session.accessToken);
    setTeams(response.teams);
    setSelectedTeamSlug((current) => current ?? response.teams[0]?.slug ?? null);
  }

  useEffect(() => {
    void loadTeams()
      .catch((loadError) => showError('Load failed', loadError))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTeamSlug) {
      setTeamDetail(null);
      setProjects([]);
      setSelectedProjectId(null);
      return;
    }

    void Promise.all([
      getTeam(session.accessToken, selectedTeamSlug),
      listProjects(session.accessToken, selectedTeamSlug, {
        includeArchived: includeArchivedProjects
      })
    ])
      .then(([teamResponse, projectResponse]) => {
        setTeamDetail(teamResponse.team);
        setProjects(projectResponse.projects);
        setSelectedProjectId(projectResponse.projects[0]?.id ?? null);
      })
      .catch((loadError) => showError('Load failed', loadError));
  }, [includeArchivedProjects, selectedTeamSlug, session.accessToken]);

  useEffect(() => {
    if (!selectedProjectId) {
      setTasks([]);
      setSelectedTaskId(null);
      setProjectDetail(null);
      return;
    }

    void getProject(session.accessToken, selectedProjectId)
      .then((response) => {
        setProjectDetail(response.project);
        setProjectMemberUserId('');
      })
      .catch((loadError) => showError('Project load failed', loadError));

    void listTasks(session.accessToken, selectedProjectId, {
      status: statusFilter === 'all' ? undefined : statusFilter,
      priority: priorityFilter === 'all' ? undefined : priorityFilter,
      assigneeId: assigneeFilter === 'all' ? undefined : assigneeFilter,
      due: dueFilter === 'all' ? undefined : dueFilter
    })
      .then((response) => {
        setTasks(response.tasks);
        setSelectedTaskId((currentTaskId) =>
          response.tasks.some((task) => task.id === currentTaskId)
            ? currentTaskId
            : null
        );
      })
      .catch((loadError) => showError('Load failed', loadError));
  }, [
    assigneeFilter,
    dueFilter,
    priorityFilter,
    selectedProjectId,
    session.accessToken,
    statusFilter
  ]);

  useEffect(() => {
    projectEditForm.reset({
      name: selectedProject?.name ?? '',
      description: selectedProject?.description ?? ''
    });
  }, [projectEditForm, selectedProject]);

  useEffect(() => {
    taskEditForm.reset({
      title: selectedTask?.title ?? '',
      description: selectedTask?.description ?? '',
      dueAt: toDateTimeInputValue(selectedTask?.dueAt ?? null),
      priority: selectedTask?.priority ?? 'medium'
    });
    setSelectedAssigneeIds(selectedTask?.assignees.map((user) => user.id) ?? []);
  }, [selectedTask, taskEditForm]);

  useEffect(() => {
    if (!selectedTaskId) {
      setComments([]);
      setIsTaskDetailsOpen(false);
      return;
    }

    void listComments(session.accessToken, selectedTaskId)
      .then((response) => setComments(response.comments))
      .catch((loadError) => showError('Load failed', loadError));
  }, [selectedTaskId, session.accessToken]);

  useEffect(() => {
    const query = userDirectorySearch.trim();

    if (!query) {
      setUserDirectoryResults([]);
      setSelectedDirectoryUserIds([]);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void searchUsers(session.accessToken, query)
        .then((response) => setUserDirectoryResults(response.users))
        .catch((searchError) =>
          showError('User search failed', searchError)
        );
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [session.accessToken, userDirectorySearch]);

  async function handleCreateTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = workspaceName.trim();

    if (!name) {
      setError('Workspace name is required.');
      return;
    }

    try {
      setError(null);
      const response = await createTeam(session.accessToken, {
        name
      });
      setTeams((current) => [response.team, ...current]);
      setSelectedTeamSlug(response.team.slug);
      setIsProjectFormOpen(false);
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
      const response = await createProject(session.accessToken, selectedTeamSlug, {
        name: values.name,
        description: values.description || undefined
      });
      setProjects((current) => [response.project, ...current]);
      setSelectedProjectId(response.project.id);
      setSelectedTaskId(null);
      projectForm.reset();
      setIsProjectFormOpen(false);
    } catch (createError) {
      showError('Project creation failed', createError);
    }
  }

  async function handleAddTeamMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTeamSlug) return;

    const selectedEmails = selectedDirectoryUserIds
      .map((userId) => userDirectoryResults.find((user) => user.id === userId)?.email)
      .filter((email): email is string => Boolean(email));
    const fallbackEmail = teamMemberEmail.trim();
    const emails = selectedEmails.length > 0 ? selectedEmails : fallbackEmail ? [fallbackEmail] : [];

    if (emails.length === 0) {
      setError('Select at least one registered user to add.');
      return;
    }

    try {
      setError(null);
      const responses = await Promise.all(
        emails.map((email) =>
          addTeamMember(session.accessToken, selectedTeamSlug, {
            email,
            role: teamMemberRole
          })
        )
      );
      setTeamDetail((current) =>
        current
          ? {
              ...current,
              members: uniqueById([
                ...responses.map((response) => response.member),
                ...current.members
              ])
            }
          : current
      );
      setTeamMemberEmail('');
      setUserDirectorySearch('');
      setUserDirectoryResults([]);
      setSelectedDirectoryUserIds([]);
      setTeamMemberRole('member');
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
      const response = await updateTeamMember(
        session.accessToken,
        selectedTeamSlug,
        userId,
        role
      );
      setTeamDetail((current) =>
        current
          ? {
              ...current,
              members: current.members.map((member) =>
                member.id === response.member.id ? response.member : member
              )
            }
          : current
      );
    } catch (memberError) {
      showError('Organization user role update failed', memberError);
    }
  }

  async function handleRemoveTeamMember(userId: string) {
    if (!selectedTeamSlug) return;

    try {
      setError(null);
      await removeTeamMember(session.accessToken, selectedTeamSlug, userId);
      setTeamDetail((current) =>
        current
          ? {
              ...current,
              members: current.members.filter((member) => member.id !== userId)
            }
          : current
      );
    } catch (memberError) {
      showError('Organization user remove failed', memberError);
    }
  }

  async function handleAddProjectMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProjectId || !projectMemberUserId) return;

    try {
      setError(null);
      const response = await upsertProjectMember(
        session.accessToken,
        selectedProjectId,
        {
          userId: projectMemberUserId,
          role: projectMemberRole
        }
      );
      setProjectDetail((current) =>
        current
          ? {
              ...current,
              members: [
                response.member,
                ...current.members.filter(
                  (member) => member.id !== response.member.id
                )
              ]
            }
          : current
      );
      setProjectMemberUserId('');
      setProjectMemberRole('contributor');
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
      const response = await upsertProjectMember(
        session.accessToken,
        selectedProjectId,
        { userId, role }
      );
      setProjectDetail((current) =>
        current
          ? {
              ...current,
              members: current.members.map((member) =>
                member.id === response.member.id ? response.member : member
              )
            }
          : current
      );
    } catch (memberError) {
      showError('Project member role update failed', memberError);
    }
  }

  async function handleRemoveProjectMember(userId: string) {
    if (!selectedProjectId) return;

    try {
      setError(null);
      await removeProjectMember(session.accessToken, selectedProjectId, userId);
      setProjectDetail((current) =>
        current
          ? {
              ...current,
              members: current.members.filter((member) => member.id !== userId)
            }
          : current
      );
    } catch (memberError) {
      showError('Project member remove failed', memberError);
    }
  }

  async function handleUpdateProject(values: ProjectEditFormValues) {
    if (!selectedProjectId) return;

    try {
      setError(null);
      const response = await updateProject(session.accessToken, selectedProjectId, {
        name: values.name,
        description: values.description?.trim() || null
      });
      setProjects((current) =>
        current.map((project) =>
          project.id === response.project.id ? response.project : project
        )
      );
    } catch (updateError) {
      showError('Project update failed', updateError);
    }
  }

  async function handleArchiveProject() {
    if (!selectedProjectId) return;

    try {
      setError(null);
      const response = await archiveProject(session.accessToken, selectedProjectId);
      setProjects((current) =>
        current.filter((project) => project.id !== response.project.id)
      );
      setSelectedProjectId((currentId) => {
        if (currentId !== response.project.id) return currentId;
        const nextProject = projects.find(
          (project) => project.id !== response.project.id
        );
        return nextProject?.id ?? null;
      });
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
      const response = await createTask(session.accessToken, selectedProjectId, {
        title: values.title,
        description: values.description || undefined,
        dueAt: toApiDateTime(values.dueAt),
        priority: values.priority,
        assigneeIds: values.assigneeIds ?? []
      });
      setTasks((current) =>
        taskMatchesActiveFilters(response.task)
          ? [response.task, ...current]
          : current
      );
      setStatusFilter('all');
      setPriorityFilter('all');
      setAssigneeFilter('all');
      setDueFilter('all');
      setSelectedTaskId(response.task.id);
      setIsTaskFormOpen(false);
      setIsSetupComplete(true);
      taskForm.reset({
        title: '',
        description: '',
        dueAt: '',
        priority: 'medium',
        assigneeIds: []
      });
    } catch (createError) {
      showError('Task creation failed', createError);
    }
  }

  async function handleUpdateTask(values: TaskEditFormValues) {
    if (!selectedTaskId) return;

    try {
      setError(null);
      const response = await updateTask(session.accessToken, selectedTaskId, {
        title: values.title,
        description: values.description || null,
        dueAt: toApiDateTime(values.dueAt),
        priority: values.priority
      });
      setTasks((current) =>
        current
          .map((task) => (task.id === selectedTaskId ? response.task : task))
          .filter(taskMatchesActiveFilters)
      );
      setSelectedTaskId(response.task.id);
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
      const response = await updateTask(session.accessToken, taskId, { status });
      setTasks((current) =>
        current
          .map((task) => (task.id === taskId ? response.task : task))
          .filter(taskMatchesActiveFilters)
      );
      setSelectedTaskId(response.task.id);
    } catch (updateError) {
      showError('Task update failed', updateError);
    }
  }

  function handleTaskDragStart(
    event: DragEvent<HTMLElement>,
    taskId: string
  ) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', taskId);
    setDraggingTaskId(taskId);
  }

  function handleTaskDragEnd() {
    setDraggingTaskId(null);
    setDragOverStatus(null);
  }

  function handleColumnDragOver(
    event: DragEvent<HTMLElement>,
    status: TaskSummary['status']
  ) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  }

  function handleColumnDragLeave(status: TaskSummary['status']) {
    setDragOverStatus((current) => (current === status ? null : current));
  }

  async function handleColumnDrop(
    event: DragEvent<HTMLElement>,
    status: TaskSummary['status']
  ) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData('text/plain') || draggingTaskId;
    setDraggingTaskId(null);
    setDragOverStatus(null);

    if (!taskId) return;

    const task = tasks.find((currentTask) => currentTask.id === taskId);
    if (!task || task.status === status) return;

    await handleTaskStatusChange(taskId, status);
  }

  async function handleReplaceAssignees() {
    if (!selectedTaskId) return;

    try {
      setError(null);
      const response = await replaceTaskAssignees(
        session.accessToken,
        selectedTaskId,
        selectedAssigneeIds
      );
      setTasks((current) =>
        current
          .map((task) => (task.id === selectedTaskId ? response.task : task))
          .filter(taskMatchesActiveFilters)
      );
      setSelectedTaskId(response.task.id);
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
      const response = await createComment(session.accessToken, selectedTaskId, {
        body: values.body
      });
      setComments((current) => [...current, response.comment]);
      commentForm.reset();
    } catch (createError) {
      showError('Comment creation failed', createError);
    }
  }

  async function handleUpdateComment(values: CommentFormValues) {
    if (!editingCommentId) return;

    try {
      setError(null);
      const response = await updateComment(
        session.accessToken,
        editingCommentId,
        values.body
      );
      setComments((current) =>
        current.map((comment) =>
          comment.id === response.comment.id ? response.comment : comment
        )
      );
      setEditingCommentId(null);
      commentEditForm.reset();
    } catch (updateError) {
      showError('Comment update failed', updateError);
    }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      setError(null);
      await deleteComment(session.accessToken, commentId);
      setComments((current) =>
        current.filter((comment) => comment.id !== commentId)
      );
    } catch (deleteError) {
      showError('Comment delete failed', deleteError);
    }
  }

  function formatDueDate(value: string | null) {
    if (!value) return 'No due date';

    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric'
    }).format(new Date(value));
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
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">✓</span>
          <strong>Organization Task Manager</strong>
          <button
            type="button"
            className="icon-button sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? '›' : '‹'}
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Workspace views">
          <button type="button" className="nav-item active">
            <span>▦</span>
            <span className="nav-label">Board</span>
          </button>
          <button type="button" className="nav-item">
            <span>◎</span>
            <span className="nav-label">My tasks</span>
          </button>
          <button type="button" className="nav-item">
            <span>□</span>
            <span className="nav-label">Calendar</span>
          </button>
          <button type="button" className="nav-item">
            <span>↯</span>
            <span className="nav-label">Activity</span>
          </button>
        </nav>

        <section className="sidebar-section">
          <div className="sidebar-section-title">
            <span>Organizations</span>
          </div>
          <div className="sidebar-list">
            {teams.map((team) => (
              <button
                key={team.id}
                type="button"
                className={
                  team.slug === selectedTeamSlug ? 'sidebar-row active' : 'sidebar-row'
                }
                onClick={() => setSelectedTeamSlug(team.slug)}
              >
                <span className="sidebar-dot team-dot">
                  {getInitials(team.name).slice(0, 1)}
                </span>
                <span>{team.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="sidebar-section">
          <div className="sidebar-section-title">
            <span>Projects</span>
            <button
              type="button"
              className="icon-button"
              disabled={!selectedTeamSlug}
              onClick={() => setIsProjectFormOpen((current) => !current)}
              aria-label="Create project"
            >
              +
            </button>
          </div>
          <label className="check-row archive-toggle">
            <input
              type="checkbox"
              checked={includeArchivedProjects}
              onChange={(event) => setIncludeArchivedProjects(event.target.checked)}
            />
            <span>Show archived</span>
          </label>
          <div className="sidebar-list">
            {projects.length === 0 ? (
              <div className="soft-empty">No projects yet.</div>
            ) : null}
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                className={
                  project.id === selectedProjectId
                    ? 'sidebar-row project active'
                    : 'sidebar-row project'
                }
                onClick={() => {
                  setSelectedProjectId(project.id);
                  setSelectedTaskId(null);
                }}
              >
                <span className="project-color" />
                <span>{project.name}</span>
                <small>{project.taskCount}</small>
              </button>
            ))}
          </div>
        </section>

        {teamDetail ? (
          <section className="sidebar-section sidebar-members">
            <div className="sidebar-section-title">
              <span>Organization users</span>
              <small>{workspaceMembers.length}</small>
            </div>
            <button
              type="button"
              className="sidebar-row members-link"
              onClick={() => setIsTeamMembersOpen(true)}
            >
              <span className="sidebar-dot team-dot">
                {workspaceMembers.length}
              </span>
              <span>Manage users</span>
            </button>
          </section>
        ) : null}

        <div className="sidebar-user">
          <span className="avatar">{getInitials(session.user.displayName)}</span>
          <div>
            <strong>{session.user.displayName}</strong>
            <p>{session.user.email}</p>
          </div>
          <button type="button" className="icon-button" onClick={onLogout} aria-label="Log out">
            ↗
          </button>
        </div>
      </aside>

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
                First create the organization, add registered users, create a project,
                choose who can access that project, then start with your first task.
              </p>
            </div>

            <div className="setup-steps">
              {[
                [1, "Organization", "Top-level account"],
                [2, "Users", "People in the organization"],
                [3, "Project", "Board for tickets"],
                [4, "Access", "Users allowed on project"],
                [5, "Task", "First ticket"]
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
                    <p>This is where your users, projects, and ticket boards live.</p>
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
                    <button type="submit" className="primary-button">
                      Create organization
                    </button>
                  </form>
                </>
              ) : null}

              {setupStep === 2 ? (
                <>
                  <div className="setup-card-heading">
                    <h2>Add organization users</h2>
                    <p>Search registered users by name or email. You can continue with only yourself.</p>
                  </div>
                  <form className="setup-form vertical" onSubmit={handleAddTeamMember}>
                    <label>
                      Search registered users
                      <input
                        value={userDirectorySearch}
                        onChange={(event) => {
                          setUserDirectorySearch(event.target.value);
                          setSelectedDirectoryUserIds([]);
                        }}
                        placeholder="Search by name or email"
                      />
                    </label>
                    <div className="search-result-list">
                      {!userDirectorySearch.trim() ? (
                        <p className="meta-text">Type a name or email to find registered users.</p>
                      ) : null}
                      {userDirectorySearch.trim() && availableDirectoryUsers.length === 0 ? (
                        <p className="meta-text">No matching registered users found.</p>
                      ) : null}
                      {availableDirectoryUsers.map((user) => (
                        <label
                          key={user.id}
                          className={
                            selectedDirectoryUserIds.includes(user.id)
                              ? "search-result user-select-result active"
                              : "search-result user-select-result"
                          }
                        >
                          <input
                            type="checkbox"
                            checked={selectedDirectoryUserIds.includes(user.id)}
                            onChange={(event) => {
                              setSelectedDirectoryUserIds((current) =>
                                event.target.checked
                                  ? [...current, user.id]
                                  : current.filter((id) => id !== user.id)
                              );
                              setTeamMemberEmail('');
                            }}
                          />
                          <span className="avatar">{getInitials(user.displayName)}</span>
                          <span>
                            <strong>{user.displayName}</strong>
                            <small>{user.email}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                    <label>
                      Organization role
                      <select
                        value={teamMemberRole}
                        onChange={(event) => setTeamMemberRole(event.target.value as "admin" | "member")}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </label>
                    <button type="submit" className="primary-button">
                      {selectedDirectoryUserIds.length > 0 ? `Add ${selectedDirectoryUserIds.length} users` : "Add user"}
                    </button>
                  </form>
                  <section className="setup-member-summary">
                    <div className="panel-title-row">
                      <h3>Organization users</h3>
                      <span className="meta-text">{workspaceMembers.length}</span>
                    </div>
                    <div className="member-list compact">
                      {workspaceMembers.map((member) => (
                        <article key={member.id} className="member-row modal-member-row">
                          <span className="avatar">{getInitials(member.displayName)}</span>
                          <div>
                            <strong>{member.displayName}</strong>
                            <p>{member.email}</p>
                          </div>
                          <span className="role-pill">{member.role}</span>
                        </article>
                      ))}
                    </div>
                  </section>
                  <div className="modal-actions split-actions">
                    <button type="button" className="ghost-button" onClick={() => setIsWorkspaceMembersStepComplete(true)}>
                      Continue to project
                    </button>
                  </div>
                </>
              ) : null}

              {setupStep === 3 ? (
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
                    <button type="submit" className="primary-button">Create project</button>
                  </form>
                </>
              ) : null}

              {setupStep === 4 ? (
                <>
                  <div className="setup-card-heading">
                    <h2>Choose project access</h2>
                    <p>Only users with project access can be assigned to tickets.</p>
                  </div>
                  <form className="setup-form vertical" onSubmit={handleAddProjectMember}>
                    <label>
                      Search organization users
                      <input
                        value={projectMemberSearch}
                        onChange={(event) => setProjectMemberSearch(event.target.value)}
                        placeholder="Name or email"
                      />
                    </label>
                    <div className="search-result-list">
                      {filteredProjectAccessCandidates.length === 0 ? (
                        <p className="meta-text">No organization users to add.</p>
                      ) : null}
                      {filteredProjectAccessCandidates.slice(0, 6).map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          className={projectMemberUserId === member.id ? "search-result active" : "search-result"}
                          onClick={() => setProjectMemberUserId(member.id)}
                        >
                          <span className="avatar">{getInitials(member.displayName)}</span>
                          <span>
                            <strong>{member.displayName}</strong>
                            <small>{member.email}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                    <label>
                      Project role
                      <select
                        value={projectMemberRole}
                        onChange={(event) => setProjectMemberRole(event.target.value as ProjectMember["role"])}
                      >
                        <option value="contributor">Contributor</option>
                        <option value="manager">Manager</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </label>
                    <button type="submit" className="primary-button">Add to project</button>
                  </form>
                  <section className="setup-member-summary">
                    <div className="panel-title-row">
                      <h3>Project users</h3>
                      <span className="meta-text">{projectMembers.length}</span>
                    </div>
                    <div className="member-list compact">
                      {projectMembers.map((member) => (
                        <article key={member.id} className="member-row modal-member-row">
                          <span className="avatar">{getInitials(member.displayName)}</span>
                          <div>
                            <strong>{member.displayName}</strong>
                            <p>{member.email}</p>
                          </div>
                          <span className="role-pill">{member.role}</span>
                        </article>
                      ))}
                    </div>
                  </section>
                  <div className="modal-actions split-actions">
                    <button type="button" className="ghost-button" onClick={() => setIsProjectAccessStepComplete(true)}>
                      Continue to tasks
                    </button>
                  </div>
                </>
              ) : null}

              {setupStep === 5 ? (
                <>
                  <div className="setup-card-heading">
                    <h2>Create first task</h2>
                    <p>Create a starter ticket now, or skip and land on the board.</p>
                  </div>
                  <form className="setup-form vertical" onSubmit={taskForm.handleSubmit(handleCreateTask)}>
                    <label>
                      Task title
                      <input {...taskForm.register("title")} placeholder="Example: Prepare launch checklist" />
                    </label>
                    <label>
                      Priority
                      <select {...taskForm.register("priority")}> 
                        {Object.entries(priorityLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Due date
                      <input {...taskForm.register("dueAt")} type="datetime-local" />
                    </label>
                    {taskForm.formState.errors.title ? (
                      <span className="field-error">{taskForm.formState.errors.title.message}</span>
                    ) : null}
                    <div className="modal-actions split-actions">
                      <button type="button" className="ghost-button" onClick={() => setIsSetupComplete(true)}>
                        Skip to board
                      </button>
                      <button type="submit" className="primary-button">Create task and open board</button>
                    </div>
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
                here, then add projects, users, and tasks from the board.
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
              <button type="submit" className="primary-button">
                Create organization
              </button>
            </form>
          </section>
        ) : (
          <>
            <header className="board-header">
              <div className="project-title">
                <span className="project-icon">■</span>
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
                  onClick={() => setIsProjectToolsOpen((current) => !current)}
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

            <div className="board-toolbar">
              <select
                disabled={!selectedProject}
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as TaskSummary['status'] | 'all')
                }
              >
                <option value="all">All status</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                disabled={!selectedProject}
                value={assigneeFilter}
                onChange={(event) => setAssigneeFilter(event.target.value)}
              >
                <option value="all">All assignees</option>
                  {workspaceMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
                  </option>
                ))}
              </select>
              <select
                disabled={!selectedProject}
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(event.target.value as TaskSummary['priority'] | 'all')
                }
              >
                <option value="all">All priority</option>
                {Object.entries(priorityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                value={taskSearch}
                onChange={(event) => setTaskSearch(event.target.value)}
                disabled={!selectedProject}
                placeholder="Search tasks..."
              />
              <select
                disabled={!selectedProject}
                value={dueFilter}
                onChange={(event) => setDueFilter(event.target.value as typeof dueFilter)}
              >
                <option value="all">All due dates</option>
                <option value="overdue">Overdue</option>
                <option value="upcoming">Upcoming</option>
              </select>
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
                <button type="submit" className="primary-button">
                  Create project
                </button>
                {projectForm.formState.errors.name ? (
                  <span className="field-error form-wide">
                    {projectForm.formState.errors.name.message}
                  </span>
                ) : null}
              </form>
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
              <div className="kanban-board">
                {taskColumns.map((column) => (
                  <section
                    key={column.id}
                    className={
                      dragOverStatus === column.id
                        ? 'kanban-column drag-over'
                        : 'kanban-column'
                    }
                    onDragOver={(event) => handleColumnDragOver(event, column.id)}
                    onDragLeave={() => handleColumnDragLeave(column.id)}
                    onDrop={(event) => void handleColumnDrop(event, column.id)}
                  >
                    <div className="kanban-column-header">
                      <h3>{column.title}</h3>
                      <span>{column.tasks.length}</span>
                    </div>
                    <div className="kanban-card-list">
                      {column.tasks.length === 0 ? (
                        <div className="soft-empty">No tasks</div>
                      ) : null}
                      {column.tasks.map((task) => (
                        <article
                          key={task.id}
                          draggable
                          className={[
                            task.id === selectedTaskId ? 'task-card active' : 'task-card',
                            draggingTaskId === task.id ? 'dragging' : ''
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          onDragStart={(event) => handleTaskDragStart(event, task.id)}
                          onDragEnd={handleTaskDragEnd}
                        >
                          <button
                            type="button"
                            className="task-card-main"
                            onClick={() => setSelectedTaskId(task.id)}
                          >
                            <strong>{task.title}</strong>
                            {task.assignees[0] ? (
                              <span>{task.assignees[0].displayName}</span>
                            ) : (
                              <span>Unassigned</span>
                            )}
                          </button>
                          <div className="task-card-footer">
                            <small className={`priority ${task.priority}`}>
                              {priorityLabels[task.priority]}
                            </small>
                            <span className="task-meta">□ {formatDueDate(task.dueAt)}</span>
                            <span className="task-meta">○ {task.assignees.length}</span>
                          </div>
                          {task.id === selectedTaskId ? (
                            <section className="ticket-preview">
                              <div className="ticket-preview-grid">
                                <div>
                                  <span>Status</span>
                                  <strong>{statusLabels[task.status]}</strong>
                                </div>
                                <div>
                                  <span>Priority</span>
                                  <strong>{priorityLabels[task.priority]}</strong>
                                </div>
                                <div>
                                  <span>Due</span>
                                  <strong>{formatDueDate(task.dueAt)}</strong>
                                </div>
                                <div>
                                  <span>Assignees</span>
                                  <strong>
                                    {task.assignees.length > 0
                                      ? task.assignees
                                          .map((assignee) => assignee.displayName)
                                          .join(', ')
                                      : 'Unassigned'}
                                  </strong>
                                </div>
                              </div>
                              {task.description ? (
                                <p className="ticket-preview-description">
                                  {task.description}
                                </p>
                              ) : null}
                              <div className="ticket-preview-comments">
                                <div className="ticket-preview-heading">
                                  <strong>Recent comments</strong>
                                  <span>{comments.length}</span>
                                </div>
                                {comments.length === 0 ? (
                                  <p>No comments yet.</p>
                                ) : (
                                  comments.slice(-2).map((comment) => (
                                    <article key={comment.id}>
                                      <strong>{comment.author.displayName}</strong>
                                      <p>{comment.body}</p>
                                    </article>
                                  ))
                                )}
                              </div>
                              <div className="ticket-preview-actions">
                                <button
                                  type="button"
                                  className="ghost-button"
                                  onClick={() => setSelectedTaskId(null)}
                                >
                                  Close
                                </button>
                                <button
                                  type="button"
                                  className="primary-button"
                                  onClick={() => setIsTaskDetailsOpen(true)}
                                >
                                  Open details
                                </button>
                              </div>
                            </section>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {isTaskFormOpen ? (
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
                <p>{selectedProject?.name}</p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setIsTaskFormOpen(false)}
                aria-label="Close create task"
              >
                ×
              </button>
            </div>
            <form
              className="modal-form"
              onSubmit={taskForm.handleSubmit(handleCreateTask)}
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
                  <span className="meta-text">
                    {projectMembers.length} available
                  </span>
                </div>
                <p className="meta-text">
                  Only project users can be assigned to this task.
                </p>
                <input
                  value={taskAssigneeSearch}
                  onChange={(event) => setTaskAssigneeSearch(event.target.value)}
                  placeholder="Search project users"
                />
                {projectMembers.length ? (
                  <div className="check-list compact-checks">
                    {filteredTaskAssignees.length === 0 ? (
                      <p className="meta-text">No matching project users.</p>
                    ) : null}
                    {filteredTaskAssignees.map((member) => (
                      <label key={member.id} className="check-row assignee-option">
                        <input
                          type="checkbox"
                          value={member.id}
                          {...taskForm.register('assigneeIds')}
                        />
                        <span className="avatar">
                          {getInitials(member.displayName)}
                        </span>
                        <span>{member.displayName}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="meta-text">
                    No one has project access yet. Add organization users to
                    this project first.
                  </p>
                )}
                <div className="assignee-helper-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      setIsTaskFormOpen(false);
                      setIsProjectToolsOpen(true);
                    }}
                  >
                    Manage project access
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      setIsTaskFormOpen(false);
                      setIsTeamMembersOpen(true);
                    }}
                  >
                    Add organization user
                  </button>
                </div>
              </section>
              <div className="modal-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setIsTaskFormOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  Create task
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {isTaskDetailsOpen && selectedTask ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="task-modal task-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-detail-title"
          >
            <div className="modal-heading">
              <div>
                <h2 id="task-detail-title">{selectedTask.title}</h2>
                <p>
                  {statusLabels[selectedTask.status]} · {formatDueDate(selectedTask.dueAt)}
                </p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSelectedTaskId(null)}
                aria-label="Close task details"
              >
                ×
              </button>
            </div>

            <div className="modal-split">
              <div className="modal-column">
                <form
                  className="modal-form"
                  onSubmit={taskEditForm.handleSubmit(handleUpdateTask)}
                >
                  <label>
                    Task title
                    <input {...taskEditForm.register('title')} placeholder="Task title" />
                  </label>
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
                    />
                  </label>
                  <label>
                    Due date
                    <input {...taskEditForm.register('dueAt')} type="datetime-local" />
                  </label>
                  <button type="submit" className="primary-button">
                    Save task
                  </button>
                </form>

                {projectDetail ? (
                  <section className="modal-panel">
                    <div className="panel-title-row">
                      <h3>Task assignees</h3>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => void handleReplaceAssignees()}
                      >
                        Save
                      </button>
                    </div>
                    <p className="meta-text">
                      {workspaceMembers.length} organization users ·{' '}
                      {projectMembers.length} project users available for tasks.
                    </p>
                    <p className="meta-text">
                      Only users with project access can be assigned here.
                    </p>
                    <div className="check-list compact-checks">
                      {projectMembers.length === 0 ? (
                        <p className="meta-text">
                          No project users yet. Add organization users to project
                          access first.
                        </p>
                      ) : null}
                      {projectMembers.map((member) => (
                        <label key={member.id} className="check-row">
                          <input
                            type="checkbox"
                            checked={selectedAssigneeIds.includes(member.id)}
                            onChange={(event) =>
                              setSelectedAssigneeIds((current) =>
                                event.target.checked
                                  ? [...current, member.id]
                                  : current.filter((id) => id !== member.id)
                              )
                            }
                          />
                          <span>{member.displayName}</span>
                        </label>
                      ))}
                    </div>
                    <div className="assignee-helper-actions">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => {
                          setIsTaskDetailsOpen(false);
                          setIsProjectToolsOpen(true);
                        }}
                      >
                        Manage project access
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => {
                          setIsTaskDetailsOpen(false);
                          setIsTeamMembersOpen(true);
                        }}
                      >
                        Add organization user
                      </button>
                    </div>
                  </section>
                ) : null}
              </div>

              <section className="modal-column comments-section">
                <div className="drawer-tabs">
                  <strong>Comments</strong>
                  <span>{comments.length}</span>
                </div>
                <form
                  className="comment-form drawer-comment-form"
                  onSubmit={commentForm.handleSubmit(handleCreateComment)}
                >
                  <input {...commentForm.register('body')} placeholder="Add a comment..." />
                  <button type="submit" className="primary-button">
                    Send
                  </button>
                  {commentForm.formState.errors.body ? (
                    <span className="field-error form-wide">
                      {commentForm.formState.errors.body.message}
                    </span>
                  ) : null}
                </form>
                <div className="comments-list">
                  {comments.length === 0 ? (
                    <div className="soft-empty">No comments yet.</div>
                  ) : null}
                  {comments.map((comment) => (
                    <article key={comment.id} className="comment-item">
                      <span className="avatar">
                        {getInitials(comment.author.displayName)}
                      </span>
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
                              onClick={() => void handleDeleteComment(comment.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        {editingCommentId === comment.id ? (
                          <form
                            className="comment-edit-form"
                            onSubmit={commentEditForm.handleSubmit(handleUpdateComment)}
                          >
                            <input
                              {...commentEditForm.register('body')}
                              placeholder="Edit comment"
                            />
                            <button type="submit" className="primary-button">
                              Save
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
      ) : null}

      {isProjectToolsOpen && selectedProject ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="task-modal project-settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-settings-title"
          >
            <div className="modal-heading">
              <div>
                <h2 id="project-settings-title">Project settings</h2>
                <p>{selectedProject.name}</p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setIsProjectToolsOpen(false)}
                aria-label="Close project settings"
              >
                ×
              </button>
            </div>

            <div className="modal-split">
              <form
                className="modal-form"
                onSubmit={projectEditForm.handleSubmit(handleUpdateProject)}
              >
                <label>
                  Project name
                  <input {...projectEditForm.register('name')} placeholder="Project name" />
                </label>
                <label>
                  Description
                  <input
                    {...projectEditForm.register('description')}
                    placeholder="Description"
                  />
                </label>
                <div className="modal-actions split-actions">
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => void handleArchiveProject()}
                  >
                    Archive
                  </button>
                  <button type="submit" className="primary-button">
                    Save project
                  </button>
                </div>
              </form>

              <section className="modal-panel">
                <div className="panel-title-row">
                  <h3>Project access</h3>
                  <span className="meta-text">{projectMembers.length}</span>
                </div>
                <p className="meta-text">
                  Add organization users here before assigning them to tasks in
                  this project.
                </p>
                <form className="member-form compact" onSubmit={handleAddProjectMember}>
                  <label>
                    Search organization users
                    <input
                      value={projectMemberSearch}
                      onChange={(event) => setProjectMemberSearch(event.target.value)}
                      placeholder="Name or email"
                    />
                  </label>
                  <div className="search-result-list">
                    {filteredProjectAccessCandidates.length === 0 ? (
                      <p className="meta-text">No organization users to add.</p>
                    ) : null}
                    {filteredProjectAccessCandidates.slice(0, 6).map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        className={
                          projectMemberUserId === member.id
                            ? 'search-result active'
                            : 'search-result'
                        }
                        onClick={() => setProjectMemberUserId(member.id)}
                      >
                        <span className="avatar">
                          {getInitials(member.displayName)}
                        </span>
                        <span>
                          <strong>{member.displayName}</strong>
                          <small>{member.email}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                  <select
                    value={projectMemberRole}
                    onChange={(event) =>
                      setProjectMemberRole(event.target.value as ProjectMember['role'])
                    }
                  >
                    <option value="contributor">Contributor</option>
                    <option value="manager">Manager</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button type="submit" className="primary-button">
                    Add to project
                  </button>
                </form>
                <div className="member-list compact">
                  {projectMembers.map((member) => (
                    <article key={member.id} className="member-row modal-member-row">
                      <span className="avatar">
                        {getInitials(member.displayName)}
                      </span>
                      <div>
                        <strong>{member.displayName}</strong>
                        <p>{member.email}</p>
                      </div>
                      <select
                        value={member.role}
                        onChange={(event) =>
                          void handleProjectRoleChange(
                            member.id,
                            event.target.value as ProjectMember['role']
                          )
                        }
                      >
                        <option value="contributor">Contributor</option>
                        <option value="manager">Manager</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => void handleRemoveProjectMember(member.id)}
                      >
                        Remove
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </section>
        </div>
      ) : null}

      {isTeamMembersOpen && teamDetail ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="task-modal team-members-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-members-title"
          >
            <div className="modal-heading">
              <div>
                <h2 id="team-members-title">Organization users</h2>
                <p>
                  {teamDetail.name} · {workspaceMembers.length} users
                </p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setIsTeamMembersOpen(false)}
                aria-label="Close organization users"
              >
                ×
              </button>
            </div>

            <div className="modal-split">
              <form className="modal-form" onSubmit={handleAddTeamMember}>
                <label>
                  Search registered users
                  <input
                    value={userDirectorySearch}
                    onChange={(event) => {
                      setUserDirectorySearch(event.target.value);
                      setSelectedDirectoryUserIds([]);
                    }}
                    placeholder="Search by name or email"
                  />
                </label>
                <div className="search-result-list">
                  {!userDirectorySearch.trim() ? (
                    <p className="meta-text">
                      Type a name or email to find registered users.
                    </p>
                  ) : null}
                  {userDirectorySearch.trim() &&
                  availableDirectoryUsers.length === 0 ? (
                    <p className="meta-text">No matching registered users found.</p>
                  ) : null}
                  {availableDirectoryUsers.map((user) => (
                    <label
                      key={user.id}
                      className={
                        selectedDirectoryUserIds.includes(user.id)
                          ? 'search-result user-select-result active'
                          : 'search-result user-select-result'
                      }
                    >
                      <input
                        type="checkbox"
                        checked={selectedDirectoryUserIds.includes(user.id)}
                        onChange={(event) => {
                          setSelectedDirectoryUserIds((current) =>
                            event.target.checked
                              ? [...current, user.id]
                              : current.filter((id) => id !== user.id)
                          );
                          setTeamMemberEmail('');
                        }}
                      />
                      <span className="avatar">{getInitials(user.displayName)}</span>
                      <span>
                        <strong>{user.displayName}</strong>
                        <small>{user.email}</small>
                      </span>
                    </label>
                  ))}
                </div>
                <details className="manual-email-fallback">
                  <summary>Add by exact email</summary>
                  <label>
                    User email
                    <input
                      value={teamMemberEmail}
                      onChange={(event) => {
                        setTeamMemberEmail(event.target.value);
                        setSelectedDirectoryUserIds([]);
                      }}
                      placeholder="person@example.com"
                    />
                  </label>
                </details>
                <label>
                  Organization role
                  <select
                    value={teamMemberRole}
                    onChange={(event) =>
                      setTeamMemberRole(event.target.value as 'admin' | 'member')
                    }
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <button type="submit" className="primary-button">
                  {selectedDirectoryUserIds.length > 0
                    ? `Add ${selectedDirectoryUserIds.length} users`
                    : 'Add user'}
                </button>
              </form>

              <section className="modal-panel team-member-list">
                <div className="panel-title-row">
                  <h3>Current organization users</h3>
                  <span className="meta-text">{workspaceMembers.length}</span>
                </div>
                <input
                  value={workspaceMemberSearch}
                  onChange={(event) => setWorkspaceMemberSearch(event.target.value)}
                  placeholder="Search users"
                />
                <div className="member-list compact">
                  {filteredWorkspaceMembers.length === 0 ? (
                    <p className="meta-text">No matching users.</p>
                  ) : null}
                  {filteredWorkspaceMembers.map((member) => (
                    <article key={member.id} className="member-row modal-member-row">
                      <span className="avatar">
                        {getInitials(member.displayName)}
                      </span>
                      <div>
                        <strong>{member.displayName}</strong>
                        <p>{member.email}</p>
                      </div>
                      {member.role === 'owner' ? (
                        <span className="role-pill">Owner</span>
                      ) : (
                        <select
                          value={member.role}
                          onChange={(event) =>
                            void handleTeamRoleChange(
                              member.id,
                              event.target.value as 'admin' | 'member'
                            )
                          }
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}
                      {member.role !== 'owner' ? (
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => void handleRemoveTeamMember(member.id)}
                        >
                          Remove
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
