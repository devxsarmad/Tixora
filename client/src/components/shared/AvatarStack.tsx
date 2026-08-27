import { Avatar } from './Avatar.js';

type AvatarStackProps = {
  people: Array<{ id: string; displayName: string }>;
  max?: number;
};

export function AvatarStack({ people, max = 4 }: AvatarStackProps) {
  const visiblePeople = people.slice(0, max);
  const overflow = people.length - visiblePeople.length;

  return (
    <div className="assignee-stack">
      {visiblePeople.map((person) => (
        <Avatar key={person.id} name={person.displayName} />
      ))}
      {overflow > 0 ? <span className="avatar overflow-avatar">+{overflow}</span> : null}
    </div>
  );
}
