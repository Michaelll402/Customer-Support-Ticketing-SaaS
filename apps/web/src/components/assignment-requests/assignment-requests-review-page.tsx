'use client';

import Link from 'next/link';
import { useState } from 'react';

import { useCurrentUser } from '@/hooks/use-auth';
import {
  useApproveAssignmentRequest,
  useRejectAssignmentRequest,
  useReviewAssignmentRequests,
} from '@/hooks/use-assignment-requests';
import { getApiErrorMessage } from '@/lib/api';
import {
  assignmentRequestTypeLabels,
  type AssignmentRequest,
} from '@/lib/assignment-requests';

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

const personName = (person: { firstName: string; lastName: string }) =>
  `${person.firstName} ${person.lastName}`;

const ReviewCard = ({ request }: { request: AssignmentRequest }) => {
  const approveMutation = useApproveAssignmentRequest();
  const rejectMutation = useRejectAssignmentRequest();
  const [mode, setMode] = useState<'idle' | 'approve' | 'reject'>('idle');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const destination =
    request.type === 'REASSIGN_USER' && request.requestedAssignee
      ? `Assign to ${personName(request.requestedAssignee)}`
      : assignmentRequestTypeLabels[request.type];

  const submitApprove = async () => {
    setError(null);
    try {
      await approveMutation.mutateAsync({
        requestId: request.id,
        reviewNote: note.trim() ? note.trim() : undefined,
      });
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'The request could not be approved.'));
    }
  };

  const submitReject = async () => {
    setError(null);
    try {
      await rejectMutation.mutateAsync({
        requestId: request.id,
        reviewNote: note.trim(),
      });
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'The request could not be declined.'));
    }
  };

  const pending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.45)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            className="text-sm font-semibold text-slate-950 transition hover:text-sky-700"
            href={`/tickets/${request.ticketId}`}
          >
            Ticket #{request.ticket.number} · {request.ticket.subject}
          </Link>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-amber-700">
            {destination}
          </p>
        </div>
        <span className="text-xs text-slate-500">
          {formatDateTime(request.createdAt)}
        </span>
      </div>

      <dl className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="font-medium text-slate-500">Requested by</dt>
          <dd>{personName(request.requestedBy)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium text-slate-500">Current assignee</dt>
          <dd>
            {request.ticket.currentAssignee
              ? personName(request.ticket.currentAssignee)
              : 'Unassigned'}
          </dd>
        </div>
      </dl>

      <p className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
        “{request.reason}”
      </p>

      {mode === 'idle' ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            onClick={() => {
              setNote('');
              setError(null);
              setMode('approve');
            }}
            type="button"
          >
            Approve
          </button>
          <button
            className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
            onClick={() => {
              setNote('');
              setError(null);
              setMode('reject');
            }}
            type="button"
          >
            Decline
          </button>
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {mode === 'approve'
                ? 'Approval note (optional)'
                : 'Reason for declining (required)'}
            </span>
            <textarea
              className="min-h-20 w-full resize-y rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              maxLength={1000}
              onChange={(event) => setNote(event.target.value)}
              value={note}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={
                pending || (mode === 'reject' && note.trim().length < 5)
              }
              onClick={() => {
                void (mode === 'approve' ? submitApprove() : submitReject());
              }}
              type="button"
            >
              {pending
                ? 'Saving…'
                : mode === 'approve'
                  ? 'Confirm approval'
                  : 'Confirm decline'}
            </button>
            <button
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              disabled={pending}
              onClick={() => setMode('idle')}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error ? (
        <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
    </article>
  );
};

export const AssignmentRequestsReviewPage = () => {
  const currentUserQuery = useCurrentUser();
  const role = currentUserQuery.data?.role ?? null;
  const isReviewer = role === 'MANAGER' || role === 'ADMIN';

  const requestsQuery = useReviewAssignmentRequests('PENDING', isReviewer);
  const requests = requestsQuery.data ?? [];

  if (currentUserQuery.isLoading) {
    return (
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">Loading…</p>
      </div>
    );
  }

  if (!isReviewer) {
    return (
      <section className="rounded-[2rem] border border-amber-200 bg-amber-50 px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
          Access denied
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
          Assignment requests are reviewed by managers and admins
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-amber-900">
          Reassignment requests are an internal staffing workflow. Only managers
          and admins can review them.
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
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-700">
          Staffing workflow
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Assignment requests
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Approve to apply the reassignment (or return the ticket to its team
          queue); decline to keep the current assignee. Managers see requests
          for their teams; admins see all. Single-assignee behavior is
          unchanged.
        </p>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            {requests.length} pending
          </h2>
          {requestsQuery.isFetching ? (
            <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">
              Refreshing
            </span>
          ) : null}
        </div>

        {requestsQuery.isError ? (
          <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {getApiErrorMessage(
              requestsQuery.error,
              'The review queue could not be loaded.',
            )}
          </p>
        ) : requests.length === 0 ? (
          <div className="mt-6 rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
            <h3 className="text-xl font-semibold tracking-tight text-slate-950">
              No pending requests
            </h3>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Reassignment requests submitted by agents on your teams appear
              here for review.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {requests.map((request) => (
              <ReviewCard key={request.id} request={request} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
