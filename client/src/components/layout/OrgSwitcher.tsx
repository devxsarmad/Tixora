import type { TeamSummary } from '../../features/workspace/types.js';

type OrgSwitcherProps = {
  teams: TeamSummary[];
  selectedTeamSlug: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (slug: string) => void;
  onCreate: () => void;
  getInitials: (name: string) => string;
};

export function OrgSwitcher({ teams, selectedTeamSlug, isOpen, onToggle, onSelect, onCreate, getInitials }: OrgSwitcherProps) {
  const selectedTeam = teams.find((team) => team.slug === selectedTeamSlug) ?? null;

  return (
    <div className="org-switcher">
      <button type="button" className="org-switcher-button" onClick={onToggle} aria-expanded={isOpen}>
        <span className="avatar org-avatar">{getInitials(selectedTeam?.name ?? 'Tixora')}</span>
        <span>
          <strong>{selectedTeam?.name ?? 'No organization'}</strong>
          <small>Workspace</small>
        </span>
        <span className="switcher-chevron">⌄</span>
      </button>
      {isOpen ? (
        <div className="org-switcher-popover" role="menu">
          {teams.map((team) => (
            <button key={team.id} type="button" className={team.slug === selectedTeamSlug ? 'org-option active' : 'org-option'} onClick={() => onSelect(team.slug)}>
              <span className="avatar org-avatar">{getInitials(team.name)}</span>
              <span>
                <strong>{team.name}</strong>
                <small>{team.memberCount} members</small>
              </span>
            </button>
          ))}
          <button type="button" className="org-create-option" onClick={onCreate}>+ Create new organization</button>
        </div>
      ) : null}
    </div>
  );
}
