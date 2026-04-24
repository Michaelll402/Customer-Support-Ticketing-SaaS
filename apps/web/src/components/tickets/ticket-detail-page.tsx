'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

import { useTicket } from '@/hooks/use-tickets';
import { ApiClientError, getApiErrorMessage } from '@/lib/api';
import {
  ticketPriorityLabels,
  ticketStatusLabels,
  type TicketDetailResponse,
  type TicketPriority,
  type TicketStatus,
} from '@/lib/tickets';

const statusToneClasses: Record<TicketStatus, string> = {
  CLOSED: 'bg-slate-200 text-slate-700',
  OPEN: 'bg-emerald-100 text-emerald-800',
  PENDING: 'bg-amber-100 text-amber-800',
  RESOLVED: 'bg-sky-100 text-sky-800',
};

const priorityToneClasses: Record<TicketPriority, string> = {
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

const formatPersonName = (person: {
  email: string;
  firstName: string;
  lastName: string;
}) => `${person.firstName} ${person.lastName}`;

const ToneBadge = ({
  children,
  toneClasses,
}: {
  children: ReactNode;
  toneClasses: string;
}) => (
  <span
    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${toneClasses}`}
  >
    {children}
  </span>
);

const MetadataCard = ({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) => (
  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {label}
    </p>
    <div className="mt-3 text-sm leading-6 text-slate-700">{value}</div>
  </div>
);

const LoadingState = () => (
  <div className="grid gap-6">
    <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur">
      <div className="h-3 w-28 animate-pulse rounded-full bg-slate-200" />
      <div className="mt-4 h-10 w-3/4 animate-pulse rounded-2xl bg-slate-200" />
      <div className="mt-5 flex gap-3">
        <div className="h-8 w-24 animate-pulse rounded-full bg-slate-200" />
        <div className="h-8 w-24 animate-pulse rounded-full bg-slate-200" />
      </div>
    </section>

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.28)]"
          key={index}
        >
          <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-4 h-4 w-5/6 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-3 h-4 w-2/3 animate-pulse rounded-full bg-slate-200" />
        </div>
      ))}
    </section>
  </div>
);

const StatePanel = ({
  action,
  description,
  eyebrow,
  title,
  tone,
}: {
  action?: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
  tone: 'amber' | 'rose' | 'slate';
}) => {
  const toneClasses = {
    amber: {
      container: 'border-amber-200 bg-amber-50',
      eyebrow: 'text-amber-700',
      text: 'text-amber-900',
    },
    rose: {
      container: 'border-rose-200 bg-rose-50',
      eyebrow: 'text-rose-700',
      text: 'text-rose-900',
    },
    slate: {
      container: 'border-slate-200 bg-white',
      eyebrow: 'text-slate-500',
      text: 'text-slate-700',
    },
  }[tone];

  return (
    <section
      className={`rounded-[2rem] border px-6 py-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] ${toneClasses.container}`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-[0.28em] ${toneClasses.eyebrow}`}
      >
        {eyebrow}
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
        {title}
      </h1>
      <p className={`mt-3 max-w-2xl text-sm leading-6 ${toneClasses.text}`}>
        {description}
      </p>
      {action ? (
        <div className="mt-6 flex flex-wrap gap-3">{action}</div>
      ) : null}
    </section>
  );
};

const TicketDescription = ({ ticket }: { ticket: TicketDetailResponse }) => (
  <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur">
    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
      Description
    </p>
    <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-5">
      <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
        {ticket.description}
      </p>
    </div>
  </section>
);

const TicketMetadata = ({ ticket }: { ticket: TicketDetailResponse }) => (
  <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur">
    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
      Ticket metadata
    </p>
    <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
      Core record fields
    </h2>
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <MetadataCard
        label="Requester"
        value={
          <>
            <p className="font-semibold text-slate-950">
              {formatPersonName(ticket.requester)}
            </p>
            <p className="text-slate-600">{ticket.requester.email}</p>
          </>
        }
      />

      {ticket.assignee ? (
        <MetadataCard
          label="Assignee"
          value={
            <>
              <p className="font-semibold text-slate-950">
                {formatPersonName(ticket.assignee)}
              </p>
              <p className="text-slate-600">{ticket.assignee.email}</p>
            </>
          }
        />
      ) : null}

      {ticket.team ? (
        <MetadataCard
          label="Team"
          value={
            <>
              <p className="font-semibold text-slate-950">{ticket.team.name}</p>
              {ticket.team.description ? (
                <p className="text-slate-600">{ticket.team.description}</p>
              ) : null}
            </>
          }
        />
      ) : null}

      {ticket.category ? (
        <MetadataCard
          label="Category"
          value={
            <>
              <p className="font-semibold text-slate-950">
                {ticket.category.name}
              </p>
              {ticket.category.description ? (
                <p className="text-slate-600">{ticket.category.description}</p>
              ) : null}
            </>
          }
        />
      ) : null}

      {ticket.tags.length > 0 ? (
        <MetadataCard
          label="Tags"
          value={
            <div className="flex flex-wrap gap-2">
              {ticket.tags.map((tag) => (
                <span
                  className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700"
                  key={tag.id}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          }
        />
      ) : null}

      <MetadataCard
        label="Created"
        value={
          <p className="font-semibold text-slate-950">
            {formatDateTime(ticket.createdAt)}
          </p>
        }
      />

      <MetadataCard
        label="Updated"
        value={
          <p className="font-semibold text-slate-950">
            {formatDateTime(ticket.updatedAt)}
          </p>
        }
      />

      {ticket.firstResponseDueAt ? (
        <MetadataCard
          label="First response due"
          value={
            <p className="font-semibold text-slate-950">
              {formatDateTime(ticket.firstResponseDueAt)}
            </p>
          }
        />
      ) : null}

      {ticket.resolutionDueAt ? (
        <MetadataCard
          label="Resolution due"
          value={
            <p className="font-semibold text-slate-950">
              {formatDateTime(ticket.resolutionDueAt)}
            </p>
          }
        />
      ) : null}
    </div>
  </section>
);

export const TicketDetailPage = ({ ticketId }: { ticketId: string }) => {
  const ticketQuery = useTicket(ticketId);

  if (ticketQuery.isLoading) {
    return <LoadingState />;
  }

  if (ticketQuery.isError) {
    const statusCode =
      ticketQuery.error instanceof ApiClientError
        ? ticketQuery.error.statusCode
        : null;

    if (statusCode === 403) {
      return (
        <StatePanel
          action={
            <Link
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              href="/tickets"
            >
              Back to tickets
            </Link>
          }
          description="The signed-in user does not have visibility for this ticket detail route. Milestone 2 keeps access aligned to backend ticket visibility rules."
          eyebrow="Access denied"
          title="You cannot open this ticket"
          tone="amber"
        />
      );
    }

    if (statusCode === 404) {
      return (
        <StatePanel
          action={
            <Link
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              href="/tickets"
            >
              Back to tickets
            </Link>
          }
          description="No ticket was found for this route. The record may not exist, or the URL may be outdated."
          eyebrow="Ticket not found"
          title="This ticket does not exist"
          tone="slate"
        />
      );
    }

    return (
      <StatePanel
        action={
          <>
            <button
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              onClick={() => {
                void ticketQuery.refetch();
              }}
              type="button"
            >
              Retry
            </button>
            <Link
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              href="/tickets"
            >
              Back to tickets
            </Link>
          </>
        }
        description={getApiErrorMessage(
          ticketQuery.error,
          'The ticket detail could not be loaded.',
        )}
        eyebrow="Ticket detail unavailable"
        title="The detail view could not be loaded"
        tone="rose"
      />
    );
  }

  const ticket = ticketQuery.data;

  if (!ticket) {
    return null;
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-700">
              Ticket detail
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              {ticket.subject}
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              FE-02 slice C renders the live backend ticket record as
              metadata-only detail. Replies, notes, attachments, and workflow
              controls remain deferred.
            </p>
          </div>

          <Link
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            href="/tickets"
          >
            Back to tickets
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Ticket #{ticket.number}
          </span>
          <ToneBadge toneClasses={statusToneClasses[ticket.status]}>
            {ticketStatusLabels[ticket.status]}
          </ToneBadge>
          <ToneBadge toneClasses={priorityToneClasses[ticket.priority]}>
            {ticketPriorityLabels[ticket.priority]}
          </ToneBadge>
          {ticketQuery.isFetching ? (
            <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">
              Refreshing
            </span>
          ) : null}
        </div>
      </section>

      <TicketDescription ticket={ticket} />
      <TicketMetadata ticket={ticket} />

      <section className="rounded-[2rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.2)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Milestone 3 placeholder
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
          Conversation, notes, and attachments land later
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          This section is intentionally a placeholder. FE-02 slice C stops at
          metadata-only ticket detail and does not add reply UI, internal notes,
          attachments, timeline history, realtime updates, or workflow controls.
        </p>
      </section>
    </div>
  );
};
