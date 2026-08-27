import type { ReactNode } from 'react';

type AppShellProps = {
  children: ReactNode;
  collapsed?: boolean;
};

export function AppShell({ children, collapsed = false }: AppShellProps) {
  return <main className={['board-app', collapsed ? 'sidebar-collapsed' : ''].filter(Boolean).join(' ')}>{children}</main>;
}
