import type { ReactNode } from 'react';

import { ArrowPathIcon, WarningIcon, XMarkIcon } from '@/components/ui/icons';

// Shared visual language for the admin console (Users + Audit). These surfaces
// are deliberately crisper than the frosted `rounded-[2rem]` marketing cards the
// rest of the app shell uses, so the console reads as a purpose-built data tool
// rather than another templated page. Brand stays slate / navy / sky.

export const consoleSurface =
  'rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]';

export const primaryButton =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none';

export const ghostButton =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none';

const solidBase =
  'inline-flex min-w-[8rem] cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none';

export type Severity = 'normal' | 'caution' | 'destructive';

export const severityButton = (severity: Severity) =>
  `${solidBase} ${
    severity === 'destructive'
      ? 'bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-300'
      : severity === 'caution'
        ? 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-300'
        : 'bg-slate-900 hover:bg-slate-800 focus-visible:ring-slate-500'
  }`;

export const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors duration-200 placeholder:text-slate-400 focus-visible:border-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 motion-reduce:transition-none';

export const fieldLabel =
  'text-xs font-semibold uppercase tracking-[0.14em] text-slate-500';

// Pinned action bar for dialog forms: sticks to the bottom of the dialog's
// scrollable body, with negative margins to sit flush against its edges.
export const dialogFooter =
  'sticky bottom-0 z-10 -mx-6 -mb-5 mt-6 flex flex-wrap gap-3 border-t border-slate-100 bg-white px-6 py-4';

export const ConsoleHeader = ({
  icon,
  eyebrow,
  title,
  description,
  actions,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) => (
  <header className={`${consoleSurface} px-5 py-5 sm:px-6`}>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-slate-900 text-white"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            {eyebrow}
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:flex-none sm:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  </header>
);

export type MetricTone =
  | 'neutral'
  | 'active'
  | 'inactive'
  | 'admin'
  | 'manager'
  | 'agent';

const metricDot: Record<MetricTone, string | null> = {
  neutral: null,
  active: 'bg-emerald-500',
  inactive: 'bg-slate-300',
  admin: 'bg-slate-900',
  manager: 'bg-sky-500',
  agent: 'bg-slate-400',
};

export const MetricStrip = ({ children }: { children: ReactNode }) => (
  <div className="overflow-hidden rounded-2xl border border-slate-200">
    {/* gap-px over a slate background paints hairline dividers that survive
        wrapping at any breakpoint. */}
    <dl className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-3 lg:grid-cols-6">
      {children}
    </dl>
  </div>
);

export const Metric = ({
  label,
  value,
  tone = 'neutral',
  loading = false,
}: {
  label: string;
  value: number | string;
  tone?: MetricTone;
  loading?: boolean;
}) => (
  <div className="bg-white px-4 py-3.5">
    <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-slate-500">
      {metricDot[tone] ? (
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${metricDot[tone]}`}
        />
      ) : null}
      {label}
    </dt>
    <dd className="mt-1.5 text-2xl font-semibold tabular-nums text-slate-900">
      {loading ? (
        <span className="inline-block h-7 w-10 animate-pulse rounded bg-slate-100 align-middle motion-reduce:animate-none" />
      ) : (
        value
      )}
    </dd>
  </div>
);

export const FilterChip = ({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-1 text-xs font-medium text-slate-600">
    {label}
    <button
      aria-label={`Remove filter: ${label}`}
      className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors duration-200 hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 motion-reduce:transition-none"
      onClick={onRemove}
      type="button"
    >
      <XMarkIcon className="h-3.5 w-3.5" />
    </button>
  </span>
);

export const EmptyState = ({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
    <span
      aria-hidden="true"
      className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"
    >
      {icon}
    </span>
    <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
    {description ? (
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-slate-500">
        {description}
      </p>
    ) : null}
    {action ? <div className="mt-5">{action}</div> : null}
  </div>
);

export const ErrorState = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) => (
  <div
    className="flex flex-col items-center justify-center px-6 py-12 text-center"
    role="alert"
  >
    <span
      aria-hidden="true"
      className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500"
    >
      <WarningIcon className="h-6 w-6" />
    </span>
    <h3 className="mt-4 text-base font-semibold text-slate-900">
      Something went wrong
    </h3>
    <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-slate-600">
      {message}
    </p>
    <button className={`mt-5 ${ghostButton}`} onClick={onRetry} type="button">
      <ArrowPathIcon className="h-4 w-4" />
      Try again
    </button>
  </div>
);

const pageButton =
  'inline-flex cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none';

export const Pagination = ({
  page,
  totalPages,
  totalItems,
  unit,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  unit: string;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) => (
  <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
    <p className="text-sm text-slate-500">
      Page <span className="font-medium text-slate-700">{page}</span> of{' '}
      {Math.max(totalPages, 1)} ·{' '}
      <span className="tabular-nums">{totalItems}</span> {unit}
    </p>
    <div className="flex items-center gap-2">
      <button
        className={pageButton}
        disabled={!hasPrev}
        onClick={onPrev}
        type="button"
      >
        Previous
      </button>
      <button
        className={pageButton}
        disabled={!hasNext}
        onClick={onNext}
        type="button"
      >
        Next
      </button>
    </div>
  </div>
);
