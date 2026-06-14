'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const sizeClasses = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const;

/**
 * Accessible modal dialog: portaled to the body, focus-trapped, Escape-to-close,
 * `aria-modal`, restores focus to the trigger on close, and respects
 * `prefers-reduced-motion`.
 *
 * The panel is a bounded flex column — a fixed header (with an optional accent
 * icon) and a scrollable body — so long forms can pin a sticky footer to the
 * bottom of the body instead of pushing actions off-screen.
 */
export const Dialog = ({
  open,
  onClose,
  title,
  description,
  children,
  icon,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  icon?: ReactNode;
  size?: keyof typeof sizeClasses;
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel).focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-4 py-6 sm:items-center sm:py-10"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`flex max-h-[calc(100dvh-3rem)] w-full ${sizeClasses[size]} flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-20px_rgba(15,23,42,0.45)] outline-none sm:max-h-[85dvh]`}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex shrink-0 items-start gap-3.5 border-b border-slate-100 px-6 py-5">
          {icon ? (
            <span
              aria-hidden="true"
              className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-slate-900 text-white"
            >
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h2
              className="text-lg font-semibold tracking-tight text-slate-900"
              id={titleId}
            >
              {title}
            </h2>
            {description ? (
              <div
                className="mt-1 text-sm leading-6 text-slate-600"
                id={descriptionId}
              >
                {description}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
};
