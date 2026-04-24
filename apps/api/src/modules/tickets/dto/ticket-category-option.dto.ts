import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Category } from '@prisma/client';

export class TicketCategoryOptionDto {
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    example: 'Technical Issue',
  })
  name!: string;

  @ApiPropertyOptional({
    example: 'Errors, broken flows, and technical troubleshooting requests.',
  })
  description!: string | null;

  @ApiPropertyOptional({
    example: '#2563eb',
  })
  color!: string | null;

  static fromCategory(category: Category): TicketCategoryOptionDto {
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      color: category.color,
    };
  }
}
