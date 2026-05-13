import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { QueryProvider } from '@/providers/query-provider';
import { RealtimeProvider } from '@/providers/realtime-provider';
import { webEnv } from '@/lib/env';

import './globals.css';

export const metadata: Metadata = {
  title: webEnv.NEXT_PUBLIC_APP_NAME,
  description:
    'Customer Support Ticketing SaaS workspace for support tickets, conversations, and attachments.',
};

interface RootLayoutProps {
  children: ReactNode;
}

const RootLayout = ({ children }: RootLayoutProps) => {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <RealtimeProvider>{children}</RealtimeProvider>
        </QueryProvider>
      </body>
    </html>
  );
};

export default RootLayout;
