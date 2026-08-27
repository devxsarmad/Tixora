type AvatarProps = {
  name: string;
  className?: string;
};

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function Avatar({ name, className = '' }: AvatarProps) {
  return <span className={['avatar', className].filter(Boolean).join(' ')}>{getInitials(name)}</span>;
}
