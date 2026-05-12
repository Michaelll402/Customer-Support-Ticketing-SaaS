'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { useTicketTags, useUpdateTicketTags } from '@/hooks/use-tickets';
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

const sortedIds = (ids: Iterable<string>) => [...new Set(ids)].sort().join(',');

export const TagSelector = ({ ticket }: { ticket: TicketDetailResponse }) => {
  const tagsQuery = useTicketTags();
  const mutation = useUpdateTicketTags(ticket.id);
  const [stagedTagIds, setStagedTagIds] = useState<Set<string>>(
    () => new Set(ticket.tags.map((tag) => tag.id)),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setStagedTagIds(new Set(ticket.tags.map((tag) => tag.id)));
    setError(null);
    setSuccess(null);
  }, [ticket.tags]);

  const tagOptions = tagsQuery.data ?? [];
  const currentSerialised = useMemo(
    () => sortedIds(ticket.tags.map((tag) => tag.id)),
    [ticket.tags],
  );
  const stagedSerialised = sortedIds(stagedTagIds);
  const isDirty = currentSerialised !== stagedSerialised;
  const tagsListError =
    tagsQuery.isError &&
    getApiErrorMessage(tagsQuery.error, 'Tag options could not be loaded.');

  const toggle = (tagId: string) => {
    setStagedTagIds((current) => {
      const next = new Set(current);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
    setError(null);
    setSuccess(null);
  };

  const handleApply = async () => {
    if (!isDirty) return;

    setError(null);
    setSuccess(null);
    try {
      await mutation.mutateAsync({ tagIds: [...stagedTagIds] });
      setSuccess('Tags updated.');
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Tag update failed.'));
    }
  };

  const handleReset = () => {
    setStagedTagIds(new Set(ticket.tags.map((tag) => tag.id)));
    setError(null);
    setSuccess(null);
  };

  return (
    <ControlShell
      hint="Tag changes are applied as a full set. Select the tags you want this ticket to have and confirm."
      label="Tags"
    >
      {tagsQuery.isLoading ? (
        <p className="text-xs text-slate-500">Loading tag options...</p>
      ) : null}

      {tagsListError ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {tagsListError}
        </p>
      ) : null}

      {!tagsQuery.isLoading && !tagsQuery.isError && tagOptions.length === 0 ? (
        <p className="text-xs text-slate-500">
          No tags exist in the workspace yet.
        </p>
      ) : null}

      {tagOptions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tagOptions.map((tag) => {
            const isChecked = stagedTagIds.has(tag.id);
            return (
              <button
                aria-pressed={isChecked}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                  isChecked
                    ? 'border-sky-300 bg-sky-100 text-sky-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
                disabled={mutation.isPending}
                key={tag.id}
                onClick={() => toggle(tag.id)}
                type="button"
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!isDirty || mutation.isPending}
          onClick={() => {
            void handleApply();
          }}
          type="button"
        >
          {mutation.isPending ? 'Applying...' : 'Apply tag changes'}
        </button>
        <button
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!isDirty || mutation.isPending}
          onClick={handleReset}
          type="button"
        >
          Reset
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
