import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Tag } from '@prisma/client';

export class TicketTagOptionDto {
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    example: 'urgent',
  })
  name!: string;

  @ApiPropertyOptional({
    example: '#dc2626',
  })
  color!: string | null;

  static fromTag(tag: Tag): TicketTagOptionDto {
    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
    };
  }
}
