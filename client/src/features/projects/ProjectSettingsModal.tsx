import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { getInitials } from '../../lib/formatters.js';
import { UserSearchInput } from '../../components/members/UserSearchInput.js';
import type { TeamMember } from '../organizations/types.js';
import type { ProjectEditFormValues } from '../workspace/workspaceSchemas.js';
import { projectEditFormSchema } from '../workspace/workspaceSchemas.js';
import type { ProjectMember, ProjectSummary } from './types.js';

type ProjectSettingsModalProps = {
  isOpen: boolean;
  initialTab: 'general' | 'members';
  project: ProjectSummary | null;
  workspaceMembers: TeamMember[];
  projectMembers: ProjectMember[];
  isSavingProject?: boolean;
  isArchivingProject?: boolean;
  isSavingMembers?: boolean;
  onClose: () => void;
  onUpdateProject: (values: ProjectEditFormValues) => Promise<void> | void;
  onArchiveProject: () => Promise<void> | void;
  onAddProjectMembers: (
    userIds: string[],
    role: ProjectMember['role']
  ) => Promise<void> | void;
  onProjectRoleChange: (
    userId: string,
    role: ProjectMember['role']
  ) => Promise<void> | void;
  onRemoveProjectMember: (userId: string) => Promise<void> | void;
};

export function ProjectSettingsModal({
  isOpen,
  initialTab,
  project,
  workspaceMembers,
  projectMembers,
  onClose,
  onUpdateProject,
  onArchiveProject,
  onAddProjectMembers,
  onProjectRoleChange,
  onRemoveProjectMember,
  isSavingProject = false,
  isArchivingProject = false,
  isSavingMembers = false
}: ProjectSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'members'>(initialTab);
  const [isProjectMemberHintDismissed, setIsProjectMemberHintDismissed] = useState(
    () => localStorage.getItem('tixora.projectMemberHintDismissed') === 'true'
  );
  const [projectMemberSearch, setProjectMemberSearch] = useState('');
  const [selectedProjectMemberUserIds, setSelectedProjectMemberUserIds] = useState<string[]>([]);
  const [projectMemberRole, setProjectMemberRole] =
    useState<ProjectMember['role']>('contributor');
  const projectEditForm = useForm<ProjectEditFormValues>({
    defaultValues: { name: '', description: '' },
    resolver: zodResolver(projectEditFormSchema)
  });

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    projectEditForm.reset({
      name: project?.name ?? '',
      description: project?.description ?? ''
    });
    setSelectedProjectMemberUserIds([]);
  }, [project, projectEditForm]);

  const filteredProjectAccessCandidates = useMemo(() => {
    const query = projectMemberSearch.trim().toLowerCase();
    const projectMemberIds = new Set(projectMembers.map((member) => member.id));
    const members = workspaceMembers.filter(
      (member) => !projectMemberIds.has(member.id)
    );

    if (!query) return members;

    return members.filter((member) =>
      (member.displayName + ' ' + member.email).toLowerCase().includes(query)
    );
  }, [projectMemberSearch, projectMembers, workspaceMembers]);

  const hasProjectMemberSelection = selectedProjectMemberUserIds.length > 0;

  function dismissProjectMemberHint() {
    localStorage.setItem('tixora.projectMemberHintDismissed', 'true');
    setIsProjectMemberHintDismissed(true);
  }

  if (!isOpen || !project) return null;

  return (
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
            <p>{project.name}</p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close project settings"
          >
            ×
          </button>
        </div>

        <div className="settings-tabs" role="tablist" aria-label="Project settings sections">
          <button
            type="button"
            className={activeTab === 'general' ? 'tab-button active' : 'tab-button'}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            type="button"
            className={activeTab === 'members' ? 'tab-button active' : 'tab-button'}
            onClick={() => setActiveTab('members')}
          >
            Members
          </button>
        </div>

        {activeTab === 'general' ? (
          <form
            className="modal-form"
            onSubmit={projectEditForm.handleSubmit(onUpdateProject)}
          >
            <label>
              Project name
              <input {...projectEditForm.register('name')} placeholder="Project name" />
            </label>
            <label>
              Description
              <input {...projectEditForm.register('description')} placeholder="Description" />
            </label>
            <div className="modal-actions split-actions">
              <button type="button" className="danger-button" onClick={() => void onArchiveProject()} disabled={isArchivingProject}>
                {isArchivingProject ? 'Archiving...' : 'Archive'}
              </button>
              <button type="submit" className="primary-button" disabled={isSavingProject}>
                {isSavingProject ? 'Saving...' : 'Save project'}
              </button>
            </div>
          </form>
        ) : null}

        {activeTab === 'members' ? (
          <section className="modal-panel project-members-panel">
            {!isProjectMemberHintDismissed ? (
              <div className="inline-hint">
                <p>These are people from your organization. Adding someone here gives them board access.</p>
                <button type="button" className="icon-button" onClick={dismissProjectMemberHint} aria-label="Dismiss project member hint">
                  ×
                </button>
              </div>
            ) : null}
            <div className="panel-title-row">
              <h3>Project members</h3>
              <span className="meta-text">{projectMembers.length}</span>
            </div>
            <p className="meta-text">Project members are selected from organization members. They can open this board and be assigned to tasks.</p>
            <form
              className="member-form compact"
              onSubmit={async (event) => {
                event.preventDefault();
                await onAddProjectMembers(selectedProjectMemberUserIds, projectMemberRole);
                setSelectedProjectMemberUserIds([]);
                setProjectMemberRole('contributor');
                setProjectMemberSearch('');
              }}
            >
              <UserSearchInput
                label="Add from organization members"
                value={projectMemberSearch}
                onChange={setProjectMemberSearch}
                placeholder="Name or email"
              />
              <div className="search-result-list">
                {filteredProjectAccessCandidates.length === 0 ? (
                  <p className="meta-text">No organization members available to add.</p>
                ) : null}
                {hasProjectMemberSelection ? (
                  <p className="meta-text state-note">{selectedProjectMemberUserIds.length} selected for project access.</p>
                ) : null}
                {filteredProjectAccessCandidates.slice(0, 8).map((member) => (
                  <label
                    key={member.id}
                    className={
                      selectedProjectMemberUserIds.includes(member.id)
                        ? 'search-result user-select-result active'
                        : 'search-result user-select-result'
                    }
                  >
                    <input
                      type="checkbox"
                      checked={selectedProjectMemberUserIds.includes(member.id)}
                      onChange={(event) => {
                        setSelectedProjectMemberUserIds((current) =>
                          event.target.checked
                            ? [...current, member.id]
                            : current.filter((id) => id !== member.id)
                        );
                      }}
                    />
                    <span className="avatar">{getInitials(member.displayName)}</span>
                    <span>
                      <strong>{member.displayName}</strong>
                      <small>{member.email}</small>
                    </span>
                  </label>
                ))}
              </div>
              <select
                value={projectMemberRole}
                disabled={!hasProjectMemberSelection || isSavingMembers}
                onChange={(event) =>
                  setProjectMemberRole(event.target.value as ProjectMember['role'])
                }
              >
                <option value="contributor">Contributor</option>
                <option value="manager">Manager</option>
                <option value="viewer">Viewer</option>
              </select>
              <button type="submit" className="primary-button" disabled={isSavingMembers || !hasProjectMemberSelection}>
                {isSavingMembers ? 'Adding...' : selectedProjectMemberUserIds.length > 0
                  ? 'Add ' + selectedProjectMemberUserIds.length + ' members to project'
                  : 'Add to project'}
              </button>
            </form>
            <div className="member-list compact">
              {projectMembers.length === 0 ? (
                <p className="meta-text">No project members yet. Add organization members above to give board access.</p>
              ) : null}
              {projectMembers.map((member) => (
                <article key={member.id} className="member-row modal-member-row">
                  <span className="avatar">{getInitials(member.displayName)}</span>
                  <div>
                    <strong>{member.displayName}</strong>
                    <p>{member.email}</p>
                  </div>
                  <select
                    value={member.role}
                    onChange={(event) =>
                      void onProjectRoleChange(
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
                    onClick={() => void onRemoveProjectMember(member.id)}
                    disabled={isSavingMembers}
                  >
                    {isSavingMembers ? 'Removing...' : 'Remove'}
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </div>
  );
}
