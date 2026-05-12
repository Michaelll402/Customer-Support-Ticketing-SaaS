import { ApiProperty } from '@nestjs/swagger';

import { NotificationDto } from './notification.dto';

export class NotificationListResponseDto {
  @ApiProperty({
    type: [NotificationDto],
  })
  items!: NotificationDto[];

  @ApiProperty({
    example: 42,
  })
  total!: number;

  @ApiProperty({
    description: 'Total unread notification count for the authenticated user.',
    example: 5,
  })
  unreadCount!: number;

  @ApiProperty({
    example: 1,
  })
  page!: number;

  @ApiProperty({
    example: 20,
  })
  limit!: number;

  @ApiProperty({
    example: 3,
  })
  totalPages!: number;

  @ApiProperty({
    example: true,
  })
  hasNextPage!: boolean;

  @ApiProperty({
    example: false,
  })
  hasPreviousPage!: boolean;
}
