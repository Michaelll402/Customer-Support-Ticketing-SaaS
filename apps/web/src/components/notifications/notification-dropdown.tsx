'use client';

import type { ReactNode } from 'react';

import { getApiErrorMessage } from '@/lib/api';
import type {
  NotificationItem,
  NotificationListResponse,
} from '@/lib/notifications';

import { NotificationListItem } from './notification-list-item';

const InlineState = ({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm">
    <p className="font-semibold text-slate-950">{title}</p>
    <p className="mt-1 leading-5 text-slate-600">{description}</p>
    {action ? <div className="mt-3">{action}</div> : null}
  </div>
);

export const NotificationDropdown = ({
  data,
  error,
  isError,
  isLoading,
  isMarkAllPending,
  isMarkSinglePending,
  onItemClick,
  onMarkAllRead,
  onRetry,
}: {
  data: NotificationListResponse | undefined;
  error: unknown;
  isError: boolean;
  isLoading: boolean;
  isMarkAllPending: boolean;
  isMarkSinglePending: boolean;
  onItemClick: (item: NotificationItem) => void;
  onMarkAllRead: () => void;
  onRetry: () => void;
}) => {
  const unreadCount = data?.unreadCount ?? 0;
  const items = data?.items ?? [];

  return (
    <div
      className="absolute right-0 top-full z-30 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.4)]"
      role="dialog"
      aria-label="Notifications"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Notifications
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={
            unreadCount === 0 || isMarkAllPending || isMarkSinglePending
          }
          onClick={onMarkAllRead}
          type="button"
        >
          {isMarkAllPending ? 'Marking...' : 'Mark all read'}
        </button>
      </div>

      <div className="mt-3 grid gap-2">
        {isLoading ? (
          <InlineState
            description="Pulling the latest notifications from the API."
            title="Loading notifications"
          />
        ) : null}

        {isError ? (
          <InlineState
            action={
              <button
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                onClick={onRetry}
                type="button"
              >
                Retry notifications
              </button>
            }
            description={getApiErrorMessage(
              error,
              'The notifications endpoint could not be reached.',
            )}
            title="Notifications unavailable"
          />
        ) : null}

        {!isLoading && !isError && items.length === 0 ? (
          <InlineState
            description="No notifications have been delivered to this account yet."
            title="No notifications yet"
          />
        ) : null}

        {!isLoading && !isError && items.length > 0 ? (
          <div className="grid gap-2">
            {items.map((item) => (
              <NotificationListItem
                isPending={isMarkSinglePending || isMarkAllPending}
                item={item}
                key={item.id}
                onClick={onItemClick}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};
