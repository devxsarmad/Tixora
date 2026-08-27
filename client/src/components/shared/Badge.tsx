import type { ReactNode } from 'react';

type BadgeProps = {
  children: ReactNode;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
};

export function Badge({ children, tone = 'neutral', className = '' }: BadgeProps) {
  return <span className={['badge', 'badge-' + tone, className].filter(Boolean).join(' ')}>{children}</span>;
}
