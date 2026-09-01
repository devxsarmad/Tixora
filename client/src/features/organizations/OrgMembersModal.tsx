import { useEffect, useMemo, useState } from 'react';
import { getInitials } from '../../lib/formatters.js';
import { isValidEmail } from '../../lib/validators.js';
import { InviteRow } from '../../components/members/InviteRow.js';
import { UserSearchInput } from '../../components/members/UserSearchInput.js';
import { useUserSearch } from './hooks.js';
import type { InvitationSummary, TeamDetail, TeamMember } from './types.js';

type OrgRole = 'admin' | 'member';

type OrgMembersModalProps = {
  isOpen: boolean;
  token: string;
  team: TeamDetail | null;
  members: TeamMember[];
  invitations: InvitationSummary[];
  isSaving?: boolean;
  onClose: () => void;
  onAddMembers: (emails: string[], role: OrgRole) => Promise<void> | void;
  onInviteMember: (email: string, role: OrgRole) => Promise<void> | void;
  onRoleChange: (userId: string, role: OrgRole) => Promise<void> | void;
  onRemoveMember: (userId: string) => Promise<void> | void;
};

export function OrgMembersModal({
  isOpen,
  token,
  team,
  members,
  invitations,
  onClose,
  onAddMembers,
  onInviteMember,
  onRoleChange,
  onRemoveMember,
  isSaving = false
}: OrgMembersModalProps) {
  const [teamMemberEmail, setTeamMemberEmail] = useState('');
  const [userDirectorySearch, setUserDirectorySearch] = useState('');
  const [debouncedUserDirectorySearch, setDebouncedUserDirectorySearch] = useState('');
  const [selectedDirectoryUserIds, setSelectedDirectoryUserIds] = useState<string[]>([]);
  const [workspaceMemberSearch, setWorkspaceMemberSearch] = useState('');
  const [teamMemberRole, setTeamMemberRole] = useState<OrgRole>('member');
  const userDirectoryQuery = useUserSearch(token, debouncedUserDirectorySearch);
  const userDirectoryResults = debouncedUserDirectorySearch.trim()
    ? userDirectoryQuery.data?.users ?? []
    : [];

  useEffect(() => {
    const query = userDirectorySearch.trim();

    if (!query) {
      setDebouncedUserDirectorySearch('');
      setSelectedDirectoryUserIds([]);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedUserDirectorySearch(query);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [userDirectorySearch]);

  const filteredWorkspaceMembers = useMemo(() => {
    const query = workspaceMemberSearch.trim().toLowerCase();

    if (!query) return members;

    return members.filter((member) =>
      (member.displayName + ' ' + member.email).toLowerCase().includes(query)
    );
  }, [workspaceMemberSearch, members]);

  const availableDirectoryUsers = useMemo(() => {
    const organizationUserIds = new Set(members.map((member) => member.id));

    return userDirectoryResults.filter(
      (user) => !organizationUserIds.has(user.id)
    );
  }, [userDirectoryResults, members]);

  const invitedInvitations = useMemo(
    () => invitations.filter((invitation) => invitation.status === 'pending'),
    [invitations]
  );
  const inviteCandidateEmail = userDirectorySearch.trim().toLowerCase();
  const alreadyMemberTypedEmail = members.some((member) => member.email.toLowerCase() === inviteCandidateEmail);
  const alreadyInvitedTypedEmail = invitedInvitations.some((invitation) => invitation.email.toLowerCase() === inviteCandidateEmail);
  const manualEmail = teamMemberEmail.trim().toLowerCase();
  const canUseManualEmail =
    isValidEmail(manualEmail) &&
    !members.some((member) => member.email.toLowerCase() === manualEmail) &&
    !invitedInvitations.some((invitation) => invitation.email.toLowerCase() === manualEmail);
  const canInviteTypedEmail =
    isValidEmail(inviteCandidateEmail) &&
    availableDirectoryUsers.length === 0 &&
    !alreadyMemberTypedEmail &&
    !alreadyInvitedTypedEmail;
  const canSubmit = selectedDirectoryUserIds.length > 0 || canInviteTypedEmail || canUseManualEmail;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const selectedEmails = selectedDirectoryUserIds
      .map((userId) => userDirectoryResults.find((user) => user.id === userId)?.email)
      .filter((email): email is string => Boolean(email));
    const fallbackEmail = canUseManualEmail ? manualEmail : '';
    const inviteEmail = canInviteTypedEmail ? inviteCandidateEmail : fallbackEmail;

    if (selectedEmails.length > 0) {
      await onAddMembers(selectedEmails, teamMemberRole);
    } else if (inviteEmail) {
      await onInviteMember(inviteEmail, teamMemberRole);
    } else {
      await onAddMembers([], teamMemberRole);
      return;
    }

    setTeamMemberEmail('');
    setUserDirectorySearch('');
    setDebouncedUserDirectorySearch('');
    setSelectedDirectoryUserIds([]);
    setTeamMemberRole('member');
  }

  if (!isOpen || !team) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="task-modal team-members-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-members-title"
      >
        <div className="modal-heading">
          <div>
            <h2 id="team-members-title">Organization members</h2>
            <p>
              {team.name} · {members.length} members · {invitedInvitations.length} invited
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close organization members"
          >
            ×
          </button>
        </div>

        <div className="modal-split">
          <form className="modal-form" onSubmit={(event) => void handleSubmit(event)}>
            <UserSearchInput
              label="Search registered members"
              value={userDirectorySearch}
              onChange={(value) => {
                setUserDirectorySearch(value);
                setSelectedDirectoryUserIds([]);
              }}
              placeholder="Search by name or email"
            />
            <div className="search-result-list">
              {!userDirectorySearch.trim() ? (
                <p className="meta-text">Type a name or email to find registered members.</p>
              ) : null}
              {alreadyMemberTypedEmail ? (
                <p className="meta-text state-note">Already an organization member.</p>
              ) : null}
              {alreadyInvitedTypedEmail ? (
                <p className="meta-text state-note">Already invited. They will appear here after accepting.</p>
              ) : null}
              {userDirectorySearch.trim() &&
              availableDirectoryUsers.length === 0 &&
              !canInviteTypedEmail &&
              !alreadyMemberTypedEmail &&
              !alreadyInvitedTypedEmail ? (
                <p className="meta-text">No matching registered members found.</p>
              ) : null}
              {canInviteTypedEmail ? (
                <InviteRow
                  email={inviteCandidateEmail}
                  onSelect={() => {
                    setTeamMemberEmail(inviteCandidateEmail);
                    setSelectedDirectoryUserIds([]);
                  }}
                />
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
                  aria-invalid={Boolean(teamMemberEmail.trim()) && !canUseManualEmail}
                />
              </label>
              {teamMemberEmail.trim() && !canUseManualEmail ? (
                <span className="field-error">Enter a valid email that is not already a member or invited.</span>
              ) : null}
            </details>
            <label>
              Add as organization role
              <select
                value={teamMemberRole}
                onChange={(event) => setTeamMemberRole(event.target.value as OrgRole)}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <button type="submit" className="primary-button" disabled={isSaving || !canSubmit}>
              {isSaving ? 'Saving...' : selectedDirectoryUserIds.length > 0
                ? 'Add ' + selectedDirectoryUserIds.length + ' members'
                : canUseManualEmail || canInviteTypedEmail
                  ? 'Send invitation'
                  : 'Add selected members'}
            </button>
          </form>

          <section className="modal-panel team-member-list">
            <div className="panel-title-row">
              <h3>Current organization members</h3>
              <span className="meta-text">{members.length + invitedInvitations.length}</span>
            </div>
            <input
              value={workspaceMemberSearch}
              onChange={(event) => setWorkspaceMemberSearch(event.target.value)}
              placeholder="Search members"
            />
            <div className="member-list compact">
              {filteredWorkspaceMembers.length === 0 && invitedInvitations.length === 0 ? (
                <p className="meta-text">No matching members.</p>
              ) : null}
              {invitedInvitations.map((invitation) => (
                <article key={invitation.id} className="member-row modal-member-row invited-member-row">
                  <span className="avatar invite-avatar">@</span>
                  <div>
                    <strong>{invitation.email}</strong>
                    <p>Invitation sent</p>
                  </div>
                  <span className="role-pill invited">Invited</span>
                </article>
              ))}
              {filteredWorkspaceMembers.map((member) => (
                <article key={member.id} className="member-row modal-member-row">
                  <span className="avatar">{getInitials(member.displayName)}</span>
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
                        void onRoleChange(member.id, event.target.value as OrgRole)
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
                      onClick={() => void onRemoveMember(member.id)}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Removing...' : 'Remove'}
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
