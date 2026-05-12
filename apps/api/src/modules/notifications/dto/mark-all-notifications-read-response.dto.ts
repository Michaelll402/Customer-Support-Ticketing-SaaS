import { ApiProperty } from '@nestjs/swagger';

export class MarkAllNotificationsReadResponseDto {
  @ApiProperty({
    description:
      'Number of notifications that transitioned from unread to read for the authenticated user.',
    example: 5,
  })
  updatedCount!: number;
}
