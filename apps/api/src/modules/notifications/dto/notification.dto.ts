import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType, type Notification } from '@prisma/client';

export class NotificationDto {
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    enum: NotificationType,
    example: NotificationType.TICKET_REPLIED,
  })
  type!: NotificationType;

  @ApiPropertyOptional({
    format: 'uuid',
  })
  ticketId!: string | null;

  @ApiProperty({
    example: 'Casey Customer replied to ticket #1003.',
  })
  message!: string;

  @ApiProperty({
    example: false,
  })
  isRead!: boolean;

  @ApiProperty({
    format: 'date-time',
  })
  createdAt!: Date;

  static fromRecord(record: Notification): NotificationDto {
    return {
      id: record.id,
      type: record.type,
      ticketId: record.ticketId,
      message: record.message,
      isRead: record.isRead,
      createdAt: record.createdAt,
    };
  }
}
