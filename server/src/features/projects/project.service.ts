// Usage:
// Project business rules: translate repository outcomes into API errors and keep
// route handlers focused on HTTP concerns.

import { HttpError } from '../../shared/http-error.js';
import {
  isPostgresError,
  POSTGRES_UNIQUE_VIOLATION
} from '../../shared/postgres-errors.js';
import {
  archiveProjectForUser,
  createProjectForTeam,
  findProjectDetailForUser,
  listProjectsForTeam,
  removeProjectMemberForUser,
  upsertProjectMemberForUser,
  updateProjectForUser
} from './project.repository.js';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  UpsertProjectMemberInput
} from './project.schemas.js';

function handleProjectWriteResult<T>(result: T | null | 'forbidden'): T {
  if (result === 'forbidden') {
    throw new HttpError(403, 'Project permission denied', 'PROJECT_FORBIDDEN');
  }

  if (!result) {
    throw new HttpError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }

  return result;
}

function handleCreateProjectResult<T>(result: T | null | 'forbidden'): T {
  if (result === 'forbidden') {
    throw new HttpError(403, 'Project permission denied', 'PROJECT_FORBIDDEN');
  }

  if (!result) {
    throw new HttpError(404, 'Team not found', 'TEAM_NOT_FOUND');
  }

  return result;
}

function translateProjectConflict(error: unknown): never {
  if (isPostgresError(error) && error.code === POSTGRES_UNIQUE_VIOLATION) {
    throw new HttpError(
      409,
      'An active project with this name already exists in the organization',
      'PROJECT_NAME_TAKEN'
    );
  }

  throw error;
}

export async function createProject(params: {
  teamSlug: string;
  userId: string;
  input: CreateProjectInput;
}) {
  try {
    const result = await createProjectForTeam({
      teamSlug: params.teamSlug,
      userId: params.userId,
      name: params.input.name,
      description: params.input.description
    });

    return handleCreateProjectResult(result);
  } catch (error) {
    translateProjectConflict(error);
  }
}

export async function listTeamProjects(params: {
  teamSlug: string;
  userId: string;
  includeArchived: boolean;
}) {
  const projects = await listProjectsForTeam(params);

  if (!projects) {
    throw new HttpError(404, 'Team not found', 'TEAM_NOT_FOUND');
  }

  return projects;
}

export async function getProject(params: { projectId: string; userId: string }) {
  const project = await findProjectDetailForUser(params);

  if (!project) {
    throw new HttpError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }

  return project;
}

export async function updateProject(params: {
  projectId: string;
  userId: string;
  input: UpdateProjectInput;
}) {
  try {
    const result = await updateProjectForUser({
      projectId: params.projectId,
      userId: params.userId,
      name: params.input.name,
      description: params.input.description
    });

    return handleProjectWriteResult(result);
  } catch (error) {
    translateProjectConflict(error);
  }
}

export async function archiveProject(params: {
  projectId: string;
  userId: string;
}) {
  const result = await archiveProjectForUser(params);

  return handleProjectWriteResult(result);
}

function handleProjectMemberResult<T>(
  result: T | null | 'forbidden' | 'archived' | 'not_team_member' | 'self_manager_removal_blocked'
): T {
  if (result === 'forbidden') {
    throw new HttpError(403, 'Project permission denied', 'PROJECT_FORBIDDEN');
  }

  if (result === 'archived') {
    throw new HttpError(403, 'Archived projects cannot be changed', 'PROJECT_ARCHIVED');
  }

  if (result === 'self_manager_removal_blocked') {
    throw new HttpError(409, 'Transfer project manager access before removing yourself', 'PROJECT_MANAGER_TRANSFER_REQUIRED');
  }

  if (result === 'not_team_member') {
    throw new HttpError(
      400,
      'User must be an organization member before joining the project',
      'PROJECT_MEMBER_NOT_IN_TEAM'
    );
  }

  if (!result) {
    throw new HttpError(404, 'Project member not found', 'PROJECT_MEMBER_NOT_FOUND');
  }

  return result;
}

export async function upsertProjectMember(params: {
  projectId: string;
  actorId: string;
  input: UpsertProjectMemberInput;
}) {
  const result = await upsertProjectMemberForUser({
    projectId: params.projectId,
    actorId: params.actorId,
    targetUserId: params.input.userId,
    role: params.input.role
  });

  return handleProjectMemberResult(result);
}

export async function removeProjectMember(params: {
  projectId: string;
  actorId: string;
  targetUserId: string;
}) {
  const result = await removeProjectMemberForUser(params);

  return handleProjectMemberResult(result);
}
