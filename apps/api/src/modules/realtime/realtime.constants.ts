export const REALTIME_EVENTS = {
  notificationCreated: 'notification.created',
  ticketUpdated: 'ticket.updated',
  ticketMessageCreatedPublic: 'ticket.message.created.public',
  ticketMessageCreatedInternal: 'ticket.message.created.internal',
} as const;

export const userRoom = (userId: string): string => `user:${userId}`;
export const ticketRoom = (ticketId: string): string => `ticket:${ticketId}`;
export const ticketStaffRoom = (ticketId: string): string =>
  `ticket:${ticketId}:staff`;
