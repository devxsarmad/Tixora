// Usage:
// TypeScript shapes for the workspace responses returned by the backend.
// Keeping them here makes React state match the API contract clearly.

export type TeamSummary = {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'admin' | 'member';
  memberCount: number;
  activeProjectCount: number;
};

export type TeamMember = {
  id: string;
  email: string;
  displayName: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
};

export type TeamDetail = TeamSummary & {
  members: TeamMember[];
};

export type InvitationSummary = {
  id: string;
  teamId: string;
  email: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  role: 'owner' | 'admin' | 'member';
  inviter: {
    id: string;
    email: string;
    displayName: string;
  };
  acceptedBy: string | null;
  acceptedAt: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectSummary = {
  id: string;
  teamId: string;
  teamSlug: string;
  name: string;
  description: string | null;
  teamRole: 'owner' | 'admin' | 'member';
  projectRole: 'manager' | 'contributor' | 'viewer' | null;
  memberCount: number;
  taskCount: number;
  archivedAt: string | null;
};

export type ProjectMember = {
  id: string;
  email: string;
  displayName: string;
  role: 'manager' | 'contributor' | 'viewer';
  addedAt: string;
};

export type UserSummary = {
  id: string;
  email: string;
  displayName: string;
};

export type ProjectDetail = ProjectSummary & {
  members: ProjectMember[];
};

export type TaskSummary = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'blocked' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueAt: string | null;
  commentCount: number;
  assignees: Array<{
    id: string;
    email: string;
    displayName: string;
    hasProjectAccess?: boolean;
  }>;
};

export type CommentSummary = {
  id: string;
  taskId: string;
  author: {
    id: string;
    email: string;
    displayName: string;
  };
  body: string;
  createdAt: string;
};
