import { useMemo } from 'react';
import { uniqueById } from '../../lib/collections.js';
import { useComments } from '../comments/hooks.js';
import { useInvitations, useOrganization, useOrganizations } from '../organizations/hooks.js';
import { useProject, useProjects } from '../projects/hooks.js';
import { useTasks } from '../tasks/hooks.js';
import type { TaskFilters } from '../tasks/api.js';
import type { TaskSummary } from '../tasks/types.js';

export function useWorkspaceData({
  selectedTeamSlug,
  selectedProjectId,
  selectedTaskId,
  includeArchivedProjects,
  taskQueryFilters,
  getFilteredTasks
}: {

  selectedTeamSlug: string | null;
  selectedProjectId: string | null;
  selectedTaskId: string | null;
  includeArchivedProjects: boolean;
  taskQueryFilters: TaskFilters;
  getFilteredTasks: (tasks: TaskSummary[]) => TaskSummary[];
}) {
  const organizationsQuery = useOrganizations();
  const teams = organizationsQuery.data?.teams ?? [];
  const teamQuery = useOrganization(selectedTeamSlug);
  const teamDetail = teamQuery.data?.team ?? null;
  const projectsQuery = useProjects(selectedTeamSlug, includeArchivedProjects);
  const projects = projectsQuery.data?.projects ?? [];
  const projectQuery = useProject(selectedProjectId);
  const projectDetail = projectQuery.data?.project ?? null;
  const tasksQuery = useTasks(selectedProjectId, taskQueryFilters);
  const tasks = tasksQuery.data?.tasks ?? [];
  const commentsQuery = useComments(selectedTaskId);
  const comments = commentsQuery.data?.comments ?? [];
  const canManageOrganization = teamDetail?.role === 'owner' || teamDetail?.role === 'admin';
  const invitationsQuery = useInvitations(selectedTeamSlug, canManageOrganization);
  const invitations = invitationsQuery.data?.invitations ?? [];

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
  const visibleTasks = useMemo(
    () => getFilteredTasks(tasks),
    [getFilteredTasks, tasks]
  );
  const taskColumns = useMemo<
    Array<{ id: TaskSummary['status']; title: string; tasks: TaskSummary[] }>
  >(
    () => [
      { id: 'todo', title: 'To do', tasks: visibleTasks.filter((task) => task.status === 'todo') },
      { id: 'in_progress', title: 'In progress', tasks: visibleTasks.filter((task) => task.status === 'in_progress') },
      { id: 'blocked', title: 'Blocked', tasks: visibleTasks.filter((task) => task.status === 'blocked') },
      { id: 'done', title: 'Done', tasks: visibleTasks.filter((task) => task.status === 'done') }
    ],
    [visibleTasks]
  );

  return {
    queries: { organizationsQuery, projectsQuery, tasksQuery },
    teams,
    teamDetail,
    projects,
    projectDetail,
    tasks,
    comments,
    invitations,
    selectedTeam,
    selectedProject,
    selectedTask,
    selectedTaskNumber,
    workspaceMembers,
    projectMembers,
    taskColumns,
    isLoading: organizationsQuery.isLoading
  };
}
