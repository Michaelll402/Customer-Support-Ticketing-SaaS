'use client';

import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';

import { useTicketTeams, useTransferTicketTeam } from '@/hooks/use-tickets';
import { getApiErrorMessage } from '@/lib/api';
import type { TicketDetailResponse } from '@/lib/tickets';

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

export const TeamTransferControl = ({
  ticket,
}: {
  ticket: TicketDetailResponse;
}) => {
  const teamsQuery = useTicketTeams();
  const mutation = useTransferTicketTeam(ticket.id);
  const [stagedTeamId, setStagedTeamId] = useState<string>(
    ticket.team?.id ?? '',
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setStagedTeamId(ticket.team?.id ?? '');
    setError(null);
    setSuccess(null);
  }, [ticket.team?.id]);

  const teamOptions = teamsQuery.data ?? [];
  const stagedTeam = teamOptions.find((team) => team.id === stagedTeamId);
  const isDirty = stagedTeamId !== '' && stagedTeamId !== ticket.team?.id;
  const teamsListError =
    teamsQuery.isError &&
    getApiErrorMessage(teamsQuery.error, 'Team options could not be loaded.');

  const handleSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    setStagedTeamId(event.target.value);
    setError(null);
    setSuccess(null);
  };

  const handleTransfer = async () => {
    if (!isDirty) return;

    setError(null);
    setSuccess(null);
    try {
      await mutation.mutateAsync({ teamId: stagedTeamId });
      setSuccess(
        stagedTeam
          ? `Ticket transferred to ${stagedTeam.name}.`
          : 'Team transferred.',
      );
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Team transfer failed.'));
    }
  };

  const currentTeamLabel = ticket.team?.name ?? 'No current team';

  return (
    <ControlShell
      hint="Team transfer may clear the assignee server-side if they do not belong to the destination team."
      label="Team transfer"
    >
      <p className="mb-3 text-xs text-slate-500">
        Currently on:{' '}
        <span className="font-semibold text-slate-700">{currentTeamLabel}</span>
      </p>

      <select
        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
        disabled={mutation.isPending || teamsQuery.isLoading}
        onChange={handleSelect}
        value={stagedTeamId}
      >
        <option value="">Select a destination team</option>
        {teamOptions.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
            {team.id === ticket.team?.id ? ' (current)' : ''}
          </option>
        ))}
      </select>

      {teamsQuery.isLoading ? (
        <p className="mt-2 text-xs text-slate-500">Loading team options...</p>
      ) : null}

      {teamsListError ? (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {teamsListError}
        </p>
      ) : null}

      <div className="mt-3">
        <button
          className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!isDirty || mutation.isPending}
          onClick={() => {
            void handleTransfer();
          }}
          type="button"
        >
          {mutation.isPending
            ? 'Transferring...'
            : stagedTeam
              ? `Transfer to ${stagedTeam.name}`
              : 'Transfer team'}
        </button>
      </div>

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
