'use client';

import {
  notificationTypeLabels,
  type NotificationItem,
} from '@/lib/notifications';

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

export const NotificationListItem = ({
  isPending,
  item,
  onClick,
}: {
  isPending: boolean;
  item: NotificationItem;
  onClick: (item: NotificationItem) => void;
}) => {
  const unread = !item.isRead;

  return (
    <button
      aria-label={`${notificationTypeLabels[item.type]} notification`}
      className={`flex w-full flex-col gap-1 rounded-2xl border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
        unread
          ? 'border-sky-200 bg-sky-50 hover:border-sky-300'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
      disabled={isPending}
      onClick={() => onClick(item)}
      type="button"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
            unread ? 'bg-sky-200 text-sky-900' : 'bg-slate-100 text-slate-700'
          }`}
        >
          {notificationTypeLabels[item.type]}
        </span>
        {unread ? (
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500"
          />
        ) : null}
        <span className="ml-auto text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
          {formatDateTime(item.createdAt)}
        </span>
      </div>

      <p
        className={`break-words text-sm leading-5 ${
          unread ? 'font-semibold text-slate-950' : 'text-slate-700'
        }`}
      >
        {item.message}
      </p>

      {item.ticketId ? (
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
          Open ticket detail
        </p>
      ) : null}
    </button>
  );
};
