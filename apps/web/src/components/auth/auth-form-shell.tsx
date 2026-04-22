import Link from 'next/link';
import type { ReactNode } from 'react';

interface AuthFormShellProps {
  alternateHref: string;
  alternateLabel: string;
  alternatePrompt: string;
  children: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}

export const AuthFormShell = ({
  alternateHref,
  alternateLabel,
  alternatePrompt,
  children,
  description,
  eyebrow,
  title,
}: AuthFormShellProps) => {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.16),_transparent_38%),linear-gradient(180deg,_#f8fafc_0%,_#e2e8f0_100%)] px-6 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-700">
            Milestone 1
          </p>
          <div className="space-y-4">
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Support auth that stays small, predictable, and ready for the real
              product surface.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              This slice only covers identity, access, and the role-aware shell.
              Ticket workflows, dashboards, and admin operations remain deferred
              to later milestones.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/60 bg-white/75 p-5 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Cookie Auth
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Session state is derived from the backend via{' '}
                <code>/auth/me</code>. No `localStorage`, no refresh flow, no
                extra session tables.
              </p>
            </div>
            <div className="rounded-3xl border border-white/60 bg-white/75 p-5 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Role-aware shell
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Customers, agents, managers, and admins see the correct
                placeholder destinations without pulling ticket or reporting
                features forward.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.35)] backdrop-blur sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-700">
            {eyebrow}
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>

          <div className="mt-8">{children}</div>

          <p className="mt-8 text-sm text-slate-600">
            {alternatePrompt}{' '}
            <Link
              className="font-semibold text-sky-700 hover:text-sky-800"
              href={alternateHref}
            >
              {alternateLabel}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
};
