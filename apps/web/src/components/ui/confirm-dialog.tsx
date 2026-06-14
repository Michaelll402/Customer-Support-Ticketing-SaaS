'use client';

import { type ReactNode } from 'react';

import { Dialog } from './dialog';
import { ShieldIcon, WarningIcon } from './icons';

export type ConfirmSeverity = 'normal' | 'caution' | 'destructive';

const confirmButtonClasses: Record<ConfirmSeverity, string> = {
  normal: 'bg-slate-950 hover:bg-slate-800 focus-visible:ring-slate-400',
  caution: 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-300',
  destructive: 'bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-300',
};

const accentClasses: Record<ConfirmSeverity, string> = {
  normal: 'bg-slate-100 text-slate-700',
  caution: 'bg-amber-100 text-amber-700',
  destructive: 'bg-rose-100 text-rose-700',
};

export const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  severity = 'normal',
  pending = false,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  severity?: ConfirmSeverity;
  pending?: boolean;
  error?: string | null;
}) => {
  return (
    <Dialog
      onClose={pending ? () => undefined : onClose}
      open={open}
      title={title}
      description={
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full ${accentClasses[severity]}`}
          >
            {severity === 'destructive' ? (
              <WarningIcon className="h-5 w-5" />
            ) : (
              <ShieldIcon className="h-5 w-5" />
            )}
          </span>
          <div>{description}</div>
        </div>
      }
    >
      {error ? (
        <p
          className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-3">
        <button
          className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
          disabled={pending}
          onClick={onClose}
          type="button"
        >
          Cancel
        </button>
        <button
          className={`inline-flex min-w-[7rem] cursor-pointer items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${confirmButtonClasses[severity]}`}
          disabled={pending}
          onClick={onConfirm}
          type="button"
        >
          {pending ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
};
