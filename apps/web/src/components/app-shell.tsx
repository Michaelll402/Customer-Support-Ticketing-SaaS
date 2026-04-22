'use client';

import { AppShellScaffold } from '@customer-support/ui';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { appShellItems, siteSubtitle, siteTitle } from '@/lib/site';

interface AppShellProps {
  children: ReactNode;
}

export const AppShell = ({ children }: AppShellProps) => {
  const pathname = usePathname();

  return (
    <AppShellScaffold
      currentPath={pathname}
      items={appShellItems}
      subtitle={siteSubtitle}
      title={siteTitle}
    >
      {children}
    </AppShellScaffold>
  );
};
