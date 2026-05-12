import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  REALTIME_EVENTS,
  ticketRoom,
  ticketStaffRoom,
  userRoom,
} from './realtime.constants';
import { RealtimeGateway } from './realtime.gateway';
import type {
  NotificationCreatedPayload,
  TicketMessageCreatedPayload,
  TicketUpdatedPayload,
} from './realtime.types';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(
    @Inject(RealtimeGateway) private readonly gateway: RealtimeGateway,
  ) {}

  emitNotificationCreated(
    userId: string,
    payload: NotificationCreatedPayload,
  ): void {
    this.safeEmit(
      userRoom(userId),
      REALTIME_EVENTS.notificationCreated,
      payload,
    );
  }

  emitTicketUpdated(ticketId: string, payload: TicketUpdatedPayload): void {
    this.safeEmit(ticketRoom(ticketId), REALTIME_EVENTS.ticketUpdated, payload);
  }

  emitTicketMessageCreatedPublic(
    ticketId: string,
    payload: TicketMessageCreatedPayload,
  ): void {
    this.safeEmit(
      ticketRoom(ticketId),
      REALTIME_EVENTS.ticketMessageCreatedPublic,
      payload,
    );
  }

  emitTicketMessageCreatedInternal(
    ticketId: string,
    payload: TicketMessageCreatedPayload,
  ): void {
    this.safeEmit(
      ticketStaffRoom(ticketId),
      REALTIME_EVENTS.ticketMessageCreatedInternal,
      payload,
    );
  }

  private safeEmit(room: string, event: string, payload: unknown): void {
    try {
      const server = this.gateway.server;
      if (!server) {
        this.logger.warn({
          event: 'realtime.emit_skipped',
          reason: 'server_unavailable',
          wsEvent: event,
        });
        return;
      }
      server.to(room).emit(event, payload);
    } catch (error) {
      this.logger.error({
        event: 'realtime.emit_failed',
        error: error instanceof Error ? error.message : String(error),
        wsEvent: event,
      });
    }
  }
}
