import { ApiProperty } from '@nestjs/swagger';
import { TicketPriority } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateTicketPriorityDto {
  @ApiProperty({
    enum: TicketPriority,
    example: TicketPriority.HIGH,
  })
  @IsEnum(TicketPriority)
  priority!: TicketPriority;
}
