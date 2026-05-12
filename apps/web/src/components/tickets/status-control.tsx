'use client';

import { useState, type ChangeEvent, type ReactNode } from 'react';

import { useUpdateTicketStatus } from '@/hooks/use-tickets';
import { getApiErrorMessage } from '@/lib/api';
import {
  allowedStaffStatusTransitions,
  ticketStatusLabels,
  type TicketDetailResponse,
  type TicketStatus,
} from '@/lib/tickets';

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

export const StatusControl = ({ ticket }: { ticket: TicketDetailResponse }) => {
  const mutation = useUpdateTicketStatus(ticket.id);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const allowedTargets = allowedStaffStatusTransitions[ticket.status];

  const handleChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const nextStatus = event.target.value as TicketStatus;
    if (nextStatus === ticket.status) return;

    setError(null);
    setSuccess(null);
    try {
      await mutation.mutateAsync({ status: nextStatus });
      setSuccess(`Status set to ${ticketStatusLabels[nextStatus]}.`);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Status update failed.'));
    }
  };

  return (
    <ControlShell
      hint="Move the ticket through the staff status matrix. Customer close/reopen stays on the customer-owned route."
      label="Status"
    >
      <select
        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
        disabled={mutation.isPending}
        onChange={(event) => {
          void handleChange(event);
        }}
        value={ticket.status}
      >
        <option value={ticket.status}>
          {ticketStatusLabels[ticket.status]} (current)
        </option>
        {allowedTargets.map((target) => (
          <option key={target} value={target}>
            Move to {ticketStatusLabels[target]}
          </option>
        ))}
      </select>

      {mutation.isPending ? (
        <p className="mt-2 text-xs text-slate-500">Saving status...</p>
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
