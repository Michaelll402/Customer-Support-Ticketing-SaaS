import { ApiProperty } from '@nestjs/swagger';

import { TicketAttachmentDto } from './ticket-attachment.dto';
import type { TicketMessageRecord } from '../tickets.service';

class TicketMessageAuthorDto {
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

export class TicketMessageDto {
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    format: 'uuid',
  })
  ticketId!: string;

  @ApiProperty({
    type: TicketMessageAuthorDto,
  })
  author!: TicketMessageAuthorDto;

  @ApiProperty({
    example:
      'Thanks for the context. I can reproduce this issue and will keep the investigation here.',
  })
  body!: string;

  @ApiProperty({
    description:
      'true means staff-only internal note; false means customer-visible public reply.',
    example: false,
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
      'Safe attachment metadata linked to this message. Object storage keys are never exposed.',
    isArray: true,
    type: TicketAttachmentDto,
  })
  attachments!: TicketAttachmentDto[];

  static fromRecord(record: TicketMessageRecord): TicketMessageDto {
    return {
      id: record.id,
      ticketId: record.ticketId,
      author: {
        id: record.author.id,
        email: record.author.email,
        firstName: record.author.firstName,
        lastName: record.author.lastName,
      },
      body: record.body,
      isInternal: record.isInternal,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      attachments: record.attachments.map((attachment) =>
        TicketAttachmentDto.fromRecord(attachment),
      ),
    };
  }
}
