import { useMemo, useState } from 'react';
import { getInitials } from '../../../lib/formatters.js';
import type { ProjectMember } from '../../projects/types.js';

type AssigneePickerProps = {
  members: ProjectMember[];
  selectedIds: string[];
  error?: string;
  disabled?: boolean;
  workspaceMemberCount?: number;
  onChange: (selectedIds: string[]) => void;
  onManageProjectMembers: () => void;
  onAddOrganizationMember: () => void;
};

export function AssigneePicker({
  members,
  selectedIds,
  error,
  disabled = false,
  workspaceMemberCount,
  onChange,
  onManageProjectMembers,
  onAddOrganizationMember
}: AssigneePickerProps) {
  const [search, setSearch] = useState('');
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members;

    return members.filter((member) =>
      (member.displayName + ' ' + member.email).toLowerCase().includes(query)
    );
  }, [members, search]);

  function toggleMember(memberId: string, checked: boolean) {
    if (checked) {
      onChange([...selectedIds, memberId]);
      return;
    }

    onChange(selectedIds.filter((id) => id !== memberId));
  }

  return (
    <section className={['assignee-picker', error ? 'has-error' : ''].filter(Boolean).join(' ')}>
      <div className="panel-title-row">
        <h3>Task assignees</h3>
        <span className="meta-text required-marker">Required · {selectedIds.length} selected</span>
      </div>
      <p className="meta-text">
        {workspaceMemberCount !== undefined ? workspaceMemberCount + ' organization members · ' : ''}
        {members.length} project members available for tasks.
      </p>
      <label className="field-label compact-field-label">
        Search project members
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search project members..."
          disabled={disabled || members.length === 0}
          aria-invalid={Boolean(error)}
        />
      </label>
      <div className="check-list compact-checks assignee-list">
        {members.length === 0 ? (
          <p className="meta-text">No project members yet. Add organization members to project access first.</p>
        ) : null}
        {members.length > 0 && filteredMembers.length === 0 ? (
          <p className="meta-text">No matching project members.</p>
        ) : null}
        {filteredMembers.map((member) => (
          <label
            key={member.id}
            className={selectedSet.has(member.id) ? 'check-row assignee-option active' : 'check-row assignee-option'}
          >
            <input
              type="checkbox"
              checked={selectedSet.has(member.id)}
              disabled={disabled}
              onChange={(event) => toggleMember(member.id, event.target.checked)}
            />
            <span className="avatar">{getInitials(member.displayName)}</span>
            <span>
              <strong>{member.displayName}</strong>
              <small>{member.email}</small>
            </span>
          </label>
        ))}
      </div>
      {error ? <span className="field-error">{error}</span> : null}
      <div className="assignee-helper-actions">
        <button type="button" className="ghost-button" onClick={onManageProjectMembers} disabled={disabled}>
          Manage project members
        </button>
        <button type="button" className="ghost-button" onClick={onAddOrganizationMember} disabled={disabled}>
          Add organization member
        </button>
      </div>
    </section>
  );
}
