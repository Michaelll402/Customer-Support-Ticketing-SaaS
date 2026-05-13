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

    const handleConnect = () => setStatus('connected');
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
    };

    const handleTicketUpdated = (raw: unknown) => {
      const parsed = ticketUpdatedPayloadSchema.safeParse(raw);
      if (!parsed.success) return;
      const ticketId = parsed.data.id;
      void queryClient.invalidateQueries({
        queryKey: ['tickets', 'detail', ticketId],
      });
      void queryClient.invalidateQueries({ queryKey: ['tickets', 'list'] });
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

  const value = useMemo<RealtimeContextValue>(
    () => ({
      status,
      subscribeTicket: (ticketId) =>
        emitWithAck(realtimeClientEvents.ticketSubscribe, ticketId),
      unsubscribeTicket: (ticketId) =>
        emitWithAck(realtimeClientEvents.ticketUnsubscribe, ticketId),
      subscribeTicketStaff: (ticketId) =>
        emitWithAck(realtimeClientEvents.ticketSubscribeStaff, ticketId),
      unsubscribeTicketStaff: (ticketId) =>
        emitWithAck(realtimeClientEvents.ticketUnsubscribeStaff, ticketId),
    }),
    [emitWithAck, status],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtimeContext = (): RealtimeContextValue =>
  useContext(RealtimeContext);
