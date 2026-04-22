import Link from 'next/link';
import { PageScaffold } from '@customer-support/ui';

const RootPage = () => {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <PageScaffold
        eyebrow="MILESTONE 1"
        title="Lean Auth and Role-Aware Shell"
        description="Frontend auth now runs against the live backend cookie flow. Sign-in, sign-up, `/auth/me` hydration, and protected app routing are active. Ticket workflows and business data stay deferred."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Link
            className="rounded-2xl border border-slate-200 bg-white p-5 no-underline shadow-sm"
            href="/sign-in"
          >
            <strong className="block text-slate-950">Auth Entry</strong>
            <span className="mt-2 block text-sm text-slate-600">
              Sign in with a seeded demo account or create a customer account.
            </span>
          </Link>
          <Link
            className="rounded-2xl border border-slate-200 bg-white p-5 no-underline shadow-sm"
            href="/dashboard"
          >
            <strong className="block text-slate-950">
              Protected App Shell
            </strong>
            <span className="mt-2 block text-sm text-slate-600">
              Dashboard, tickets, settings, and profile routes are now guarded
              by backend-authenticated session state and role-aware navigation.
            </span>
          </Link>
        </div>
      </PageScaffold>
    </main>
  );
};

export default RootPage;
