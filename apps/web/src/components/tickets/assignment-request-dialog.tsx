'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';

import { useCreateAssignmentRequest } from '@/hooks/use-assignment-requests';
import { useAssignableUsers } from '@/hooks/use-tickets';
import { getApiErrorMessage } from '@/lib/api';
import {
  ASSIGNMENT_REQUEST_REASON_MAX,
  createAssignmentRequestFormSchema,
  type CreateAssignmentRequestFormInput,
} from '@/lib/assignment-requests';
import { userRoleLabels, type TicketDetailResponse } from '@/lib/tickets';

export const AssignmentRequestDialog = ({
  ticket,
  open,
  onClose,
}: {
  ticket: TicketDetailResponse;
  open: boolean;
  onClose: () => void;
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const createMutation = useCreateAssignmentRequest(ticket.id);
  const assignableQuery = useAssignableUsers(ticket.id, open);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateAssignmentRequestFormInput>({
    resolver: zodResolver(createAssignmentRequestFormSchema),
    defaultValues: {
      type: 'REASSIGN_USER',
      requestedAssigneeId: '',
      reason: '',
    },
  });

  const requestType = watch('type');

  useEffect(() => {
    if (!open) {
      return;
    }
    reset({ type: 'REASSIGN_USER', requestedAssigneeId: '', reason: '' });
    createMutation.reset();
    const frame = requestAnimationFrame(() => {
      panelRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
    // Only re-run when the dialog is (re)opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  const teammates = (assignableQuery.data ?? []).filter(
    (user) => user.id !== ticket.assignee?.id,
  );

  const onSubmit = handleSubmit(async (values) => {
    await createMutation.mutateAsync({
      type: values.type,
      requestedAssigneeId:
        values.type === 'REASSIGN_USER' ? values.requestedAssigneeId : null,
      reason: values.reason,
    });
    onClose();
  });

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        aria-labelledby="assignment-request-title"
        aria-modal="true"
        className="w-full max-w-lg rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.5)] outline-none"
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
          Reassignment request
        </p>
        <h2
          className="mt-2 text-xl font-semibold tracking-tight text-slate-950"
          id="assignment-request-title"
        >
          Request a reassignment for ticket #{ticket.number}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The ticket stays assigned to you until a manager or admin approves the
          request.
        </p>

        <form className="mt-5 grid gap-4" onSubmit={onSubmit}>
          <fieldset className="grid gap-2">
            <legend className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Request type
            </legend>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3">
              <input type="radio" value="REASSIGN_USER" {...register('type')} />
              <span className="text-sm text-slate-800">
                Assign to a teammate
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3">
              <input
                type="radio"
                value="RETURN_TO_QUEUE"
                {...register('type')}
              />
              <span className="text-sm text-slate-800">
                Return to the team queue
              </span>
            </label>
          </fieldset>

          {requestType === 'REASSIGN_USER' ? (
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Teammate
              </span>
              <select
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                defaultValue=""
                {...register('requestedAssigneeId')}
              >
                <option disabled value="">
                  {assignableQuery.isLoading
                    ? 'Loading teammates…'
                    : 'Select a teammate'}
                </option>
                {teammates.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName} -{' '}
                    {userRoleLabels[user.role]}
                  </option>
                ))}
              </select>
              {errors.requestedAssigneeId ? (
                <span className="text-xs text-rose-600">
                  {errors.requestedAssigneeId.message}
                </span>
              ) : null}
            </label>
          ) : null}

          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Reason
            </span>
            <textarea
              className="min-h-28 w-full resize-y rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              maxLength={ASSIGNMENT_REQUEST_REASON_MAX}
              placeholder="Explain why this ticket should be reassigned."
              {...register('reason')}
            />
            {errors.reason ? (
              <span className="text-xs text-rose-600">
                {errors.reason.message}
              </span>
            ) : null}
          </label>

          {createMutation.isError ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {getApiErrorMessage(
                createMutation.error,
                'The request could not be submitted.',
              )}
            </p>
          ) : null}

          <div className="mt-1 flex flex-wrap justify-end gap-3">
            <button
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? 'Sending…' : 'Send request'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};
