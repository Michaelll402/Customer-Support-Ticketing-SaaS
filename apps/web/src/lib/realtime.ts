import { z } from 'zod';

import { webEnv } from '@/lib/env';
import { notificationTypeSchema } from '@/lib/notifications';

export const realtimeEvents = {
  notificationCreated: 'notification.created',
  ticketUpdated: 'ticket.updated',
  ticketMessageCreatedPublic: 'ticket.message.created.public',
  ticketMessageCreatedInternal: 'ticket.message.created.internal',
} as const;

export const realtimeClientEvents = {
  ticketSubscribe: 'ticket.subscribe',
  ticketUnsubscribe: 'ticket.unsubscribe',
  ticketSubscribeStaff: 'ticket.subscribe.staff',
  ticketUnsubscribeStaff: 'ticket.unsubscribe.staff',
} as const;

const ticketStatusSchema = z.enum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']);

const ticketPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export const notificationCreatedPayloadSchema = z.object({
  id: z.string().min(1),
  type: notificationTypeSchema,
  ticketId: z.string().min(1).nullable(),
  message: z.string(),
  isRead: z.boolean(),
  createdAt: z.string(),
});

export type NotificationCreatedPayload = z.infer<
  typeof notificationCreatedPayloadSchema
>;

export const ticketUpdatedPayloadSchema = z.object({
  id: z.string().min(1),
  number: z.number().int(),
  status: ticketStatusSchema,
  priority: ticketPrioritySchema,
  assigneeId: z.string().min(1).nullable(),
  teamId: z.string().min(1).nullable(),
  categoryId: z.string().min(1).nullable(),
  tagIds: z.array(z.string().min(1)),
  updatedAt: z.string(),
});

export type TicketUpdatedPayload = z.infer<typeof ticketUpdatedPayloadSchema>;

export const ticketMessageCreatedPayloadSchema = z.object({
  id: z.string().min(1),
  ticketId: z.string().min(1),
  authorId: z.string().min(1),
  isInternal: z.boolean(),
  createdAt: z.string(),
});

export type TicketMessageCreatedPayload = z.infer<
  typeof ticketMessageCreatedPayloadSchema
>;

export const subscribeAckSchema = z.union([
  z.object({ ok: z.literal(true) }),
  z.object({
    ok: z.literal(false),
    code: z.enum(['denied', 'not_found', 'invalid_payload']),
  }),
]);

export type SubscribeAck = z.infer<typeof subscribeAckSchema>;

export type RealtimeStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export const getRealtimeSocketUrl = (): string => {
  const url = new URL(webEnv.NEXT_PUBLIC_API_BASE_URL);
  return url.origin;
};
