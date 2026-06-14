'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { startTransition, useMemo, useState, type ReactNode } from 'react';

import { useCurrentUser } from '@/hooks/use-auth';
import { useRestoreTicket, useTrashedTickets } from '@/hooks/use-tickets';
import { getApiErrorMessage } from '@/lib/api';
import {
  buildTicketListSearchParams,
  parseTicketListSearchParams,
  ticketPriorityLabels,
  ticketStatusLabels,
  type TicketListItem,
  type TicketListQuery,
} from '@/lib/tickets';

const statusToneClasses: Record<string, string> = {
  CLOSED: 'bg-slate-200 text-slate-700',
  OPEN: 'bg-emerald-100 text-emerald-800',
  PENDING: 'bg-amber-100 text-amber-800',
  RESOLVED: 'bg-sky-100 text-sky-800',
};

const priorityToneClasses: Record<string, string> = {
  HIGH: 'bg-orange-100 text-orange-800',
  LOW: 'bg-slate-200 text-slate-700',
  MEDIUM: 'bg-indigo-100 text-indigo-800',
  URGENT: 'bg-rose-100 text-rose-800',
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

const StatusBadge = ({ status }: { status: TicketListItem['status'] }) => (
  <span
    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusToneClasses[status]}`}
  >
    {ticketStatusLabels[status]}
  </span>
);

const PriorityBadge = ({
  priority,
}: {
  priority: TicketListItem['priority'];
}) => (
  <span
    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${priorityToneClasses[priority]}`}
  >
    {ticketPriorityLabels[priority]}
  </span>
);

const RestoreButton = ({ ticketId }: { ticketId: string }) => {
  const restoreMutation = useRestoreTicket(ticketId);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRestore = async () => {
    setErrorMessage(null);

    try {
      await restoreMutation.mutateAsync();
      // On success the trash list is invalidated and the row disappears.
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'The ticket could not be restored.'),
      );
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={restoreMutation.isPending}
        onClick={() => {
          void handleRestore();
        }}
        type="button"
      >
        {restoreMutation.isPending ? 'Restoring…' : 'Restore'}
      </button>
      {errorMessage ? (
        <p className="text-xs text-rose-700">{errorMessage}</p>
      ) : null}
    </div>
  );
};

const LoadingState = () => (
  <div className="mt-6 grid gap-4">
    {Array.from({ length: 3 }).map((_, index) => (
      <div
        className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5"
        key={index}
      >
        <div className="h-3 w-28 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-4 h-5 w-3/4 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-5 h-3 w-full animate-pulse rounded-full bg-slate-200" />
      </div>
    ))}
  </div>
);

const AccessDenied = () => (
  <section className="rounded-[2rem] border border-amber-200 bg-amber-50 px-6 py-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)]">
    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
      Access denied
    </p>
    <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
      The ticket trash is admin-only
    </h1>
    <p className="mt-3 max-w-2xl text-sm leading-6 text-amber-900">
      Only administrators can review or restore soft-deleted tickets. Ticket
      trash access is enforced by the backend.
    </p>
    <div className="mt-6">
      <Link
        className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        href="/tickets"
      >
        Back to tickets
      </Link>
    </div>
  </section>
);

export const TrashTicketsPage = () => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentUserQuery = useCurrentUser();

  const isAdmin = currentUserQuery.data?.role === 'ADMIN';

  const searchParamsString = searchParams.toString();
  const currentQuery = useMemo(
    () => parseTicketListSearchParams(new URLSearchParams(searchParamsString)),
    [searchParamsString],
  );

  const trashedQuery = useTrashedTickets(currentQuery, isAdmin);
  const trashedData = trashedQuery.data;

  const updateUrlQuery = (nextQuery: TicketListQuery) => {
    const params = buildTicketListSearchParams(nextQuery);
    const nextUrl = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname;

    startTransition(() => {
      router.replace(nextUrl, { scroll: false });
    });
  };

  if (currentUserQuery.isLoading) {
    return <LoadingState />;
  }

  if (!isAdmin) {
    return <AccessDenied />;
  }

  let results: ReactNode;

  if (trashedQuery.isLoading) {
    results = <LoadingState />;
  } else if (trashedQuery.isError) {
    results = (
      <div className="mt-6 rounded-[1.75rem] border border-rose-200 bg-rose-50 px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-700">
          Trash unavailable
        </p>
        <p className="mt-3 text-sm leading-6 text-rose-800">
          {getApiErrorMessage(
            trashedQuery.error,
            'The trash list could not be loaded.',
          )}
        </p>
        <button
          className="mt-5 inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          onClick={() => {
            void trashedQuery.refetch();
          }}
          type="button"
        >
          Retry
        </button>
      </div>
    );
  } else if (!trashedData || trashedData.items.length === 0) {
    results = (
      <div className="mt-6 rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Trash is empty
        </p>
        <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
          No tickets are in the trash
        </h3>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Soft-deleted tickets appear here. Restore one to return it to the
          active queue with its full conversation, workflow, and SLA history.
        </p>
      </div>
    );
  } else {
    results = (
      <>
        <div className="mt-6 hidden overflow-hidden rounded-[1.75rem] border border-slate-200 lg:block">
          <table className="min-w-full border-collapse bg-white">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-5 py-4">Number</th>
                <th className="px-5 py-4">Subject</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Priority</th>
                <th className="px-5 py-4">Trashed</th>
                <th className="px-5 py-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {trashedData.items.map((ticket) => (
                <tr
                  className="border-t border-slate-200 align-top text-sm text-slate-700"
                  key={ticket.id}
                >
                  <td className="px-5 py-4 font-semibold text-slate-950">
                    #{ticket.number}
                  </td>
                  <td className="px-5 py-4">
                    <div className="max-w-[26rem] font-semibold text-slate-950">
                      {ticket.subject}
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                      {ticket.category?.name ?? 'Uncategorized'}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={ticket.status} />
                  </td>
                  <td className="px-5 py-4">
                    <PriorityBadge priority={ticket.priority} />
                  </td>
                  <td className="px-5 py-4">
                    {ticket.deletedAt
                      ? formatDateTime(ticket.deletedAt)
                      : 'Unknown'}
                  </td>
                  <td className="px-5 py-4">
                    <RestoreButton ticketId={ticket.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-4 lg:hidden">
          {trashedData.items.map((ticket) => (
            <article
              className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.45)]"
              key={ticket.id}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Ticket #{ticket.number}
                </span>
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-950">
                {ticket.subject}
              </h3>
              <p className="mt-3 text-sm text-slate-600">
                Trashed{' '}
                {ticket.deletedAt
                  ? formatDateTime(ticket.deletedAt)
                  : 'Unknown'}
              </p>
              <div className="mt-5">
                <RestoreButton ticketId={ticket.id} />
              </div>
            </article>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-rose-700">
              Admin trash
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Trashed tickets
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Soft-deleted tickets are hidden from every active queue and from
              customer, agent, and manager access. Restore returns a ticket to
              the queue with its full history intact. Nothing here is
              permanently deleted.
            </p>
          </div>

          <Link
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            href="/tickets"
          >
            Back to tickets
          </Link>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Result set
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
              {trashedData?.meta.totalItems ?? 0} trashed tickets
            </h2>
          </div>

          {trashedQuery.isFetching ? (
            <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">
              Refreshing
            </span>
          ) : null}
        </div>

        {results}

        {trashedData && trashedData.items.length > 0 ? (
          <div className="mt-6 flex flex-col gap-4 rounded-[1.75rem] border border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              Page {trashedData.meta.page} of{' '}
              {Math.max(trashedData.meta.totalPages, 1)} · Showing{' '}
              {trashedData.items.length} items
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!trashedData.meta.hasPreviousPage}
                onClick={() => {
                  if (!trashedData.meta.hasPreviousPage) {
                    return;
                  }

                  updateUrlQuery({
                    ...currentQuery,
                    page: currentQuery.page - 1,
                  });
                }}
                type="button"
              >
                Previous
              </button>

              <button
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!trashedData.meta.hasNextPage}
                onClick={() => {
                  if (!trashedData.meta.hasNextPage) {
                    return;
                  }

                  updateUrlQuery({
                    ...currentQuery,
                    page: currentQuery.page + 1,
                  });
                }}
                type="button"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
};
