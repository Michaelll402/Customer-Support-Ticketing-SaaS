'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useCurrentUser, useLogout } from '@/hooks/use-auth';
import { getApiErrorMessage } from '@/lib/api';
import { canAccessAppPath, getDefaultAppPath } from '@/lib/app-access';
import { getSignInRedirectPath } from '@/lib/auth-routing';
import {
  formatRoleLabel,
  getAppShellItems,
  siteSubtitle,
  siteTitle,
} from '@/lib/site';

interface AppShellProps {
  children: ReactNode;
}

export const AppShell = ({ children }: AppShellProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const currentUserQuery = useCurrentUser();
  const logoutMutation = useLogout();

  useEffect(() => {
    if (currentUserQuery.isLoading || currentUserQuery.isError) {
      return;
    }

    if (!currentUserQuery.data) {
      router.replace(getSignInRedirectPath(pathname));
      return;
    }

    if (!canAccessAppPath(currentUserQuery.data.role, pathname)) {
      router.replace(getDefaultAppPath(currentUserQuery.data.role));
    }
  }, [
    currentUserQuery.data,
    currentUserQuery.isError,
    currentUserQuery.isLoading,
    pathname,
    router,
  ]);

  if (currentUserQuery.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
        <div className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_25px_80px_-45px_rgba(15,23,42,0.35)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
            Session hydration
          </p>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
            Confirming access to the workspace
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Frontend auth in M1 derives the current user from the backend cookie
            via
            <code> /auth/me</code>.
          </p>
        </div>
      </main>
    );
  }

  if (currentUserQuery.isError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
        <div className="w-full max-w-lg rounded-[2rem] border border-amber-200 bg-white p-8 shadow-[0_25px_80px_-45px_rgba(15,23,42,0.35)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
            Auth check failed
          </p>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
            We could not confirm the current session
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {getApiErrorMessage(
              currentUserQuery.error,
              'The API is unavailable or the frontend origin is not allowed by CORS.',
            )}
          </p>
          <button
            className="mt-6 inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            onClick={() => {
              void currentUserQuery.refetch();
            }}
            type="button"
          >
            Retry session check
          </button>
        </div>
      </main>
    );
  }

  if (!currentUserQuery.data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
        <div className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_25px_80px_-45px_rgba(15,23,42,0.35)]">
          <p className="text-sm text-slate-600">Redirecting to sign in…</p>
        </div>
      </main>
    );
  }

  const user = currentUserQuery.data;
  const items = getAppShellItems(user.role);
  const activeItem =
    items.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) ?? null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] text-slate-950">
      <div className="mx-auto grid max-w-[1480px] gap-6 px-4 py-4 lg:grid-cols-[290px_1fr] lg:px-6 lg:py-6">
        <aside className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur lg:sticky lg:top-6 lg:h-fit">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-700">
            Auth shell
          </p>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
            {siteTitle}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {siteSubtitle}
          </p>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Signed in as
            </p>
            <p className="mt-3 text-sm font-semibold text-slate-950">
              {user.firstName} {user.lastName}
            </p>
            <p className="mt-1 text-sm text-slate-600">{user.email}</p>
            <span className="mt-4 inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-800">
              {formatRoleLabel(user.role)}
            </span>
          </div>

          <nav aria-label="Primary" className="mt-6">
            <ul className="grid gap-3">
              {items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

                return (
                  <li key={item.href}>
                    <Link
                      className={`block rounded-3xl border px-4 py-4 no-underline transition ${
                        isActive
                          ? 'border-sky-200 bg-sky-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                      href={item.href}
                    >
                      <span className="block text-sm font-semibold text-slate-950">
                        {item.label}
                      </span>
                      {item.description ? (
                        <span className="mt-2 block text-sm leading-6 text-slate-600">
                          {item.description}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <main className="min-w-0">
          <header className="rounded-[2rem] border border-white/70 bg-white/90 px-6 py-5 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-700">
                  Milestone 2
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                  {activeItem?.label ?? 'Workspace'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {activeItem?.description ??
                    'Authenticated workspace routing remains in place, and the ticket list is now live. Deeper workflow slices remain deferred.'}
                </p>
              </div>

              <button
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={logoutMutation.isPending}
                onClick={async () => {
                  await logoutMutation.mutateAsync();
                  router.replace('/sign-in');
                }}
                type="button"
              >
                {logoutMutation.isPending ? 'Signing out…' : 'Sign out'}
              </button>
            </div>

            {logoutMutation.isError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {getApiErrorMessage(
                  logoutMutation.error,
                  'Unable to sign out.',
                )}
              </div>
            ) : null}
          </header>

          <section className="mt-6">{children}</section>
        </main>
      </div>
    </div>
  );
};
