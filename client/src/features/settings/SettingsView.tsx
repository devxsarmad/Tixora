import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, KeyRound, LogOut, Mail, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { InviteRow } from '../../components/members/InviteRow.js';
import { UserSearchInput } from '../../components/members/UserSearchInput.js';
import { formatTimestamp, getInitials } from '../../lib/formatters.js';
import { isValidEmail } from '../../lib/validators.js';
import { useUserSearch } from '../organizations/hooks.js';
import type { InvitationSummary, TeamDetail, TeamMember } from '../organizations/types.js';
import type { ProjectDetail, ProjectMember, ProjectSummary } from '../projects/types.js';
import { projectEditFormSchema, type ProjectEditFormValues } from '../workspace/workspaceSchemas.js';
import type { AuthResponse } from '../auth/types.js';

export type SettingsSection = 'profile' | 'organization' | 'project';
type OrgRole = 'admin' | 'member';

const settingsCardClass = 'grid gap-4 rounded-card border border-border bg-surface p-5 shadow-card';
const settingsCardHeadingClass = '[&_h2]:m-0 [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-[-0.012em] [&_h2]:text-text-primary [&_p]:mt-1 [&_p]:mb-0 [&_p]:text-[13px] [&_p]:text-text-muted';
const settingsTwoColumnClass = 'grid items-start gap-5 lg:grid-cols-[minmax(300px,0.82fr)_minmax(380px,1.18fr)]';
const settingsPanelFormClass = 'grid min-w-0 gap-3.5';
const settingsListPanelClass = 'grid min-w-0 gap-3 rounded-card border border-border bg-page p-2.5';
const kickerClass = 'mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted';
const avatarClass = 'grid h-8 w-8 shrink-0 place-items-center rounded-[7px] bg-accent-soft text-xs font-semibold text-accent';
const smallMetaClass = 'm-0 text-[13px] text-text-muted';
const stateNoteClass = 'm-0 rounded-card border border-border bg-surface px-3 py-2 text-[13px] font-medium text-text-secondary';
const searchResultListClass = 'grid gap-2';
const selectableRowClass = 'grid grid-cols-[20px_34px_minmax(0,1fr)] items-center gap-2.5 rounded-card border border-border bg-surface p-2.5 text-left transition-colors hover:border-accent [&_strong]:text-[13px] [&_strong]:font-semibold [&_strong]:text-text-primary [&_small]:block [&_small]:text-xs [&_small]:text-text-muted';
const selectedRowClass = 'border-accent bg-accent-soft';
const memberListClass = 'grid gap-2';
const memberRowClass = 'grid grid-cols-[34px_minmax(0,1fr)_112px_auto] items-center gap-3 rounded-card border border-border bg-surface p-2.5 max-sm:grid-cols-[34px_minmax(0,1fr)] [&_strong]:block [&_strong]:text-[13px] [&_strong]:font-semibold [&_strong]:text-text-primary [&_p]:m-0 [&_p]:text-xs [&_p]:text-text-muted';
const invitedMemberRowClass = 'grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 rounded-card border border-border bg-surface p-2.5 [&_strong]:block [&_strong]:text-[13px] [&_strong]:font-semibold [&_strong]:text-text-primary [&_p]:m-0 [&_p]:text-xs [&_p]:text-text-muted';
const rolePillClass = 'inline-flex h-6 items-center justify-center rounded-[7px] bg-accent-soft px-2 text-xs font-semibold capitalize text-accent';
const invitedPillClass = 'inline-flex h-6 items-center justify-center rounded-[7px] bg-[var(--status-in-progress-bg)] px-2 text-xs font-semibold text-[var(--status-in-progress-text)]';
const primaryButtonClass = 'inline-flex min-h-8 items-center justify-center gap-1.5 justify-self-start rounded-control bg-accent px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:h-3.5 [&_svg]:w-3.5';
const ghostButtonClass = 'inline-flex min-h-8 items-center justify-center gap-1.5 justify-self-start rounded-control border border-border bg-surface px-3 py-1.5 text-[13px] font-semibold text-text-secondary transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:h-3.5 [&_svg]:w-3.5';
const dangerButtonClass = 'inline-flex min-h-8 items-center justify-center gap-1.5 justify-self-start rounded-control border border-[var(--color-danger)] bg-surface px-3 py-1.5 text-[13px] font-semibold text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-bg)] disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:h-3.5 [&_svg]:w-3.5';
const fieldErrorClass = 'text-[13px] font-semibold text-[var(--color-danger)]';
const inlineHintClass = 'rounded-card border border-border bg-accent-soft px-3 py-2 text-[13px] text-text-secondary [&_p]:m-0';
const emptyClass = 'rounded-card border border-dashed border-border bg-surface p-4 text-[13px] font-medium text-text-muted';
const nativeInputClass = 'min-h-9 w-full rounded-control border border-border bg-surface px-3 py-1.5 text-[13px] text-text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';
const formActionsClass = 'flex flex-wrap items-center justify-between gap-3';
const sectionDividerClass = 'border-t border-border pt-4';
const profileFieldClass = 'grid gap-1.5 rounded-card border border-border bg-page p-2.5';
const profileFieldHeaderClass = 'flex items-center justify-between gap-3';
const profileLabelClass = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted';
const inlineActionClass = 'inline-flex min-h-7 items-center justify-center gap-1.5 rounded-control border border-border bg-surface px-2 text-[12px] font-semibold text-text-secondary transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:h-3.5 [&_svg]:w-3.5';
const dangerZoneClass = 'grid gap-3 rounded-card border border-[var(--color-danger)] bg-[var(--color-danger-bg)]/35 p-3';
const dangerTextClass = 'm-0 text-xs text-[var(--color-danger)]';

function formatDateOnly(value?: string) {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function settingsNavButtonClass(isActive: boolean) {
  return [
    'grid min-h-10 grid-cols-[32px_minmax(0,1fr)] items-center gap-2.5 rounded-card bg-transparent px-2 py-1.5 text-left transition-colors',
    '[&_span]:grid [&_span]:h-7 [&_span]:w-7 [&_span]:place-items-center [&_span]:rounded-[7px] [&_span]:bg-page [&_span]:text-xs [&_span]:font-semibold [&_span]:text-text-secondary',
    '[&_strong]:overflow-hidden [&_strong]:text-ellipsis [&_strong]:whitespace-nowrap [&_strong]:text-[13px] [&_strong]:font-semibold [&_strong]:text-text-secondary',
    isActive ? 'bg-accent-soft [&_span]:bg-accent [&_span]:text-surface [&_strong]:text-text-primary' : ''
  ].filter(Boolean).join(' ');
}

type SettingsViewProps = {
  session: AuthResponse;
  activeSection: SettingsSection;
  token: string;
  team: TeamDetail | null;
  project: ProjectSummary | null;
  projectDetail: ProjectDetail | null;
  workspaceMembers: TeamMember[];
  projectMembers: ProjectMember[];
  invitations: InvitationSummary[];
  isSavingOrganizationMembers?: boolean;
  isSavingProject?: boolean;
  isArchivingProject?: boolean;
  isSavingProjectMembers?: boolean;
  onSectionChange: (section: SettingsSection) => void;
  onAddMembers: (emails: string[], role: OrgRole) => Promise<void> | void;
  onInviteMember: (email: string, role: OrgRole) => Promise<void> | void;
  onOrganizationRoleChange: (userId: string, role: OrgRole) => Promise<void> | void;
  onRemoveOrganizationMember: (userId: string) => Promise<void> | void;
  onUpdateProject: (values: ProjectEditFormValues) => Promise<void> | void;
  onArchiveProject: () => Promise<void> | void;
  onAddProjectMembers: (userIds: string[], role: ProjectMember['role']) => Promise<void> | void;
  onProjectRoleChange: (userId: string, role: ProjectMember['role']) => Promise<void> | void;
  onRemoveProjectMember: (userId: string) => Promise<void> | void;
};

export function SettingsView({
  session,
  activeSection,
  token,
  team,
  project,
  projectDetail,
  workspaceMembers,
  projectMembers,
  invitations,
  isSavingOrganizationMembers = false,
  isSavingProject = false,
  isArchivingProject = false,
  isSavingProjectMembers = false,
  onSectionChange,
  onAddMembers,
  onInviteMember,
  onOrganizationRoleChange,
  onRemoveOrganizationMember,
  onUpdateProject,
  onArchiveProject,
  onAddProjectMembers,
  onProjectRoleChange,
  onRemoveProjectMember
}: SettingsViewProps) {
  const [organizationRole, setOrganizationRole] = useState<OrgRole>('member');
  const [directorySearch, setDirectorySearch] = useState('');
  const [debouncedDirectorySearch, setDebouncedDirectorySearch] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [selectedDirectoryUserIds, setSelectedDirectoryUserIds] = useState<string[]>([]);
  const [organizationMemberSearch, setOrganizationMemberSearch] = useState('');
  const [projectMemberSearch, setProjectMemberSearch] = useState('');
  const [selectedProjectMemberUserIds, setSelectedProjectMemberUserIds] = useState<string[]>([]);
  const [projectMemberRole, setProjectMemberRole] = useState<ProjectMember['role']>('contributor');
  const [profilePhotoDataUrl, setProfilePhotoDataUrl] = useState<string | null>(null);
  const [savedProfile, setSavedProfile] = useState({
    displayName: session.user.displayName,
    email: session.user.email
  });
  const [profileDraft, setProfileDraft] = useState(savedProfile);
  const [editingProfileField, setEditingProfileField] = useState<'displayName' | 'email' | null>(null);
  const userDirectoryQuery = useUserSearch(token, debouncedDirectorySearch);
  const userDirectoryResults = debouncedDirectorySearch.trim() ? userDirectoryQuery.data?.users ?? [] : [];
  const projectEditForm = useForm<ProjectEditFormValues>({
    defaultValues: { name: '', description: '' },
    resolver: zodResolver(projectEditFormSchema)
  });

  useEffect(() => {
    const query = directorySearch.trim();
    if (!query) {
      setDebouncedDirectorySearch('');
      setSelectedDirectoryUserIds([]);
      return;
    }

    const timeoutId = window.setTimeout(() => setDebouncedDirectorySearch(query), 250);
    return () => window.clearTimeout(timeoutId);
  }, [directorySearch]);

  useEffect(() => {
    projectEditForm.reset({ name: project?.name ?? '', description: project?.description ?? '' });
    setSelectedProjectMemberUserIds([]);
    setProjectMemberSearch('');
  }, [project, projectEditForm]);

  useEffect(() => {
    const nextProfile = { displayName: session.user.displayName, email: session.user.email };
    setSavedProfile(nextProfile);
    setProfileDraft(nextProfile);
    setEditingProfileField(null);
  }, [session.user.displayName, session.user.email]);

  const pendingInvitations = useMemo(
    () => invitations.filter((invitation) => invitation.status === 'pending'),
    [invitations]
  );
  const availableDirectoryUsers = useMemo(() => {
    const existingMemberIds = new Set(workspaceMembers.map((member) => member.id));
    return userDirectoryResults.filter((user) => !existingMemberIds.has(user.id));
  }, [userDirectoryResults, workspaceMembers]);
  const normalizedDirectoryEmail = directorySearch.trim().toLowerCase();
  const normalizedManualEmail = manualEmail.trim().toLowerCase();
  const alreadyMemberTypedEmail = workspaceMembers.some((member) => member.email.toLowerCase() === normalizedDirectoryEmail);
  const alreadyInvitedTypedEmail = pendingInvitations.some((invitation) => invitation.email.toLowerCase() === normalizedDirectoryEmail);
  const canInviteTypedEmail = isValidEmail(normalizedDirectoryEmail) && availableDirectoryUsers.length === 0 && !alreadyMemberTypedEmail && !alreadyInvitedTypedEmail;
  const canUseManualEmail = isValidEmail(normalizedManualEmail) && !workspaceMembers.some((member) => member.email.toLowerCase() === normalizedManualEmail) && !pendingInvitations.some((invitation) => invitation.email.toLowerCase() === normalizedManualEmail);
  const canSubmitOrganizationMembers = selectedDirectoryUserIds.length > 0 || canInviteTypedEmail || canUseManualEmail;
  const filteredOrganizationMembers = useMemo(() => {
    const query = organizationMemberSearch.trim().toLowerCase();
    if (!query) return workspaceMembers;
    return workspaceMembers.filter((member) => (member.displayName + ' ' + member.email).toLowerCase().includes(query));
  }, [organizationMemberSearch, workspaceMembers]);
  const filteredProjectCandidates = useMemo(() => {
    const query = projectMemberSearch.trim().toLowerCase();
    const existingProjectMemberIds = new Set(projectMembers.map((member) => member.id));
    const availableMembers = workspaceMembers.filter((member) => !existingProjectMemberIds.has(member.id));
    if (!query) return availableMembers;
    return availableMembers.filter((member) => (member.displayName + ' ' + member.email).toLowerCase().includes(query));
  }, [projectMemberSearch, projectMembers, workspaceMembers]);
  const currentOrganizationMember = workspaceMembers.find((member) => member.id === session.user.id);
  const canSaveProfileField = editingProfileField === 'displayName'
    ? profileDraft.displayName.trim().length > 0 && profileDraft.displayName.trim() !== savedProfile.displayName
    : editingProfileField === 'email'
      ? isValidEmail(profileDraft.email.trim()) && profileDraft.email.trim().toLowerCase() !== savedProfile.email.toLowerCase()
      : false;

  async function submitOrganizationMembers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedEmails = selectedDirectoryUserIds
      .map((userId) => userDirectoryResults.find((user) => user.id === userId)?.email)
      .filter((email): email is string => Boolean(email));
    const inviteEmail = canInviteTypedEmail ? normalizedDirectoryEmail : canUseManualEmail ? normalizedManualEmail : '';

    if (selectedEmails.length > 0) await onAddMembers(selectedEmails, organizationRole);
    else if (inviteEmail) await onInviteMember(inviteEmail, organizationRole);
    else return;

    setDirectorySearch('');
    setDebouncedDirectorySearch('');
    setManualEmail('');
    setSelectedDirectoryUserIds([]);
    setOrganizationRole('member');
  }

  async function submitProjectMembers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedProjectMemberUserIds.length === 0) return;
    await onAddProjectMembers(selectedProjectMemberUserIds, projectMemberRole);
    setSelectedProjectMemberUserIds([]);
    setProjectMemberSearch('');
    setProjectMemberRole('contributor');
  }

  function handleProfilePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setProfilePhotoDataUrl(String(reader.result));
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  function saveProfileField() {
    if (!editingProfileField || !canSaveProfileField) return;
    setSavedProfile({
      displayName: profileDraft.displayName.trim(),
      email: profileDraft.email.trim()
    });
    setEditingProfileField(null);
  }

  function cancelProfileEdit() {
    setProfileDraft(savedProfile);
    setEditingProfileField(null);
  }

  return (
    <section className="grid min-h-0 gap-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className={kickerClass}>Settings</p>
          <h1 className="m-0 font-heading text-[22px] font-semibold leading-[1.2] tracking-[-0.012em] text-text-primary">Workspace settings</h1>
          <p className="mb-0 mt-1 text-[13px] text-text-muted">{team?.name ?? 'Organization'} settings, profile, members, and project access in one place.</p>
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="sticky top-6 grid gap-2 rounded-card border border-border bg-surface p-2.5 shadow-card max-lg:static max-lg:grid-cols-3 max-sm:grid-cols-1" aria-label="Settings sections">
          <button type="button" className={settingsNavButtonClass(activeSection === 'profile')} onClick={() => onSectionChange('profile')}>
            <span>{getInitials(session.user.displayName)}</span>
            <strong>User profile</strong>
          </button>
          <button type="button" className={settingsNavButtonClass(activeSection === 'organization')} onClick={() => onSectionChange('organization')}>
            <span>{workspaceMembers.length}</span>
            <strong>Organization members</strong>
          </button>
          <button type="button" className={settingsNavButtonClass(activeSection === 'project')} onClick={() => onSectionChange('project')} disabled={!project}>
            <span>{projectMembers.length}</span>
            <strong>Project members</strong>
          </button>
        </aside>

        <div className="grid min-w-0 gap-4">
          {activeSection === 'profile' ? (
            <section className={settingsCardClass + ' max-w-[1080px] gap-0 p-0'}>
              <div className="grid gap-4 border-b border-border p-4 sm:grid-cols-[72px_minmax(0,1fr)] sm:items-center">
                <div className="group relative h-16 w-16">
                  {profilePhotoDataUrl ? (
                    <img src={profilePhotoDataUrl} alt={savedProfile.displayName + ' profile photo'} className="h-16 w-16 rounded-full border border-border object-cover shadow-card" />
                  ) : (
                    <span className="grid h-16 w-16 place-items-center rounded-full border border-border bg-accent-soft font-heading text-[20px] font-semibold text-accent shadow-card">
                      {getInitials(savedProfile.displayName)}
                    </span>
                  )}
                  <label className="absolute bottom-0 right-0 grid h-7 w-7 cursor-pointer place-items-center rounded-full border border-border bg-surface text-text-secondary shadow-popover transition-colors hover:border-accent hover:text-accent [&_svg]:h-3.5 [&_svg]:w-3.5" title="Edit photo" aria-label="Edit profile photo">
                    <Camera aria-hidden="true" />
                    <input type="file" accept="image/*" className="sr-only" onChange={handleProfilePhotoChange} />
                  </label>
                </div>
                <div className="min-w-0">
                  <p className={kickerClass}>User profile</p>
                  <h2 className="m-0 truncate font-heading text-lg font-semibold tracking-[-0.012em] text-text-primary">{savedProfile.displayName}</h2>
                  <p className="mb-0 mt-0.5 text-[13px] text-text-muted">{savedProfile.email}</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <label className={ghostButtonClass + ' cursor-pointer'}>
                      Edit photo
                      <input type="file" accept="image/*" className="sr-only" onChange={handleProfilePhotoChange} />
                    </label>
                    <button type="button" className={inlineActionClass} disabled={!profilePhotoDataUrl} onClick={() => setProfilePhotoDataUrl(null)}>Remove photo</button>
                  </div>
                </div>
              </div>

              <div className="grid max-w-[820px] gap-4 p-4">
                <div className="grid gap-2.5">
                  <div className={profileFieldClass}>
                    <div className={profileFieldHeaderClass}>
                      <span className={profileLabelClass}>Full name</span>
                      {editingProfileField !== 'displayName' ? (
                        <button type="button" className={inlineActionClass} onClick={() => setEditingProfileField('displayName')}><Pencil aria-hidden="true" /> Edit</button>
                      ) : null}
                    </div>
                    <input
                      className={nativeInputClass}
                      value={profileDraft.displayName}
                      readOnly={editingProfileField !== 'displayName'}
                      onChange={(event) => setProfileDraft((current) => ({ ...current, displayName: event.target.value }))}
                    />
                    {editingProfileField === 'displayName' ? (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className={primaryButtonClass} disabled={!canSaveProfileField} onClick={saveProfileField}>Save</button>
                        <button type="button" className={ghostButtonClass} onClick={cancelProfileEdit}>Cancel</button>
                      </div>
                    ) : null}
                  </div>

                  <div className={profileFieldClass}>
                    <div className={profileFieldHeaderClass}>
                      <span className={profileLabelClass}>Email</span>
                      {editingProfileField !== 'email' ? (
                        <button type="button" className={inlineActionClass} onClick={() => setEditingProfileField('email')}><Pencil aria-hidden="true" /> Edit</button>
                      ) : null}
                    </div>
                    <input
                      className={nativeInputClass}
                      value={profileDraft.email}
                      readOnly={editingProfileField !== 'email'}
                      onChange={(event) => setProfileDraft((current) => ({ ...current, email: event.target.value }))}
                      aria-invalid={editingProfileField === 'email' && profileDraft.email.trim().length > 0 && !isValidEmail(profileDraft.email.trim())}
                    />
                    {editingProfileField === 'email' && profileDraft.email.trim().length > 0 && !isValidEmail(profileDraft.email.trim()) ? (
                      <span className={fieldErrorClass}>Enter a valid email address.</span>
                    ) : null}
                    {editingProfileField === 'email' ? (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className={primaryButtonClass} disabled={!canSaveProfileField} onClick={saveProfileField}>Save</button>
                        <button type="button" className={ghostButtonClass} onClick={cancelProfileEdit}>Cancel</button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <section className={sectionDividerClass}>
                  <div className={settingsCardHeadingClass}>
                    <h2>Account details</h2>
                    <p>Organization context for your current workspace.</p>
                  </div>
                  <dl className="mt-3 grid gap-2.5 sm:grid-cols-3">
                    <div className="rounded-card border border-border bg-page p-2.5">
                      <dt className={profileLabelClass}>Member since</dt>
                      <dd className="m-0 mt-1 text-[13px] font-semibold text-text-primary">{formatDateOnly(currentOrganizationMember?.joinedAt ?? session.user.createdAt)}</dd>
                    </div>
                    <div className="rounded-card border border-border bg-page p-2.5">
                      <dt className={profileLabelClass}>Role in organization</dt>
                      <dd className="m-0 mt-1 text-[13px] font-semibold capitalize text-text-primary">{currentOrganizationMember?.role ?? 'Member'}</dd>
                    </div>
                    <div className="rounded-card border border-border bg-page p-2.5">
                      <dt className={profileLabelClass}>Last active</dt>
                      <dd className="m-0 mt-1 text-[13px] font-semibold text-text-primary">Active now</dd>
                    </div>
                  </dl>
                  <p className="mb-0 mt-2 text-xs text-text-muted">Account created {formatTimestamp(session.user.createdAt)}.</p>
                </section>

                <section className={dangerZoneClass}>
                  <div>
                    <h2 className="m-0 font-heading text-[15px] font-semibold tracking-[-0.012em] text-[var(--color-danger)]">Danger zone</h2>
                    <p className={dangerTextClass}>Security and account-level actions should be handled carefully.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={ghostButtonClass}><KeyRound aria-hidden="true" /> Change password</button>
                    <button type="button" className={dangerButtonClass}><LogOut aria-hidden="true" /> Leave organization</button>
                    <button type="button" className={dangerButtonClass}><Trash2 aria-hidden="true" /> Delete account</button>
                  </div>
                </section>
              </div>
            </section>
          ) : null}

          {activeSection === 'organization' ? (
            <section className={settingsCardClass}>
              <div className={settingsCardHeadingClass + ' flex items-center justify-between gap-3'}>
                <div>
                  <h2>Organization members</h2>
                  <p>{workspaceMembers.length} members · {pendingInvitations.length} invited</p>
                </div>
              </div>
              <div className={settingsTwoColumnClass}>
                <form className={settingsPanelFormClass} onSubmit={submitOrganizationMembers}>
                  <UserSearchInput
                    label="Search registered members"
                    value={directorySearch}
                    onChange={(value) => {
                      setDirectorySearch(value);
                      setSelectedDirectoryUserIds([]);
                      setManualEmail('');
                    }}
                    placeholder="Search by name or email"
                  />
                  <div className={searchResultListClass}>
                    {!directorySearch.trim() ? <p className={smallMetaClass}>Type a name or email to find registered members.</p> : null}
                    {alreadyMemberTypedEmail ? <p className={stateNoteClass}>Already an organization member.</p> : null}
                    {alreadyInvitedTypedEmail ? <p className={stateNoteClass}>Already invited.</p> : null}
                    {canInviteTypedEmail ? <InviteRow email={normalizedDirectoryEmail} onSelect={() => setManualEmail(normalizedDirectoryEmail)} /> : null}
                    {availableDirectoryUsers.map((user) => (
                      <label key={user.id} className={selectedDirectoryUserIds.includes(user.id) ? selectableRowClass + ' ' + selectedRowClass : selectableRowClass}>
                        <input
                          type="checkbox"
                          checked={selectedDirectoryUserIds.includes(user.id)}
                          onChange={(event) => {
                            setSelectedDirectoryUserIds((current) => event.target.checked ? [...current, user.id] : current.filter((id) => id !== user.id));
                            setManualEmail('');
                          }}
                        />
                        <span className={avatarClass}>{getInitials(user.displayName)}</span>
                        <span><strong>{user.displayName}</strong><small>{user.email}</small></span>
                      </label>
                    ))}
                  </div>
                  <details className="rounded-card border border-dashed border-border bg-surface p-3 text-sm text-text-secondary">
                    <summary>Add by exact email</summary>
                    <label>
                      User email
                      <input className={nativeInputClass} value={manualEmail} onChange={(event) => setManualEmail(event.target.value)} placeholder="person@example.com" aria-invalid={Boolean(manualEmail.trim()) && !canUseManualEmail} />
                    </label>
                    {manualEmail.trim() && !canUseManualEmail ? <span className={fieldErrorClass}>Enter a valid email that is not already a member or invited.</span> : null}
                  </details>
                  <label>
                    Add as organization role
                    <select className={nativeInputClass} value={organizationRole} onChange={(event) => setOrganizationRole(event.target.value as OrgRole)}>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                  <button type="submit" className={primaryButtonClass} disabled={isSavingOrganizationMembers || !canSubmitOrganizationMembers}>
                    {isSavingOrganizationMembers ? 'Saving...' : selectedDirectoryUserIds.length > 0 ? 'Add ' + selectedDirectoryUserIds.length + ' members' : 'Send invitation'}
                  </button>
                </form>

                <section className={settingsListPanelClass}>
                  <div className="flex items-center justify-between gap-3"><h3 className="m-0 font-heading text-base font-bold text-text-primary">Current members</h3><span className={smallMetaClass}>{workspaceMembers.length + pendingInvitations.length}</span></div>
                  <input className={nativeInputClass} value={organizationMemberSearch} onChange={(event) => setOrganizationMemberSearch(event.target.value)} placeholder="Search members" />
                  <div className={memberListClass}>
                    {pendingInvitations.map((invitation) => (
                      <article key={invitation.id} className={invitedMemberRowClass}>
                        <span className={avatarClass}><Mail aria-hidden="true" /></span>
                        <div><strong>{invitation.email}</strong><p>Invitation sent</p></div>
                        <span className={invitedPillClass}>Invited</span>
                      </article>
                    ))}
                    {filteredOrganizationMembers.map((member) => (
                      <article key={member.id} className={memberRowClass}>
                        <span className={avatarClass}>{getInitials(member.displayName)}</span>
                        <div><strong>{member.displayName}</strong><p>{member.email}</p></div>
                        {member.role === 'owner' ? <span className={rolePillClass}>Owner</span> : (
                          <select className={nativeInputClass} value={member.role} disabled={isSavingOrganizationMembers} onChange={(event) => void onOrganizationRoleChange(member.id, event.target.value as OrgRole)}>
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                        {member.role !== 'owner' ? <button type="button" className={ghostButtonClass} disabled={isSavingOrganizationMembers} onClick={() => void onRemoveOrganizationMember(member.id)}>Remove</button> : null}
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            </section>
          ) : null}

          {activeSection === 'project' ? (
            <section className={settingsCardClass}>
              <div className={settingsCardHeadingClass}>
                <h2>Project settings</h2>
                <p>{project?.name ?? 'Select a project'} · project details and board access.</p>
              </div>
              {project ? (
                <div className={settingsTwoColumnClass}>
                  <form className={settingsPanelFormClass} onSubmit={projectEditForm.handleSubmit(onUpdateProject)}>
                    <label>
                      Project name
                      <input className={nativeInputClass} {...projectEditForm.register('name')} placeholder="Project name" aria-invalid={Boolean(projectEditForm.formState.errors.name)} />
                    </label>
                    {projectEditForm.formState.errors.name ? <span className={fieldErrorClass}>{projectEditForm.formState.errors.name.message}</span> : null}
                    <label>
                      Description
                      <input className={nativeInputClass} {...projectEditForm.register('description')} placeholder="Description" />
                    </label>
                    <div className={formActionsClass}>
                      <button type="button" className={dangerButtonClass} onClick={() => void onArchiveProject()} disabled={isArchivingProject}>{isArchivingProject ? 'Archiving...' : 'Archive project'}</button>
                      <button type="submit" className={primaryButtonClass} disabled={isSavingProject}>{isSavingProject ? 'Saving...' : 'Save project'}</button>
                    </div>
                  </form>

                  <section className={settingsListPanelClass}>
                    <div className={inlineHintClass}><p>Project members are selected from organization members. Adding someone here gives them board access.</p></div>
                    <form className={settingsPanelFormClass} onSubmit={submitProjectMembers}>
                      <UserSearchInput label="Add from organization members" value={projectMemberSearch} onChange={setProjectMemberSearch} placeholder="Name or email" />
                      <div className={searchResultListClass}>
                        {filteredProjectCandidates.length === 0 ? <p className={smallMetaClass}>No organization members available to add.</p> : null}
                        {selectedProjectMemberUserIds.length > 0 ? <p className={stateNoteClass}>{selectedProjectMemberUserIds.length} selected for project access.</p> : null}
                        {filteredProjectCandidates.slice(0, 8).map((member) => (
                          <label key={member.id} className={selectedProjectMemberUserIds.includes(member.id) ? selectableRowClass + ' ' + selectedRowClass : selectableRowClass}>
                            <input type="checkbox" checked={selectedProjectMemberUserIds.includes(member.id)} onChange={(event) => setSelectedProjectMemberUserIds((current) => event.target.checked ? [...current, member.id] : current.filter((id) => id !== member.id))} />
                            <span className={avatarClass}>{getInitials(member.displayName)}</span>
                            <span><strong>{member.displayName}</strong><small>{member.email}</small></span>
                          </label>
                        ))}
                      </div>
                      <select className={nativeInputClass} value={projectMemberRole} disabled={selectedProjectMemberUserIds.length === 0 || isSavingProjectMembers} onChange={(event) => setProjectMemberRole(event.target.value as ProjectMember['role'])}>
                        <option value="contributor">Contributor</option>
                        <option value="manager">Manager</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button type="submit" className={primaryButtonClass} disabled={isSavingProjectMembers || selectedProjectMemberUserIds.length === 0}>{isSavingProjectMembers ? 'Adding...' : 'Add to project'}</button>
                    </form>
                    <div className={memberListClass}>
                      {projectMembers.map((member) => (
                        <article key={member.id} className={memberRowClass}>
                          <span className={avatarClass}>{getInitials(member.displayName)}</span>
                          <div><strong>{member.displayName}</strong><p>{member.email}</p></div>
                          <select className={nativeInputClass} value={member.role} disabled={isSavingProjectMembers} onChange={(event) => void onProjectRoleChange(member.id, event.target.value as ProjectMember['role'])}>
                            <option value="contributor">Contributor</option>
                            <option value="manager">Manager</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <button type="button" className={ghostButtonClass} disabled={isSavingProjectMembers} onClick={() => void onRemoveProjectMember(member.id)}>Remove</button>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>
              ) : <div className={emptyClass}>Select a project to manage project settings.</div>}
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}
