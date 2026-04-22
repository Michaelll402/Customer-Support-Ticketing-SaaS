import Link from 'next/link';
import { PageScaffold } from '@customer-support/ui';

const RootPage = () => {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <PageScaffold
        eyebrow="MILESTONE 0"
        title="Foundation Ready for Feature Work"
        description="This screen exists to verify the Next.js shell, shared UI package, and provider baseline. Route protection, auth, and business workflows are intentionally deferred."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Link className="rounded-2xl border border-slate-200 bg-white p-5 no-underline shadow-sm" href="/sign-in">
            <strong className="block text-slate-950">Auth Route Group</strong>
            <span className="mt-2 block text-sm text-slate-600">
              Sign-in and sign-up routes exist as layout scaffolding only.
            </span>
          </Link>
          <Link className="rounded-2xl border border-slate-200 bg-white p-5 no-underline shadow-sm" href="/dashboard">
            <strong className="block text-slate-950">Protected App Route Group</strong>
            <span className="mt-2 block text-sm text-slate-600">
              Dashboard, tickets, settings, and profile routes are present as placeholder screens.
            </span>
          </Link>
        </div>
      </PageScaffold>
    </main>
  );
};

export default RootPage;
