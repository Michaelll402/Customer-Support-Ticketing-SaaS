import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority } from '@prisma/client';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateTicketDto {
  @ApiProperty({
    example: 'Checkout flow returns a 500 error',
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiProperty({
    example:
      'The customer receives a 500 response on the final checkout step after confirming their shipping address.',
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({
    enum: TicketPriority,
    example: TicketPriority.HIGH,
  })
  @IsEnum(TicketPriority)
  priority!: TicketPriority;

  @ApiPropertyOptional({
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
