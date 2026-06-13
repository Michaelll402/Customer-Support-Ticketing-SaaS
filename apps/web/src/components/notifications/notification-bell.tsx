'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/use-notifications';
import type { NotificationItem } from '@/lib/notifications';

import { NotificationDropdown } from './notification-dropdown';

const NOTIFICATIONS_PANEL_ID = 'notifications-panel';

const formatBadgeCount = (count: number): string =>
  count > 99 ? '99+' : String(count);

export const NotificationBell = () => {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<{
    right: number;
    top: number;
  }>({ right: 16, top: 80 });

  const notificationsQuery = useNotifications({ limit: 10, page: 1 });
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;

  // Anchor the portaled (fixed) panel to the bell button's bottom-right.
  const updatePanelPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setPanelPosition({
      right: Math.max(window.innerWidth - rect.right, 8),
      top: rect.bottom + 8,
    });
  }, []);

  // Keep the panel anchored while it is open (page scroll, viewport resize).
  useEffect(() => {
    if (!open) return;

    updatePanelPosition();
    window.addEventListener('scroll', updatePanelPosition, true);
    window.addEventListener('resize', updatePanelPosition);
    return () => {
      window.removeEventListener('scroll', updatePanelPosition, true);
      window.removeEventListener('resize', updatePanelPosition);
    };
  }, [open, updatePanelPosition]);

  // Move keyboard focus into the panel once the portal has mounted.
  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  // Close on outside click (button wrapper or the portaled panel) and Escape.
  useEffect(() => {
    if (!open) return;

    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const handleToggle = () => {
    const next = !open;
    if (next) {
      // Measure before the portal paints so the panel never flashes at a stale
      // position.
      updatePanelPosition();
    }
    setOpen(next);
  };

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
        aria-controls={open ? NOTIFICATIONS_PANEL_ID : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications'
        }
        className="relative inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        onClick={handleToggle}
        ref={buttonRef}
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
            className="absolute -right-1 -top-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm"
          >
            {formatBadgeCount(unreadCount)}
          </span>
        ) : null}
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <NotificationDropdown
              data={notificationsQuery.data}
              error={notificationsQuery.error}
              id={NOTIFICATIONS_PANEL_ID}
              isError={notificationsQuery.isError}
              isLoading={notificationsQuery.isLoading}
              isMarkAllPending={markAllReadMutation.isPending}
              isMarkSinglePending={markReadMutation.isPending}
              onItemClick={handleItemClick}
              onMarkAllRead={handleMarkAllRead}
              onRetry={() => {
                void notificationsQuery.refetch();
              }}
              ref={panelRef}
              style={{
                position: 'fixed',
                right: `${panelPosition.right}px`,
                top: `${panelPosition.top}px`,
                zIndex: 50,
              }}
            />,
            document.body,
          )
        : null}
    </div>
  );
};
