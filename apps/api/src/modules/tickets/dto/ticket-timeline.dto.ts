import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketEventType } from '@prisma/client';

import type {
  TicketTimelineEventRecord,
  TicketTimelineMessageRecord,
} from '../tickets.service';
import { TicketAttachmentDto } from './ticket-attachment.dto';

enum TicketTimelineItemType {
  PUBLIC_REPLY = 'PUBLIC_REPLY',
  INTERNAL_NOTE = 'INTERNAL_NOTE',
  SYSTEM_EVENT = 'SYSTEM_EVENT',
}

class TicketTimelineUserSummaryDto {
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    example: 'agent@example.test',
  })
  email!: string;

  @ApiProperty({
    example: 'Avery',
  })
  firstName!: string;

  @ApiProperty({
    example: 'Agent',
  })
  lastName!: string;
}

class TicketTimelineMessageItemDto {
  @ApiProperty({
    enum: [
      TicketTimelineItemType.PUBLIC_REPLY,
      TicketTimelineItemType.INTERNAL_NOTE,
    ],
    example: TicketTimelineItemType.PUBLIC_REPLY,
  })
  type!:
    | TicketTimelineItemType.PUBLIC_REPLY
    | TicketTimelineItemType.INTERNAL_NOTE;

  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    format: 'uuid',
  })
  ticketId!: string;

  @ApiProperty({
    type: TicketTimelineUserSummaryDto,
  })
  author!: TicketTimelineUserSummaryDto;

  @ApiProperty({
    example:
      'Thanks for the context. I can reproduce this issue and will keep the investigation here.',
  })
  body!: string;

  @ApiProperty({
    description:
      'true for staff-only internal notes; false for customer-visible public replies.',
  })
  isInternal!: boolean;

  @ApiProperty({
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({
    format: 'date-time',
  })
  updatedAt!: Date;

  @ApiProperty({
    description:
      'Safe attachment metadata linked to this message timeline item.',
    isArray: true,
    type: TicketAttachmentDto,
  })
  attachments!: TicketAttachmentDto[];
}

class TicketTimelineSystemEventItemDto {
  @ApiProperty({
    enum: [TicketTimelineItemType.SYSTEM_EVENT],
    example: TicketTimelineItemType.SYSTEM_EVENT,
  })
  type!: TicketTimelineItemType.SYSTEM_EVENT;

  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    format: 'uuid',
  })
  ticketId!: string;

  @ApiProperty({
    enum: TicketEventType,
    example: TicketEventType.CREATED,
  })
  eventType!: TicketEventType;

  @ApiPropertyOptional({
    type: TicketTimelineUserSummaryDto,
  })
  actor!: TicketTimelineUserSummaryDto | null;

  @ApiPropertyOptional({
    nullable: true,
    type: Object,
  })
  metadata!: unknown;

  @ApiProperty({
    format: 'date-time',
  })
  createdAt!: Date;
}

type TicketTimelineItemDto =
  | TicketTimelineMessageItemDto
  | TicketTimelineSystemEventItemDto;

export class TicketTimelineDto {
  @ApiProperty({
    format: 'uuid',
  })
  ticketId!: string;

  @ApiProperty({
    description:
      'Chronological timeline entries. Message items use PUBLIC_REPLY or INTERNAL_NOTE; ticket events use SYSTEM_EVENT.',
    isArray: true,
    oneOf: [
      { type: 'object', title: 'TicketTimelineMessageItem' },
      { type: 'object', title: 'TicketTimelineSystemEventItem' },
    ],
  })
  items!: TicketTimelineItemDto[];

  static fromRecords(
    ticketId: string,
    messages: TicketTimelineMessageRecord[],
    events: TicketTimelineEventRecord[],
  ): TicketTimelineDto {
    const messageItems: TicketTimelineMessageItemDto[] = messages.map(
      (message) => ({
        type: message.isInternal
          ? TicketTimelineItemType.INTERNAL_NOTE
          : TicketTimelineItemType.PUBLIC_REPLY,
        id: message.id,
        ticketId: message.ticketId,
        author: {
          id: message.author.id,
          email: message.author.email,
          firstName: message.author.firstName,
          lastName: message.author.lastName,
        },
        body: message.body,
        isInternal: message.isInternal,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        attachments: message.attachments.map((attachment) =>
          TicketAttachmentDto.fromRecord(attachment),
        ),
      }),
    );

    const eventItems: TicketTimelineSystemEventItemDto[] = events.map(
      (event) => ({
        type: TicketTimelineItemType.SYSTEM_EVENT,
        id: event.id,
        ticketId: event.ticketId,
        eventType: event.type,
        actor: event.actor
          ? {
              id: event.actor.id,
              email: event.actor.email,
              firstName: event.actor.firstName,
              lastName: event.actor.lastName,
            }
          : null,
        metadata: event.metadata,
        createdAt: event.createdAt,
      }),
    );

    const items = [...messageItems, ...eventItems].sort((left, right) => {
      const dateComparison =
        left.createdAt.getTime() - right.createdAt.getTime();

      if (dateComparison !== 0) {
        return dateComparison;
      }

      return left.id.localeCompare(right.id);
    });

    return {
      ticketId,
      items,
    };
  }
}
