'use client';

import { useEffect } from 'react';

import { useRealtimeContext } from '@/providers/realtime-provider';

export const useRealtime = () => useRealtimeContext();

interface UseTicketRealtimeSubscriptionOptions {
  staff?: boolean;
  enabled?: boolean;
}

export const useTicketRealtimeSubscription = (
  ticketId: string | null | undefined,
  { staff = false, enabled = true }: UseTicketRealtimeSubscriptionOptions = {},
): void => {
  const { subscribeTicket, unsubscribeTicket } = useRealtimeContext();

  useEffect(() => {
    if (!enabled) return;
    if (!ticketId) return;

    let cancelled = false;

    void subscribeTicket(ticketId).then(() => {
      if (cancelled) {
        void unsubscribeTicket(ticketId);
      }
    });

    return () => {
      cancelled = true;
      void unsubscribeTicket(ticketId);
    };
  }, [enabled, subscribeTicket, ticketId, unsubscribeTicket]);

  const { subscribeTicketStaff, unsubscribeTicketStaff } = useRealtimeContext();

  useEffect(() => {
    if (!enabled) return;
    if (!staff) return;
    if (!ticketId) return;

    let cancelled = false;

    void subscribeTicketStaff(ticketId).then(() => {
      if (cancelled) {
        void unsubscribeTicketStaff(ticketId);
      }
    });

    return () => {
      cancelled = true;
      void unsubscribeTicketStaff(ticketId);
    };
  }, [enabled, staff, subscribeTicketStaff, ticketId, unsubscribeTicketStaff]);
};
