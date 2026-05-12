'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/use-notifications';
import type { NotificationItem } from '@/lib/notifications';

import { NotificationDropdown } from './notification-dropdown';

const formatBadgeCount = (count: number): string =>
  count > 99 ? '99+' : String(count);

export const NotificationBell = () => {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  const notificationsQuery = useNotifications({ limit: 10, page: 1 });
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;

  useEffect(() => {
    if (!open) return;

    const handleClick = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (wrapperRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const handleItemClick = (item: NotificationItem) => {
    if (!item.isRead) {
      markReadMutation.mutate(item.id);
    }
    if (item.ticketId) {
      router.push(`/tickets/${item.ticketId}`);
    }
    setOpen(false);
  };

  const handleMarkAllRead = () => {
    if (unreadCount === 0) return;
    markAllReadMutation.mutate();
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications'
        }
        className="relative inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <svg
          aria-hidden="true"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          viewBox="0 0 24 24"
        >
          <path
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unreadCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm"
          >
            {formatBadgeCount(unreadCount)}
          </span>
        ) : null}
      </button>

      {open ? (
        <NotificationDropdown
          data={notificationsQuery.data}
          error={notificationsQuery.error}
          isError={notificationsQuery.isError}
          isLoading={notificationsQuery.isLoading}
          isMarkAllPending={markAllReadMutation.isPending}
          isMarkSinglePending={markReadMutation.isPending}
          onItemClick={handleItemClick}
          onMarkAllRead={handleMarkAllRead}
          onRetry={() => {
            void notificationsQuery.refetch();
          }}
        />
      ) : null}
    </div>
  );
};
