import type { NotificationType } from '@prisma/client';

export const NOTIFICATIONS_QUEUE_NAME = 'notifications';
export const NOTIFICATIONS_JOB_NAME = 'notifications.create';

export type NotificationJobPayload = {
  type: NotificationType;
  recipientUserIds: string[];
  ticketId?: string | null;
  message: string;
  source?: {
    actorId?: string;
    eventType?: string;
    eventId?: string;
  };
};
