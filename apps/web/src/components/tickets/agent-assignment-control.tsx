'use client';

import { useState, type ReactNode } from 'react';

import { useCurrentUser } from '@/hooks/use-auth';
import {
  useCancelAssignmentRequest,
  useTicketAssignmentRequests,
} from '@/hooks/use-assignment-requests';
import { useAssignTicket } from '@/hooks/use-tickets';
import { getApiErrorMessage } from '@/lib/api';
import {
  assignmentRequestTypeLabels,
  type AssignmentRequest,
} from '@/lib/assignment-requests';
import type { TicketDetailResponse } from '@/lib/tickets';

import { AssignmentRequestDialog } from './assignment-request-dialog';

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

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

const PendingBanner = ({
  request,
  canCancel,
  onCancel,
  cancelling,
}: {
  request: AssignmentRequest;
  canCancel: boolean;
  onCancel: () => void;
  cancelling: boolean;
}) => (
  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
      Pending reassignment request
    </p>
    <p className="mt-2 text-sm text-amber-900">
      {request.type === 'REASSIGN_USER' && request.requestedAssignee
        ? `Requested: assign to ${request.requestedAssignee.firstName} ${request.requestedAssignee.lastName}`
        : assignmentRequestTypeLabels[request.type]}
    </p>
    <p className="mt-1 text-sm leading-6 text-amber-900">“{request.reason}”</p>
    <p className="mt-2 text-xs text-amber-700">
      Submitted {formatDateTime(request.createdAt)} · awaiting manager approval
    </p>
    {canCancel ? (
      <button
        className="mt-3 inline-flex items-center justify-center rounded-2xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={cancelling}
        onClick={onCancel}
        type="button"
      >
        {cancelling ? 'Cancelling…' : 'Cancel request'}
      </button>
    ) : null}
  </div>
);

export const AgentAssignmentControl = ({
  ticket,
}: {
  ticket: TicketDetailResponse;
}) => {
  const currentUserQuery = useCurrentUser();
  const currentUserId = currentUserQuery.data?.id ?? null;
  const assignMutation = useAssignTicket(ticket.id);
  const requestsQuery = useTicketAssignmentRequests(ticket.id);
  const cancelMutation = useCancelAssignmentRequest(ticket.id);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const pending =
    (requestsQuery.data ?? []).find((entry) => entry.status === 'PENDING') ??
    null;

  const assigneeId = ticket.assignee?.id ?? null;
  const isUnassigned = assigneeId === null;
  const isOwnedByMe = assigneeId !== null && assigneeId === currentUserId;

  const handleClaim = async () => {
    if (!currentUserId) return;
    setClaimError(null);
    setSuccessMessage(null);
    try {
      await assignMutation.mutateAsync({ assigneeId: currentUserId });
      setSuccessMessage('You claimed this ticket.');
    } catch (error) {
      setClaimError(
        getApiErrorMessage(error, 'This ticket could not be claimed.'),
      );
    }
  };

  const handleCancel = async () => {
    if (!pending) return;
    setClaimError(null);
    try {
      await cancelMutation.mutateAsync(pending.id);
    } catch (error) {
      setClaimError(
        getApiErrorMessage(error, 'The request could not be cancelled.'),
      );
    }
  };

  return (
    <ControlShell
      hint="Agents claim unassigned team tickets directly; reassigning an owned ticket needs manager approval."
      label="Assignee"
    >
      <p className="text-sm font-semibold text-slate-900">
        {ticket.assignee
          ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}`
          : 'Unassigned'}
      </p>

      {pending ? (
        <PendingBanner
          cancelling={cancelMutation.isPending}
          canCancel={pending.requestedBy.id === currentUserId}
          onCancel={() => {
            void handleCancel();
          }}
          request={pending}
        />
      ) : isUnassigned ? (
        <button
          className="mt-3 inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={assignMutation.isPending}
          onClick={() => {
            void handleClaim();
          }}
          type="button"
        >
          {assignMutation.isPending ? 'Claiming…' : 'Assign to me'}
        </button>
      ) : isOwnedByMe ? (
        <button
          className="mt-3 inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          onClick={() => setDialogOpen(true)}
          type="button"
        >
          Request reassignment
        </button>
      ) : (
        <p className="mt-2 text-xs text-slate-500">
          This ticket is owned by another teammate. Ask a manager to reassign
          it.
        </p>
      )}

      {claimError ? (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {claimError}
        </p>
      ) : null}

      {successMessage ? (
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {successMessage}
        </p>
      ) : null}

      <AssignmentRequestDialog
        onClose={() => setDialogOpen(false)}
        open={dialogOpen}
        ticket={ticket}
      />
    </ControlShell>
  );
};
