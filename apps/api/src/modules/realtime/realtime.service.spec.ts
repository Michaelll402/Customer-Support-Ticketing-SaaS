import 'reflect-metadata';

import { NotificationType, TicketPriority, TicketStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  REALTIME_EVENTS,
  ticketRoom,
  ticketStaffRoom,
  userRoom,
} from './realtime.constants';
import type { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

describe('RealtimeService', () => {
  let emit: ReturnType<typeof vi.fn>;
  let to: ReturnType<typeof vi.fn>;
  let server: { to: typeof to };
  let gateway: RealtimeGateway;
  let service: RealtimeService;

  beforeEach(() => {
    emit = vi.fn();
    to = vi.fn().mockReturnValue({ emit });
    server = { to };
    gateway = { server } as unknown as RealtimeGateway;
    service = new RealtimeService(gateway);
  });

  it('emits notification.created to the user room', () => {
    service.emitNotificationCreated('user-1', {
      createdAt: new Date(),
      id: 'notif-1',
      isRead: false,
      message: 'm',
      ticketId: null,
      type: NotificationType.TICKET_REPLIED,
    });

    expect(to).toHaveBeenCalledWith(userRoom('user-1'));
    expect(emit).toHaveBeenCalledWith(
      REALTIME_EVENTS.notificationCreated,
      expect.objectContaining({ id: 'notif-1' }),
    );
  });

  it('emits ticket.updated to the ticket room', () => {
    service.emitTicketUpdated('ticket-1', {
      assigneeId: null,
      categoryId: null,
      id: 'ticket-1',
      number: 42,
      priority: TicketPriority.HIGH,
      status: TicketStatus.OPEN,
      tagIds: [],
      teamId: null,
      updatedAt: new Date(),
    });

    expect(to).toHaveBeenCalledWith(ticketRoom('ticket-1'));
    expect(emit).toHaveBeenCalledWith(
      REALTIME_EVENTS.ticketUpdated,
      expect.objectContaining({ id: 'ticket-1' }),
    );
  });

  it('routes internal-message events only to the staff sub-room', () => {
    service.emitTicketMessageCreatedInternal('ticket-1', {
      authorId: 'author-1',
      createdAt: new Date(),
      id: 'msg-1',
      isInternal: true,
      ticketId: 'ticket-1',
    });

    expect(to).toHaveBeenCalledWith(ticketStaffRoom('ticket-1'));
    expect(emit).toHaveBeenCalledWith(
      REALTIME_EVENTS.ticketMessageCreatedInternal,
      expect.objectContaining({ isInternal: true }),
    );
  });

  it('routes public-message events to the ticket room (not the staff sub-room)', () => {
    service.emitTicketMessageCreatedPublic('ticket-1', {
      authorId: 'author-1',
      createdAt: new Date(),
      id: 'msg-2',
      isInternal: false,
      ticketId: 'ticket-1',
    });

    expect(to).toHaveBeenCalledWith(ticketRoom('ticket-1'));
    expect(emit).toHaveBeenCalledWith(
      REALTIME_EVENTS.ticketMessageCreatedPublic,
      expect.objectContaining({ isInternal: false }),
    );
  });

  it('silently swallows emit errors so callers are unaffected', () => {
    to.mockImplementationOnce(() => {
      throw new Error('socket server down');
    });

    expect(() =>
      service.emitTicketUpdated('ticket-1', {
        assigneeId: null,
        categoryId: null,
        id: 'ticket-1',
        number: 42,
        priority: TicketPriority.HIGH,
        status: TicketStatus.OPEN,
        tagIds: [],
        teamId: null,
        updatedAt: new Date(),
      }),
    ).not.toThrow();
  });

  it('logs and skips when the gateway server is unavailable', () => {
    const noServerService = new RealtimeService({
      server: undefined,
    } as unknown as RealtimeGateway);

    expect(() =>
      noServerService.emitNotificationCreated('user-1', {
        createdAt: new Date(),
        id: 'notif-1',
        isRead: false,
        message: 'm',
        ticketId: null,
        type: NotificationType.TICKET_REPLIED,
      }),
    ).not.toThrow();
  });
});
