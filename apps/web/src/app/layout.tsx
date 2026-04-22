import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { QueryProvider } from '@/providers/query-provider';
import { webEnv } from '@/lib/env';

import './globals.css';

export const metadata: Metadata = {
  title: webEnv.NEXT_PUBLIC_APP_NAME,
  description:
    'Milestone 0 application shell for the Customer Support Ticketing SaaS.',
};

interface RootLayoutProps {
  children: ReactNode;
}

const RootLayout = ({ children }: RootLayoutProps) => {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
};

export default RootLayout;
