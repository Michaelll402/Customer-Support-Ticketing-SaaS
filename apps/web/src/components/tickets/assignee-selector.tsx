'use client';

import { useState, type ChangeEvent, type ReactNode } from 'react';

import { useAssignTicket, useAssignableUsers } from '@/hooks/use-tickets';
import { getApiErrorMessage } from '@/lib/api';
import { userRoleLabels, type TicketDetailResponse } from '@/lib/tickets';

const ControlShell = ({
  hint,
  label,
  children,
}: {
  hint?: string;
  label: string;
  children: ReactNode;
}) => (
  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {label}
    </p>
    {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    <div className="mt-3">{children}</div>
  </div>
);

const UNASSIGNED_VALUE = '__unassigned__';

export const AssigneeSelector = ({
  ticket,
}: {
  ticket: TicketDetailResponse;
}) => {
  const usersQuery = useAssignableUsers(ticket.id);
  const mutation = useAssignTicket(ticket.id);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const raw = event.target.value;
    const nextAssigneeId = raw === UNASSIGNED_VALUE ? null : raw;
    if (nextAssigneeId === (ticket.assignee?.id ?? null)) return;

    setError(null);
    setSuccess(null);
    try {
      await mutation.mutateAsync({ assigneeId: nextAssigneeId });
      setSuccess(
        nextAssigneeId === null ? 'Ticket unassigned.' : 'Assignee updated.',
      );
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Assignee update failed.'));
    }
  };

  const currentValue = ticket.assignee?.id ?? UNASSIGNED_VALUE;
  const candidates = usersQuery.data ?? [];
  const usersListError =
    usersQuery.isError &&
    getApiErrorMessage(
      usersQuery.error,
      'Assignable users could not be loaded.',
    );

  return (
    <ControlShell
      hint="Assignable users are scoped server-side to the ticket team for non-admin actors."
      label="Assignee"
    >
      <select
        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
        disabled={mutation.isPending || usersQuery.isLoading}
        onChange={(event) => {
          void handleChange(event);
        }}
        value={currentValue}
      >
        <option value={UNASSIGNED_VALUE}>
          Unassigned{ticket.assignee ? '' : ' (current)'}
        </option>
        {ticket.assignee &&
        !candidates.some((user) => user.id === ticket.assignee?.id) ? (
          <option value={ticket.assignee.id}>
            {ticket.assignee.firstName} {ticket.assignee.lastName} -{' '}
            {ticket.assignee.email} (current)
          </option>
        ) : null}
        {candidates.map((user) => (
          <option key={user.id} value={user.id}>
            {user.firstName} {user.lastName} - {userRoleLabels[user.role]} -{' '}
            {user.email}
            {user.id === ticket.assignee?.id ? ' (current)' : ''}
          </option>
        ))}
      </select>

      {usersQuery.isLoading ? (
        <p className="mt-2 text-xs text-slate-500">
          Loading assignable users...
        </p>
      ) : null}

      {usersListError ? (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {usersListError}
        </p>
      ) : null}

      {mutation.isPending ? (
        <p className="mt-2 text-xs text-slate-500">Saving assignee...</p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {success}
        </p>
      ) : null}
    </ControlShell>
  );
};
