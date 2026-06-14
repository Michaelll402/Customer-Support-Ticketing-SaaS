'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';

import { useCurrentUser } from '@/hooks/use-auth';
import {
  getRealtimeSocketUrl,
  notificationCreatedPayloadSchema,
  realtimeClientEvents,
  realtimeEvents,
  subscribeAckSchema,
  ticketMessageCreatedPayloadSchema,
  ticketUpdatedPayloadSchema,
  type RealtimeStatus,
  type SubscribeAck,
} from '@/lib/realtime';
import { setRealtimeDisconnect } from '@/lib/realtime-controller';

type EmitFn = (event: string, ticketId: string) => Promise<SubscribeAck>;

interface RealtimeContextValue {
  status: RealtimeStatus;
  subscribeTicket: (ticketId: string) => Promise<SubscribeAck>;
  unsubscribeTicket: (ticketId: string) => Promise<SubscribeAck>;
  subscribeTicketStaff: (ticketId: string) => Promise<SubscribeAck>;
  unsubscribeTicketStaff: (ticketId: string) => Promise<SubscribeAck>;
}

const defaultAck: SubscribeAck = { ok: false, code: 'denied' };

const RealtimeContext = createContext<RealtimeContextValue>({
  status: 'idle',
  subscribeTicket: async () => defaultAck,
  unsubscribeTicket: async () => defaultAck,
  subscribeTicketStaff: async () => defaultAck,
  unsubscribeTicketStaff: async () => defaultAck,
});

const parseAck = (raw: unknown): SubscribeAck => {
  const result = subscribeAckSchema.safeParse(raw);
  if (result.success) return result.data;
  return { ok: false, code: 'invalid_payload' };
};

interface RealtimeProviderProps {
  children: ReactNode;
}

export const RealtimeProvider = ({ children }: RealtimeProviderProps) => {
  const queryClient = useQueryClient();
  const currentUserQuery = useCurrentUser();
  const userId = currentUserQuery.data?.id ?? null;

  const socketRef = useRef<Socket | null>(null);
  // Rooms the client currently intends to be in. The server treats every
  // (re)connect as a brand-new socket and only auto-joins the user room, so we
  // replay these on `connect` to restore ticket/staff subscriptions after a
  // reconnect.
  const subscribedTicketsRef = useRef<Set<string>>(new Set());
  const subscribedStaffRef = useRef<Set<string>>(new Set());
  const [status, setStatus] = useState<RealtimeStatus>('idle');

  useEffect(() => {
    if (!userId) {
      setRealtimeDisconnect(null);
      return;
    }

    setStatus('connecting');
    const socket = io(getRealtimeSocketUrl(), {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
    socketRef.current = socket;

    const handleConnect = () => {
      setStatus('connected');
      // Restore room membership after a (re)connect.
      for (const id of subscribedTicketsRef.current) {
        socket.emit(realtimeClientEvents.ticketSubscribe, { ticketId: id });
      }
      for (const id of subscribedStaffRef.current) {
        socket.emit(realtimeClientEvents.ticketSubscribeStaff, {
          ticketId: id,
        });
      }
    };
    const handleDisconnect = () => setStatus('disconnected');
    const handleConnectError = (error: unknown) => {
      setStatus('error');
      // eslint-disable-next-line no-console
      console.warn('[realtime] connect_error', error);
    };

    const handleNotificationCreated = (raw: unknown) => {
      const parsed = notificationCreatedPayloadSchema.safeParse(raw);
      if (!parsed.success) return;
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      // A manager reviewing requests may not be in the ticket room, so refresh
      // their review queue whenever a request-related notification lands.
      void queryClient.invalidateQueries({
        queryKey: ['assignment-requests'],
      });
    };

    const handleTicketUpdated = (raw: unknown) => {
      const parsed = ticketUpdatedPayloadSchema.safeParse(raw);
      if (!parsed.success) return;
      const ticketId = parsed.data.id;
      void queryClient.invalidateQueries({
        queryKey: ['tickets', 'detail', ticketId],
      });
      void queryClient.invalidateQueries({ queryKey: ['tickets', 'list'] });
      // Workflow changes also append a system event to the timeline, so refresh
      // it for any viewer watching this ticket's thread.
      void queryClient.invalidateQueries({
        queryKey: ['tickets', 'timeline', ticketId],
      });
      // Assignment-request mutations emit ticket.updated; refresh the pending
      // banner and any open review list.
      void queryClient.invalidateQueries({
        queryKey: ['assignment-requests'],
      });
    };

    const handleTicketMessageCreated = (raw: unknown) => {
      const parsed = ticketMessageCreatedPayloadSchema.safeParse(raw);
      if (!parsed.success) return;
      void queryClient.invalidateQueries({
        queryKey: ['tickets', 'timeline', parsed.data.ticketId],
      });
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on(realtimeEvents.notificationCreated, handleNotificationCreated);
    socket.on(realtimeEvents.ticketUpdated, handleTicketUpdated);
    socket.on(
      realtimeEvents.ticketMessageCreatedPublic,
      handleTicketMessageCreated,
    );
    socket.on(
      realtimeEvents.ticketMessageCreatedInternal,
      handleTicketMessageCreated,
    );

    const disconnect = () => {
      socket.disconnect();
    };
    setRealtimeDisconnect(disconnect);

    return () => {
      setRealtimeDisconnect(null);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off(realtimeEvents.notificationCreated, handleNotificationCreated);
      socket.off(realtimeEvents.ticketUpdated, handleTicketUpdated);
      socket.off(
        realtimeEvents.ticketMessageCreatedPublic,
        handleTicketMessageCreated,
      );
      socket.off(
        realtimeEvents.ticketMessageCreatedInternal,
        handleTicketMessageCreated,
      );
      socket.disconnect();
      socketRef.current = null;
      setStatus('idle');
    };
  }, [queryClient, userId]);

  const emitWithAck = useCallback<EmitFn>(async (event, ticketId) => {
    const socket = socketRef.current;
    if (!socket) return { ok: false, code: 'denied' };

    const waitForConnect = (): Promise<void> => {
      if (socket.connected) return Promise.resolve();
      return new Promise((resolve) => {
        const onConnect = () => {
          socket.off('connect', onConnect);
          resolve();
        };
        socket.on('connect', onConnect);
      });
    };

    try {
      await waitForConnect();
      const raw = await socket.timeout(5000).emitWithAck(event, { ticketId });
      return parseAck(raw);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[realtime] emit failed', { event, ticketId, error });
      return { ok: false, code: 'denied' };
    }
  }, []);

  // These stay referentially stable across socket status transitions so that
  // useTicketRealtimeSubscription's effect does not re-run (and re-emit
  // subscribe/unsubscribe) every time the connection status changes.
  const subscribeTicket = useCallback(
    (ticketId: string) => {
      subscribedTicketsRef.current.add(ticketId);
      return emitWithAck(realtimeClientEvents.ticketSubscribe, ticketId);
    },
    [emitWithAck],
  );

  const unsubscribeTicket = useCallback(
    (ticketId: string) => {
      subscribedTicketsRef.current.delete(ticketId);
      return emitWithAck(realtimeClientEvents.ticketUnsubscribe, ticketId);
    },
    [emitWithAck],
  );

  const subscribeTicketStaff = useCallback(
    (ticketId: string) => {
      subscribedStaffRef.current.add(ticketId);
      return emitWithAck(realtimeClientEvents.ticketSubscribeStaff, ticketId);
    },
    [emitWithAck],
  );

  const unsubscribeTicketStaff = useCallback(
    (ticketId: string) => {
      subscribedStaffRef.current.delete(ticketId);
      return emitWithAck(realtimeClientEvents.ticketUnsubscribeStaff, ticketId);
    },
    [emitWithAck],
  );

  const value = useMemo<RealtimeContextValue>(
    () => ({
      status,
      subscribeTicket,
      unsubscribeTicket,
      subscribeTicketStaff,
      unsubscribeTicketStaff,
    }),
    [
      status,
      subscribeTicket,
      unsubscribeTicket,
      subscribeTicketStaff,
      unsubscribeTicketStaff,
    ],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtimeContext = (): RealtimeContextValue =>
  useContext(RealtimeContext);
