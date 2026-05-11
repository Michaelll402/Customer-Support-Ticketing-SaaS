'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  startTransition,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useCurrentUser } from '@/hooks/use-auth';
import { useTickets } from '@/hooks/use-tickets';
import { getApiErrorMessage } from '@/lib/api';
import {
  buildTicketListSearchParams,
  defaultTicketListQuery,
  parseTicketListSearchParams,
  queryToFilterDraft,
  ticketFilterDraftSchema,
  ticketPriorityLabels,
  ticketStatusLabels,
  type TicketFilterDraft,
  type TicketListItem,
  type TicketListQuery,
} from '@/lib/tickets';

type FilterErrorState = Partial<Record<keyof TicketFilterDraft, string>>;

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

const FilterInput = ({
  error,
  hint,
  label,
  onChange,
  value,
}: {
  error?: string;
  hint: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) => (
  <label className="grid gap-2">
    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
      {label}
    </span>
    <input
      className={`rounded-2xl border px-4 py-3 text-sm text-slate-900 outline-none transition ${
        error
          ? 'border-rose-300 bg-rose-50 focus:border-rose-400'
          : 'border-slate-200 bg-white focus:border-sky-300'
      }`}
      onChange={(event) => onChange(event.target.value)}
      placeholder={hint}
      type="text"
      value={value}
    />
    <span
      className={error ? 'text-xs text-rose-600' : 'text-xs text-slate-500'}
    >
      {error ?? hint}
    </span>
  </label>
);

const TicketStatusBadge = ({
  status,
}: {
  status: TicketListItem['status'];
}) => (
  <span
    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
      statusToneClasses[status]
    }`}
  >
    {ticketStatusLabels[status]}
  </span>
);

const TicketPriorityBadge = ({
  priority,
}: {
  priority: TicketListItem['priority'];
}) => (
  <span
    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
      priorityToneClasses[priority]
    }`}
  >
    {ticketPriorityLabels[priority]}
  </span>
);

const TicketRowCards = ({ items }: { items: TicketListItem[] }) => (
  <div className="grid gap-4 lg:hidden">
    {items.map((ticket) => (
      <article
        className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.45)]"
        key={ticket.id}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Ticket #{ticket.number}
          </span>
          <TicketStatusBadge status={ticket.status} />
          <TicketPriorityBadge priority={ticket.priority} />
        </div>
        <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-950">
          <Link
            className="transition hover:text-sky-700"
            href={`/tickets/${ticket.id}`}
          >
            {ticket.subject}
          </Link>
        </h3>
        <dl className="mt-4 grid gap-3 text-sm text-slate-600">
          <div className="flex items-center justify-between gap-3">
            <dt className="font-medium text-slate-500">Assignee</dt>
            <dd className="text-right text-slate-700">
              {ticket.assignee
                ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}`
                : 'Unassigned'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="font-medium text-slate-500">Team</dt>
            <dd className="text-right text-slate-700">
              {ticket.team?.name ?? 'No team'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="font-medium text-slate-500">Category</dt>
            <dd className="text-right text-slate-700">
              {ticket.category?.name ?? 'Uncategorized'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="font-medium text-slate-500">Created</dt>
            <dd className="text-right text-slate-700">
              {formatDateTime(ticket.createdAt)}
            </dd>
          </div>
        </dl>
        <Link
          className="mt-5 inline-flex text-sm font-semibold text-sky-700 transition hover:text-sky-800"
          href={`/tickets/${ticket.id}`}
        >
          Open ticket detail
        </Link>
      </article>
    ))}
  </div>
);

const LoadingState = () => (
  <div className="mt-6 grid gap-4">
    {Array.from({ length: 4 }).map((_, index) => (
      <div
        className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5"
        key={index}
      >
        <div className="h-3 w-28 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-4 h-5 w-3/4 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-5 h-3 w-full animate-pulse rounded-full bg-slate-200" />
        <div className="mt-3 h-3 w-5/6 animate-pulse rounded-full bg-slate-200" />
      </div>
    ))}
  </div>
);

export const TicketListPage = () => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentUserQuery = useCurrentUser();

  const searchParamsString = searchParams.toString();
  const currentQuery = useMemo(
    () => parseTicketListSearchParams(new URLSearchParams(searchParamsString)),
    [searchParamsString],
  );
  const createdTicketNumber = useMemo(() => {
    const value = searchParams.get('created');

    if (!value) {
      return null;
    }

    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);
  const ticketsQuery = useTickets(currentQuery);
  const ticketListData = ticketsQuery.data;

  const [filterDraft, setFilterDraft] = useState<TicketFilterDraft>(() =>
    queryToFilterDraft(currentQuery),
  );
  const [filterErrors, setFilterErrors] = useState<FilterErrorState>({});

  useEffect(() => {
    setFilterDraft(queryToFilterDraft(currentQuery));
    setFilterErrors({});
  }, [currentQuery]);

  const updateUrlQuery = (nextQuery: TicketListQuery) => {
    const params = buildTicketListSearchParams(nextQuery);
    const nextUrl = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname;

    startTransition(() => {
      router.replace(nextUrl, { scroll: false });
    });
  };

  const applyFilters = () => {
    const result = ticketFilterDraftSchema.safeParse(filterDraft);

    if (!result.success) {
      const nextErrors: FilterErrorState = {};

      for (const issue of result.error.issues) {
        const field = issue.path[0];

        if (typeof field === 'string') {
          nextErrors[field as keyof TicketFilterDraft] = issue.message;
        }
      }

      setFilterErrors(nextErrors);
      return;
    }

    setFilterErrors({});

    updateUrlQuery({
      ...currentQuery,
      page: defaultTicketListQuery.page,
      status: result.data.status || undefined,
      priority: result.data.priority || undefined,
      assigneeId: result.data.assigneeId.trim() || undefined,
      teamId: result.data.teamId.trim() || undefined,
      categoryId: result.data.categoryId.trim() || undefined,
    });
  };

  const resetFilters = () => {
    setFilterDraft({
      status: '',
      priority: '',
      assigneeId: '',
      teamId: '',
      categoryId: '',
    });
    setFilterErrors({});

    updateUrlQuery({
      ...currentQuery,
      page: defaultTicketListQuery.page,
      status: undefined,
      priority: undefined,
      assigneeId: undefined,
      teamId: undefined,
      categoryId: undefined,
    });
  };

  const roleLabel = currentUserQuery.data
    ? currentUserQuery.data.role === 'CUSTOMER'
      ? 'My visible tickets'
      : 'Visible queue'
    : 'Visible tickets';

  let ticketResults: ReactNode;

  if (ticketsQuery.isLoading) {
    ticketResults = <LoadingState />;
  } else if (ticketsQuery.isError) {
    ticketResults = (
      <div className="mt-6 rounded-[1.75rem] border border-rose-200 bg-rose-50 px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-700">
          Ticket list unavailable
        </p>
        <p className="mt-3 text-sm leading-6 text-rose-800">
          {getApiErrorMessage(
            ticketsQuery.error,
            'The ticket list could not be loaded.',
          )}
        </p>
        <button
          className="mt-5 inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          onClick={() => {
            void ticketsQuery.refetch();
          }}
          type="button"
        >
          Retry
        </button>
      </div>
    );
  } else if (!ticketListData || ticketListData.items.length === 0) {
    ticketResults = (
      <div className="mt-6 rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          No visible tickets
        </p>
        <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
          Nothing matched the current list scope
        </h3>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Adjust filters or reset the query. Ticket detail is now reachable from
          this list, while conversation and workflow surfaces remain deferred.
        </p>
      </div>
    );
  } else {
    ticketResults = (
      <>
        <div className="mt-6 hidden overflow-hidden rounded-[1.75rem] border border-slate-200 lg:block">
          <table className="min-w-full border-collapse bg-white">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-5 py-4">Number</th>
                <th className="px-5 py-4">Subject</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Priority</th>
                <th className="px-5 py-4">Assignee</th>
                <th className="px-5 py-4">Team</th>
                <th className="px-5 py-4">Created</th>
              </tr>
            </thead>
            <tbody>
              {ticketListData.items.map((ticket) => (
                <tr
                  className="border-t border-slate-200 align-top text-sm text-slate-700"
                  key={ticket.id}
                >
                  <td className="px-5 py-4 font-semibold text-slate-950">
                    #{ticket.number}
                  </td>
                  <td className="px-5 py-4">
                    <div className="max-w-[28rem]">
                      <Link
                        className="font-semibold text-slate-950 transition hover:text-sky-700"
                        href={`/tickets/${ticket.id}`}
                      >
                        {ticket.subject}
                      </Link>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                        {ticket.category?.name ?? 'Uncategorized'}
                      </p>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <TicketStatusBadge status={ticket.status} />
                  </td>
                  <td className="px-5 py-4">
                    <TicketPriorityBadge priority={ticket.priority} />
                  </td>
                  <td className="px-5 py-4">
                    {ticket.assignee
                      ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}`
                      : 'Unassigned'}
                  </td>
                  <td className="px-5 py-4">
                    {ticket.team?.name ?? 'No team'}
                  </td>
                  <td className="px-5 py-4">
                    {formatDateTime(ticket.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6">
          <TicketRowCards items={ticketListData.items} />
        </div>
      </>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-700">
              Ticket core
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Ticket list
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              The ticket list stays backend-driven for visibility, filters,
              sorting, and pagination.
            </p>
          </div>

          <div className="grid gap-3">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Current scope
              </p>
              <p className="mt-3 text-sm font-semibold text-slate-950">
                {roleLabel}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Visibility comes directly from the backend. This page does not
                do client-side role filtering.
              </p>
            </div>

            {currentUserQuery.data?.role === 'CUSTOMER' ? (
              <Link
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                href="/tickets/new"
              >
                Create ticket
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {createdTicketNumber ? (
        <section className="rounded-[2rem] border border-emerald-200 bg-emerald-50 px-6 py-5 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.2)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
            Ticket created
          </p>
          <p className="mt-3 text-sm leading-6 text-emerald-900">
            Ticket #{createdTicketNumber} was created successfully. Open it from
            the list below to review the metadata detail view.
          </p>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Status
              </span>
              <select
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300"
                onChange={(event) => {
                  setFilterDraft((current) => ({
                    ...current,
                    status: event.target.value as TicketFilterDraft['status'],
                  }));
                }}
                value={filterDraft.status}
              >
                <option value="">All statuses</option>
                <option value="OPEN">Open</option>
                <option value="PENDING">Pending</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Priority
              </span>
              <select
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300"
                onChange={(event) => {
                  setFilterDraft((current) => ({
                    ...current,
                    priority: event.target
                      .value as TicketFilterDraft['priority'],
                  }));
                }}
                value={filterDraft.priority}
              >
                <option value="">All priorities</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </label>

            <FilterInput
              error={filterErrors.assigneeId}
              hint="Exact assignee UUID"
              label="Assignee ID"
              onChange={(value) => {
                setFilterDraft((current) => ({
                  ...current,
                  assigneeId: value,
                }));
              }}
              value={filterDraft.assigneeId}
            />

            <FilterInput
              error={filterErrors.teamId}
              hint="Exact team UUID"
              label="Team ID"
              onChange={(value) => {
                setFilterDraft((current) => ({
                  ...current,
                  teamId: value,
                }));
              }}
              value={filterDraft.teamId}
            />

            <FilterInput
              error={filterErrors.categoryId}
              hint="Exact category UUID"
              label="Category ID"
              onChange={(value) => {
                setFilterDraft((current) => ({
                  ...current,
                  categoryId: value,
                }));
              }}
              value={filterDraft.categoryId}
            />
          </div>

          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Sort by
              </span>
              <select
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300"
                onChange={(event) => {
                  updateUrlQuery({
                    ...currentQuery,
                    page: defaultTicketListQuery.page,
                    sortBy: event.target.value as TicketListQuery['sortBy'],
                  });
                }}
                value={currentQuery.sortBy}
              >
                <option value="createdAt">Created date</option>
                <option value="updatedAt">Updated date</option>
                <option value="priority">Priority</option>
                <option value="number">Ticket number</option>
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Sort order
              </span>
              <select
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300"
                onChange={(event) => {
                  updateUrlQuery({
                    ...currentQuery,
                    page: defaultTicketListQuery.page,
                    sortOrder: event.target
                      .value as TicketListQuery['sortOrder'],
                  });
                }}
                value={currentQuery.sortOrder}
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Page size
              </span>
              <select
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300"
                onChange={(event) => {
                  updateUrlQuery({
                    ...currentQuery,
                    page: defaultTicketListQuery.page,
                    limit: Number(event.target.value),
                  });
                }}
                value={String(currentQuery.limit)}
              >
                <option value="10">10 per page</option>
                <option value="20">20 per page</option>
                <option value="50">50 per page</option>
              </select>
            </label>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                onClick={applyFilters}
                type="button"
              >
                Apply filters
              </button>
              <button
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                onClick={resetFilters}
                type="button"
              >
                Reset filters
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Result set
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
              {ticketListData?.meta.totalItems ?? 0} visible tickets
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Backend pagination and visibility rules control the result set.
              Ticket detail is live from the list, while conversation and
              workflow surfaces remain deferred.
            </p>
          </div>

          {ticketsQuery.isFetching ? (
            <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">
              Refreshing
            </span>
          ) : null}
        </div>

        {ticketResults}

        {ticketListData ? (
          <div className="mt-6 flex flex-col gap-4 rounded-[1.75rem] border border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              Page {ticketListData.meta.page} of{' '}
              {Math.max(ticketListData.meta.totalPages, 1)} · Showing{' '}
              {ticketListData.items.length} items
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!ticketListData.meta.hasPreviousPage}
                onClick={() => {
                  if (!ticketListData.meta.hasPreviousPage) {
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
                disabled={!ticketListData.meta.hasNextPage}
                onClick={() => {
                  if (!ticketListData.meta.hasNextPage) {
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
