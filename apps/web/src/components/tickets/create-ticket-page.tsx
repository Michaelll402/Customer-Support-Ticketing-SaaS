'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { useCurrentUser } from '@/hooks/use-auth';
import { useCreateTicket, useTicketCategories } from '@/hooks/use-tickets';
import { getApiErrorMessage } from '@/lib/api';
import {
  createTicketFormSchema,
  ticketPriorityLabels,
  type CreateTicketFormInput,
} from '@/lib/tickets';

export const CreateTicketPage = () => {
  const router = useRouter();
  const currentUserQuery = useCurrentUser();
  const createTicketMutation = useCreateTicket();
  const ticketCategoriesQuery = useTicketCategories(
    currentUserQuery.data?.role === 'CUSTOMER',
  );

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<CreateTicketFormInput>({
    defaultValues: {
      subject: '',
      description: '',
      priority: 'MEDIUM',
      categoryId: '',
    },
    resolver: zodResolver(createTicketFormSchema),
  });

  useEffect(() => {
    if (!currentUserQuery.data || currentUserQuery.data.role === 'CUSTOMER') {
      return;
    }

    router.replace('/tickets');
  }, [currentUserQuery.data, router]);
  const categoryOptions = ticketCategoriesQuery.data ?? [];

  const onSubmit = handleSubmit(async (values) => {
    const ticket = await createTicketMutation.mutateAsync({
      subject: values.subject,
      description: values.description,
      priority: values.priority,
      categoryId: values.categoryId || undefined,
    });

    router.push(`/tickets?created=${ticket.number}`);
  });

  if (currentUserQuery.isLoading) {
    return (
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
          Ticket create
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
          Confirming workspace access
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Checking the current session before opening the customer ticket-create
          flow.
        </p>
      </section>
    );
  }

  if (currentUserQuery.isError) {
    return (
      <section className="rounded-[2rem] border border-amber-200 bg-white p-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
          Session check failed
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
          We could not confirm the current user
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {getApiErrorMessage(
            currentUserQuery.error,
            'Reload the page and try again.',
          )}
        </p>
      </section>
    );
  }

  if (!currentUserQuery.data || currentUserQuery.data.role !== 'CUSTOMER') {
    return (
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
          Ticket create
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
          Redirecting to the ticket list
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Ticket creation is customer-only. Staff users stay on the queue/list
          surfaces.
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-700">
              Ticket core
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Create a new support ticket
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Create a customer support ticket with the core details support
              needs for triage.
            </p>
          </div>

          <Link
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            href="/tickets"
          >
            Back to tickets
          </Link>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur">
        <form className="grid gap-6" onSubmit={onSubmit}>
          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <div className="grid gap-5">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Subject
                </span>
                <input
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-300"
                  placeholder="Summarize the support issue"
                  type="text"
                  {...register('subject')}
                />
                <span
                  className={
                    errors.subject
                      ? 'text-xs text-rose-600'
                      : 'text-xs text-slate-500'
                  }
                >
                  {errors.subject?.message ??
                    'Keep it specific enough for support triage.'}
                </span>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Description
                </span>
                <textarea
                  className="min-h-40 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-300"
                  placeholder="Describe what happened, what you expected, and any relevant steps to reproduce the issue."
                  {...register('description')}
                />
                <span
                  className={
                    errors.description
                      ? 'text-xs text-rose-600'
                      : 'text-xs text-slate-500'
                  }
                >
                  {errors.description?.message ??
                    'Describe the core issue so support can triage it.'}
                </span>
              </label>
            </div>

            <div className="grid gap-5">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Category
                </span>
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-300"
                  {...register('categoryId')}
                >
                  <option value="">Uncategorized</option>
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <span
                  className={
                    errors.categoryId
                      ? 'text-xs text-rose-600'
                      : 'text-xs text-slate-500'
                  }
                >
                  {errors.categoryId?.message ??
                    'Categories come from backend-visible workspace data. Uncategorized tickets are allowed.'}
                </span>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Priority
                </span>
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-300"
                  {...register('priority')}
                >
                  {Object.entries(ticketPriorityLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
                <span className="text-xs text-slate-500">
                  Priority stays customer-selectable at creation. Staff can
                  adjust priority and other workflow fields after creation from
                  the ticket detail page.
                </span>
              </label>

              {ticketCategoriesQuery.isError ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {getApiErrorMessage(
                    ticketCategoriesQuery.error,
                    'Ticket categories could not be loaded, so category selection is limited to uncategorized.',
                  )}
                </div>
              ) : null}

              {ticketCategoriesQuery.isLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Loading category options from the workspace…
                </div>
              ) : null}

              {!ticketCategoriesQuery.isError &&
              !ticketCategoriesQuery.isLoading &&
              categoryOptions.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  No ticket categories are configured yet. You can still create
                  an uncategorized ticket now.
                </div>
              ) : null}
            </div>
          </div>

          {createTicketMutation.isError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {getApiErrorMessage(
                createTicketMutation.error,
                'The ticket could not be created.',
              )}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-slate-500">
              The requester is always derived from the authenticated customer.
              There is no on-behalf-of creation flow yet.
            </p>

            <button
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={isSubmitting || createTicketMutation.isPending}
              type="submit"
            >
              {isSubmitting || createTicketMutation.isPending
                ? 'Creating ticket…'
                : 'Create ticket'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
