import { z } from 'zod';

import { apiRequest } from '@/lib/api';

// Keep in lockstep with the backend Prisma `NotificationType` enum. A value the
// schema does not list makes the whole notifications response fail to parse.
export const notificationTypeSchema = z.enum([
  'TICKET_ASSIGNED',
  'TICKET_REPLIED',
  'STATUS_CHANGED',
  'NOTE_ADDED',
  'SLA_AT_RISK',
  'SLA_BREACHED',
  'ASSIGNMENT_REQUEST_CREATED',
  'ASSIGNMENT_REQUEST_APPROVED',
  'ASSIGNMENT_REQUEST_REJECTED',
]);

export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationItemSchema = z.object({
  id: z.string().min(1),
  type: notificationTypeSchema,
  ticketId: z.string().min(1).nullable(),
  message: z.string(),
  isRead: z.boolean(),
  createdAt: z.string().datetime(),
});

export type NotificationItem = z.infer<typeof notificationItemSchema>;

export const notificationListResponseSchema = z.object({
  items: z.array(notificationItemSchema),
  total: z.number().int().min(0),
  unreadCount: z.number().int().min(0),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  totalPages: z.number().int().min(0),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export type NotificationListResponse = z.infer<
  typeof notificationListResponseSchema
>;

export const markAllNotificationsReadResponseSchema = z.object({
  updatedCount: z.number().int().min(0),
});

export type MarkAllNotificationsReadResponse = z.infer<
  typeof markAllNotificationsReadResponseSchema
>;

export interface NotificationListQuery {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export const getNotifications = async (
  query: NotificationListQuery = {},
): Promise<NotificationListResponse> => {
  const params = new URLSearchParams();

  if (query.page !== undefined) {
    params.set('page', String(query.page));
  }

  if (query.limit !== undefined) {
    params.set('limit', String(query.limit));
  }

  if (query.unreadOnly !== undefined) {
    params.set('unreadOnly', String(query.unreadOnly));
  }

  const queryString = params.toString();
  const path = queryString ? `/notifications?${queryString}` : '/notifications';

  const response = await apiRequest<NotificationListResponse>(path, {
    cache: 'no-store',
  });

  return notificationListResponseSchema.parse(response);
};

export const markNotificationRead = async (notificationId: string) => {
  const response = await apiRequest<NotificationItem>(
    `/notifications/${notificationId}/read`,
    {
      method: 'PATCH',
      cache: 'no-store',
    },
  );

  return notificationItemSchema.parse(response);
};

export const markAllNotificationsRead = async () => {
  const response = await apiRequest<MarkAllNotificationsReadResponse>(
    `/notifications/read-all`,
    {
      method: 'PATCH',
      cache: 'no-store',
    },
  );

  return markAllNotificationsReadResponseSchema.parse(response);
};

export const notificationTypeLabels: Record<NotificationType, string> = {
  NOTE_ADDED: 'Internal note',
  SLA_AT_RISK: 'SLA at risk',
  SLA_BREACHED: 'SLA breached',
  STATUS_CHANGED: 'Status',
  TICKET_ASSIGNED: 'Assigned',
  TICKET_REPLIED: 'Reply',
  ASSIGNMENT_REQUEST_CREATED: 'Reassign request',
  ASSIGNMENT_REQUEST_APPROVED: 'Request approved',
  ASSIGNMENT_REQUEST_REJECTED: 'Request declined',
};
