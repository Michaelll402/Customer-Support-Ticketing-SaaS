'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';

import { useCurrentUser } from '@/hooks/use-auth';
import { useAuditLogs } from '@/hooks/use-admin-audit';
import { getApiErrorMessage } from '@/lib/api';
import {
  auditActionLabels,
  auditActionOptions,
  formatAuditAction,
  metadataEntries,
  type AuditLog,
  type AuditLogListQuery,
} from '@/lib/admin-audit';
import {
  CheckIcon,
  ChevronDownIcon,
  ClipboardIcon,
  CopyIcon,
  ShieldIcon,
} from '@/components/ui/icons';
import {
  ConsoleHeader,
  EmptyState,
  ErrorState,
  FilterChip,
  Pagination,
  consoleSurface,
  fieldLabel,
  ghostButton,
  inputClass,
} from './admin-ui';

const PAGE_SIZE = 25;

const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });
const timeFmt = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});
const dateOnly = (value: string) => dateFmt.format(new Date(value));
const timeOnly = (value: string) => timeFmt.format(new Date(value));
const truncId = (value: string) =>
  value.length > 14 ? `${value.slice(0, 8)}…` : value;

const detailsButton =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 motion-reduce:transition-none';

const CopyButton = ({ value, label }: { value: string; label: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      aria-label={copied ? 'Copied' : label}
      className="inline-flex h-6 w-6 flex-none cursor-pointer items-center justify-center rounded text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 motion-reduce:transition-none"
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      type="button"
    >
      {copied ? (
        <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <CopyIcon className="h-3.5 w-3.5" />
      )}
    </button>
  );
};

const CopyableId = ({ value }: { value: string }) => (
  <span className="inline-flex max-w-full items-center gap-1.5">
    <code
      className="truncate rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700 ring-1 ring-inset ring-slate-200"
      title={value}
    >
      {value}
    </code>
    <CopyButton label={`Copy ${value}`} value={value} />
  </span>
);

const TargetTypeBadge = ({ type }: { type: string }) => (
  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
    {type}
  </span>
);

const ActorCell = ({ actor }: { actor: AuditLog['actor'] }) =>
  actor ? (
    <span className="text-sm font-medium text-slate-800">
      {actor.displayName}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">
      <ShieldIcon className="h-3 w-3" />
      System
    </span>
  );

const DetailPanel = ({ metadata }: { metadata: unknown }) => {
  const entries = metadataEntries(metadata);
  if (entries.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No additional details were recorded for this event.
      </p>
    );
  }
  return (
    <dl className="grid gap-2.5 sm:grid-cols-2">
      {entries.map((entry) => (
        <div
          className="rounded-lg border border-slate-200 bg-white px-3 py-2"
          key={entry.key}
        >
          <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
            {entry.label}
          </dt>
          <dd className="mt-1 flex items-start gap-1.5">
            <span
              className={`min-w-0 break-words ${
                entry.mono
                  ? 'font-mono text-xs text-slate-700'
                  : 'text-sm text-slate-800'
              }`}
            >
              {entry.value}
            </span>
            {entry.copyable ? (
              <CopyButton label={`Copy ${entry.label}`} value={entry.value} />
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
};

const AuditRow = ({ log }: { log: AuditLog }) => {
  const [open, setOpen] = useState(false);
  const hasMetadata = metadataEntries(log.metadata).length > 0;
  return (
    <>
      <tr className="transition-colors duration-150 hover:bg-slate-50/70 motion-reduce:transition-none">
        <td className="whitespace-nowrap px-5 py-3.5 align-top">
          <div className="text-sm font-medium text-slate-800">
            {dateOnly(log.createdAt)}
          </div>
          <div className="text-xs tabular-nums text-slate-500">
            {timeOnly(log.createdAt)}
          </div>
        </td>
        <td className="px-5 py-3.5 align-top">
          <ActorCell actor={log.actor} />
        </td>
        <td className="px-5 py-3.5 align-top">
          <div className="font-medium text-slate-900">
            {formatAuditAction(log.action)}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-500">
            {log.action}
          </div>
        </td>
        <td className="px-5 py-3.5 align-top">
          <TargetTypeBadge type={log.targetType} />
          <div className="mt-1.5">
            <CopyableId value={log.targetId} />
          </div>
        </td>
        <td className="px-5 py-3.5 text-right align-top">
          {hasMetadata ? (
            <button
              aria-expanded={open}
              className={detailsButton}
              onClick={() => setOpen((value) => !value)}
              type="button"
            >
              Details
              <ChevronDownIcon
                className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${
                  open ? 'rotate-180' : ''
                }`}
              />
            </button>
          ) : (
            <span className="text-xs text-slate-500">—</span>
          )}
        </td>
      </tr>
      {open ? (
        <tr className="bg-slate-50">
          <td className="px-5 py-4" colSpan={5}>
            <DetailPanel metadata={log.metadata} />
          </td>
        </tr>
      ) : null}
    </>
  );
};

const AuditCard = ({ log }: { log: AuditLog }) => {
  const [open, setOpen] = useState(false);
  const hasMetadata = metadataEntries(log.metadata).length > 0;
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">
            {formatAuditAction(log.action)}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-slate-500">
            {log.action}
          </p>
        </div>
        <div className="flex-none text-right">
          <div className="text-xs font-medium text-slate-700">
            {dateOnly(log.createdAt)}
          </div>
          <div className="text-xs tabular-nums text-slate-500">
            {timeOnly(log.createdAt)}
          </div>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">
            Actor
          </dt>
          <dd className="mt-1">
            <ActorCell actor={log.actor} />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">
            Target type
          </dt>
          <dd className="mt-1">
            <TargetTypeBadge type={log.targetType} />
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">
            Target ID
          </dt>
          <dd className="mt-1">
            <CopyableId value={log.targetId} />
          </dd>
        </div>
      </dl>
      {hasMetadata ? (
        <div className="mt-3">
          <button
            aria-expanded={open}
            className={detailsButton}
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            {open ? 'Hide details' : 'Details'}
            <ChevronDownIcon
              className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${
                open ? 'rotate-180' : ''
              }`}
            />
          </button>
          {open ? (
            <div className="mt-3 rounded-lg bg-slate-50 p-3">
              <DetailPanel metadata={log.metadata} />
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
};

const TableSkeleton = () => (
  <div aria-hidden="true" className="divide-y divide-slate-100">
    {Array.from({ length: 8 }).map((_, index) => (
      <div className="flex items-center gap-4 px-5 py-4" key={index}>
        <div className="grid w-28 flex-none gap-2">
          <div className="h-3 w-20 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
          <div className="h-3 w-14 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
        </div>
        <div className="h-3 w-28 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
        <div className="hidden h-3 w-40 animate-pulse rounded bg-slate-100 sm:block motion-reduce:animate-none" />
        <div className="ml-auto h-7 w-20 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none" />
      </div>
    ))}
  </div>
);

const toIso = (date: string, endOfDay: boolean): string | undefined =>
  date
    ? new Date(
        `${date}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`,
      ).toISOString()
    : undefined;

const headCell = 'px-5 py-3 font-semibold';

export const AdminAuditPage = () => {
  const currentUserQuery = useCurrentUser();
  const isAdmin = currentUserQuery.data?.role === 'ADMIN';

  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [targetId, setTargetId] = useState('');
  const [actorId, setActorId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const query: AuditLogListQuery = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      action: action || undefined,
      targetType: targetType.trim() || undefined,
      targetId: targetId.trim() || undefined,
      actorId: actorId.trim() || undefined,
      from: toIso(fromDate, false),
      to: toIso(toDate, true),
    }),
    [page, action, targetType, targetId, actorId, fromDate, toDate],
  );

  const logsQuery = useAuditLogs(query, isAdmin);
  const data = logsQuery.data;
  const hasFilters = Boolean(
    action || targetType || targetId || actorId || fromDate || toDate,
  );

  if (currentUserQuery.isLoading) {
    return (
      <div
        className={`${consoleSurface} animate-pulse p-6 motion-reduce:animate-none`}
      >
        <div className="h-6 w-48 rounded bg-slate-100" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <section className={`${consoleSurface} px-6 py-6`}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">
          Access denied
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
          The audit log is admin-only
        </h1>
        <Link
          className="mt-5 inline-flex cursor-pointer items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800 motion-reduce:transition-none"
          href="/tickets"
        >
          Back to tickets
        </Link>
      </section>
    );
  }

  const reset = () => {
    setAction('');
    setTargetType('');
    setTargetId('');
    setActorId('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const onFilterChange =
    (setter: (value: string) => void) => (value: string) => {
      setter(value);
      setPage(1);
    };

  const chips: Array<{ label: string; onRemove: () => void }> = [];
  if (action)
    chips.push({
      label: `Action: ${formatAuditAction(action)}`,
      onRemove: () => onFilterChange(setAction)(''),
    });
  if (actorId)
    chips.push({
      label: `Actor: ${truncId(actorId)}`,
      onRemove: () => onFilterChange(setActorId)(''),
    });
  if (targetType)
    chips.push({
      label: `Type: ${targetType}`,
      onRemove: () => onFilterChange(setTargetType)(''),
    });
  if (targetId)
    chips.push({
      label: `Target: ${truncId(targetId)}`,
      onRemove: () => onFilterChange(setTargetId)(''),
    });
  if (fromDate)
    chips.push({
      label: `From ${fromDate}`,
      onRemove: () => onFilterChange(setFromDate)(''),
    });
  if (toDate)
    chips.push({
      label: `To ${toDate}`,
      onRemove: () => onFilterChange(setToDate)(''),
    });

  let body: ReactNode;
  if (logsQuery.isLoading) {
    body = <TableSkeleton />;
  } else if (logsQuery.isError) {
    body = (
      <ErrorState
        message={getApiErrorMessage(
          logsQuery.error,
          'The audit log could not be loaded.',
        )}
        onRetry={() => void logsQuery.refetch()}
      />
    );
  } else if (!data || data.items.length === 0) {
    body = (
      <EmptyState
        action={
          hasFilters ? (
            <button className={ghostButton} onClick={reset} type="button">
              Clear filters
            </button>
          ) : undefined
        }
        description={
          hasFilters
            ? 'No events match these filters. Broaden the date range or clear the filters.'
            : 'Administrative and workflow actions are recorded here for traceability as they happen.'
        }
        icon={<ClipboardIcon className="h-6 w-6" />}
        title={hasFilters ? 'No matching events' : 'No audit events yet'}
      />
    );
  } else {
    body = (
      <>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                <th className={headCell} scope="col">
                  When
                </th>
                <th className={headCell} scope="col">
                  Actor
                </th>
                <th className={headCell} scope="col">
                  Action
                </th>
                <th className={headCell} scope="col">
                  Target
                </th>
                <th className={`${headCell} text-right`} scope="col">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((log) => (
                <AuditRow key={log.id} log={log} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 p-4 lg:hidden">
          {data.items.map((log) => (
            <AuditCard key={log.id} log={log} />
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1200px] gap-4">
      <ConsoleHeader
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
            <span className="font-semibold tabular-nums text-slate-800">
              {data?.meta.totalItems ?? '—'}
            </span>
            events
          </span>
        }
        description="An append-only, newest-first record of administrative and workflow actions for investigation and traceability."
        eyebrow="Administration"
        icon={<ClipboardIcon className="h-5 w-5" />}
        title="Audit log"
      />

      <section className={`${consoleSurface} px-5 py-5 sm:px-6`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-1.5">
            <label className={fieldLabel} htmlFor="audit-action">
              Action
            </label>
            <select
              className={inputClass}
              id="audit-action"
              onChange={(event) =>
                onFilterChange(setAction)(event.target.value)
              }
              value={action}
            >
              <option value="">All actions</option>
              {auditActionOptions.map((value) => (
                <option key={value} value={value}>
                  {auditActionLabels[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label className={fieldLabel} htmlFor="audit-actor">
              Actor ID
            </label>
            <input
              className={inputClass}
              id="audit-actor"
              onChange={(event) =>
                onFilterChange(setActorId)(event.target.value)
              }
              placeholder="Exact id"
              value={actorId}
            />
          </div>
          <div className="grid gap-1.5">
            <label className={fieldLabel} htmlFor="audit-target-type">
              Target type
            </label>
            <input
              className={inputClass}
              id="audit-target-type"
              onChange={(event) =>
                onFilterChange(setTargetType)(event.target.value)
              }
              placeholder="e.g. User, Ticket"
              value={targetType}
            />
          </div>
          <div className="grid gap-1.5">
            <label className={fieldLabel} htmlFor="audit-target-id">
              Target ID
            </label>
            <input
              className={inputClass}
              id="audit-target-id"
              onChange={(event) =>
                onFilterChange(setTargetId)(event.target.value)
              }
              placeholder="Exact id"
              value={targetId}
            />
          </div>
          <div className="grid gap-1.5">
            <label className={fieldLabel} htmlFor="audit-from">
              From
            </label>
            <input
              className={inputClass}
              id="audit-from"
              onChange={(event) =>
                onFilterChange(setFromDate)(event.target.value)
              }
              type="date"
              value={fromDate}
            />
          </div>
          <div className="grid gap-1.5">
            <label className={fieldLabel} htmlFor="audit-to">
              To
            </label>
            <input
              className={inputClass}
              id="audit-to"
              onChange={(event) =>
                onFilterChange(setToDate)(event.target.value)
              }
              type="date"
              value={toDate}
            />
          </div>
        </div>

        {hasFilters ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <span className="text-xs font-medium text-slate-500">Filters:</span>
            {chips.map((chip) => (
              <FilterChip
                key={chip.label}
                label={chip.label}
                onRemove={chip.onRemove}
              />
            ))}
            <button
              className="ml-auto cursor-pointer text-xs font-semibold text-slate-600 underline-offset-2 transition-colors duration-200 hover:text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 motion-reduce:transition-none"
              onClick={reset}
              type="button"
            >
              Clear all
            </button>
          </div>
        ) : null}
      </section>

      <section className={`${consoleSurface} overflow-hidden`}>
        <div aria-busy={logsQuery.isFetching}>{body}</div>

        {data && data.items.length > 0 ? (
          <Pagination
            hasNext={data.meta.hasNextPage}
            hasPrev={data.meta.hasPreviousPage}
            onNext={() => setPage((value) => value + 1)}
            onPrev={() => setPage((value) => Math.max(1, value - 1))}
            page={data.meta.page}
            totalItems={data.meta.totalItems}
            totalPages={data.meta.totalPages}
            unit="events"
          />
        ) : null}
      </section>
    </div>
  );
};
