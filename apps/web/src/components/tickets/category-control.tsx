'use client';

import { useState, type ChangeEvent, type ReactNode } from 'react';

import {
  useTicketCategories,
  useUpdateTicketCategory,
} from '@/hooks/use-tickets';
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

const UNCATEGORIZED_VALUE = '__uncategorized__';

export const CategoryControl = ({
  ticket,
}: {
  ticket: TicketDetailResponse;
}) => {
  const categoriesQuery = useTicketCategories();
  const mutation = useUpdateTicketCategory(ticket.id);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const raw = event.target.value;
    const nextCategoryId = raw === UNCATEGORIZED_VALUE ? null : raw;
    if (nextCategoryId === (ticket.category?.id ?? null)) return;

    setError(null);
    setSuccess(null);
    try {
      await mutation.mutateAsync({ categoryId: nextCategoryId });
      setSuccess(
        nextCategoryId === null ? 'Category cleared.' : 'Category updated.',
      );
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Category update failed.'));
    }
  };

  const categories = categoriesQuery.data ?? [];
  const currentValue = ticket.category?.id ?? UNCATEGORIZED_VALUE;
  const categoryListError =
    categoriesQuery.isError &&
    getApiErrorMessage(
      categoriesQuery.error,
      'Category options could not be loaded.',
    );

  return (
    <ControlShell
      hint="Changing the category does not move the ticket to a different team."
      label="Category"
    >
      <select
        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
        disabled={mutation.isPending || categoriesQuery.isLoading}
        onChange={(event) => {
          void handleChange(event);
        }}
        value={currentValue}
      >
        <option value={UNCATEGORIZED_VALUE}>
          Uncategorized{ticket.category ? '' : ' (current)'}
        </option>
        {ticket.category &&
        !categories.some((category) => category.id === ticket.category?.id) ? (
          <option value={ticket.category.id}>
            {ticket.category.name} (current)
          </option>
        ) : null}
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
            {category.id === ticket.category?.id ? ' (current)' : ''}
          </option>
        ))}
      </select>

      {categoriesQuery.isLoading ? (
        <p className="mt-2 text-xs text-slate-500">Loading categories...</p>
      ) : null}

      {categoryListError ? (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {categoryListError}
        </p>
      ) : null}

      {mutation.isPending ? (
        <p className="mt-2 text-xs text-slate-500">Saving category...</p>
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
