import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateTicketDto {
  @ApiPropertyOptional({
    example: 'Checkout flow still fails for saved cards',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  subject?: string;

  @ApiPropertyOptional({
    example:
      'The customer now sees a 500 error only when using saved cards, while new cards work correctly.',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  description?: string;

  @ApiPropertyOptional({
    enum: TicketStatus,
    description:
      'Customers may only close their own ticket or reopen a closed one.',
    example: TicketStatus.CLOSED,
  })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;
}
