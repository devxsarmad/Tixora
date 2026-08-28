import { getInitials } from '../../lib/formatters.js';
import { OrgSwitcher } from '../../components/layout/OrgSwitcher.js';
import tixoraLogo from '../../assests/tixora-logo.jpeg';
import type { AuthResponse } from '../auth/types.js';
import type { ProjectSummary } from '../projects/types.js';
import type { TeamDetail, TeamSummary } from '../organizations/types.js';
import type { WorkspaceView } from './workspaceView.js';

type WorkspaceSidebarProps = {
  session: AuthResponse;
  teams: TeamSummary[];
  teamDetail: TeamDetail | null;
  selectedTeamSlug: string | null;
  projects: ProjectSummary[];
  selectedProjectId: string | null;
  selectedProject: ProjectSummary | null;
  workspaceMemberCount: number;
  projectMemberCount: number;
  includeArchivedProjects: boolean;
  isCollapsed: boolean;
  isOrgSwitcherOpen: boolean;
  activeView: WorkspaceView;
  onToggleCollapsed: () => void;
  onToggleOrgSwitcher: () => void;
  onSelectOrganization: (slug: string) => void;
  onCreateOrganization: () => void;
  onToggleProjectForm: () => void;
  onIncludeArchivedChange: (checked: boolean) => void;
  onSelectProject: (projectId: string) => void;
  onSelectView: (view: WorkspaceView) => void;
  onOpenOrganizationMembers: () => void;
  onOpenProjectMembers: () => void;
  onLogout: () => void;
};

export function WorkspaceSidebar({
  session,
  teams,
  teamDetail,
  selectedTeamSlug,
  projects,
  selectedProjectId,
  selectedProject,
  workspaceMemberCount,
  projectMemberCount,
  includeArchivedProjects,
  isCollapsed,
  isOrgSwitcherOpen,
  activeView,
  onToggleCollapsed,
  onToggleOrgSwitcher,
  onSelectOrganization,
  onCreateOrganization,
  onToggleProjectForm,
  onIncludeArchivedChange,
  onSelectProject,
  onSelectView,
  onOpenOrganizationMembers,
  onOpenProjectMembers,
  onLogout
}: WorkspaceSidebarProps) {
  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark logo-mark">
          <img src={tixoraLogo} alt="Tixora logo" />
        </span>
        <strong>Tixora</strong>
        <button
          type="button"
          className="icon-button sidebar-toggle"
          onClick={onToggleCollapsed}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? '›' : '‹'}
        </button>
      </div>

      <OrgSwitcher
        teams={teams}
        selectedTeamSlug={selectedTeamSlug}
        isOpen={isOrgSwitcherOpen}
        onToggle={onToggleOrgSwitcher}
        onSelect={onSelectOrganization}
        onCreate={onCreateOrganization}
        getInitials={getInitials}
      />

      <section className="sidebar-section">
        <div className="sidebar-section-title"><span>Navigate</span></div>
        <nav className="sidebar-nav" aria-label="Workspace views">
          <button type="button" className={activeView === 'board' ? 'nav-item active' : 'nav-item'} onClick={() => onSelectView('board')}><span className="nav-icon">▦</span><span className="nav-label">Board</span></button>
          <button type="button" className={activeView === 'my-tasks' ? 'nav-item active' : 'nav-item'} onClick={() => onSelectView('my-tasks')}><span className="nav-icon">◎</span><span className="nav-label">My tasks</span></button>
          <button type="button" className={activeView === 'calendar' ? 'nav-item active' : 'nav-item'} onClick={() => onSelectView('calendar')}><span className="nav-icon">□</span><span className="nav-label">Calendar</span></button>
          <button type="button" className={activeView === 'activity' ? 'nav-item active' : 'nav-item'} onClick={() => onSelectView('activity')}><span className="nav-icon">↯</span><span className="nav-label">Activity</span></button>
        </nav>
      </section>

      <section className="sidebar-section">
        <div className="sidebar-section-title">
          <span>Projects</span>
          <button
            type="button"
            className="icon-button"
            disabled={!selectedTeamSlug}
            onClick={onToggleProjectForm}
            aria-label="Create project"
          >
            +
          </button>
        </div>
        <label className="check-row archive-toggle">
          <input
            type="checkbox"
            checked={includeArchivedProjects}
            onChange={(event) => onIncludeArchivedChange(event.target.checked)}
          />
          <span>Show archived</span>
        </label>
        <div className="sidebar-list">
          {projects.length === 0 ? <div className="soft-empty">No projects yet.</div> : null}
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              className={
                project.id === selectedProjectId
                  ? 'sidebar-row project active'
                  : 'sidebar-row project'
              }
              onClick={() => onSelectProject(project.id)}
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
          <details className="settings-group" open>
            <summary className="sidebar-section-title"><span>Settings</span></summary>
            <button type="button" className="sidebar-row members-link" onClick={onOpenOrganizationMembers}>
              <span className="sidebar-dot team-dot">{workspaceMemberCount}</span>
              <span>Organization members</span>
            </button>
            <button
              type="button"
              className="sidebar-row members-link"
              disabled={!selectedProject}
              onClick={onOpenProjectMembers}
            >
              <span className="sidebar-dot team-dot">{projectMemberCount}</span>
              <span>Project members</span>
            </button>
          </details>
        </section>
      ) : null}

      <div className="sidebar-user">
        <span className="avatar">{getInitials(session.user.displayName)}</span>
        <div>
          <strong>{session.user.displayName}</strong>
          <p>{session.user.email}</p>
        </div>
        <button type="button" className="icon-button" onClick={onLogout} aria-label="Log out">↗</button>
      </div>
    </aside>
  );
}
