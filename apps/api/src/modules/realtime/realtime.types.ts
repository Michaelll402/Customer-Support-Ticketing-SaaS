import type {
  NotificationType,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';

export type NotificationCreatedPayload = {
  id: string;
  type: NotificationType;
  ticketId: string | null;
  message: string;
  isRead: boolean;
  createdAt: Date;
};

export type TicketUpdatedPayload = {
  id: string;
  number: number;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId: string | null;
  teamId: string | null;
  categoryId: string | null;
  tagIds: string[];
  updatedAt: Date;
};

export type TicketMessageCreatedPayload = {
  id: string;
  ticketId: string;
  authorId: string;
  isInternal: boolean;
  createdAt: Date;
};

export type SubscribeAck =
  | { ok: true }
  | { ok: false; code: 'denied' | 'not_found' | 'invalid_payload' };
