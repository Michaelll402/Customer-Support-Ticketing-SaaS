import type { ReactNode } from 'react';

import { AppShell } from '@/components/app-shell';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return <AppShell>{children}</AppShell>;
};

export default AppLayout;
