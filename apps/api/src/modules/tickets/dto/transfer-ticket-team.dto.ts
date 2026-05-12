import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class TransferTicketTeamDto {
  @ApiProperty({
    description: 'Destination team ID.',
    format: 'uuid',
  })
  @IsUUID()
  teamId!: string;
}
