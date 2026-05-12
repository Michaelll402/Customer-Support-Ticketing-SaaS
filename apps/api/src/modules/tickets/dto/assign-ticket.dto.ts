import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsUUID, ValidateIf } from 'class-validator';

export class AssignTicketDto {
  @ApiProperty({
    description: 'New assignee user ID, or null to unassign.',
    format: 'uuid',
    nullable: true,
    type: String,
  })
  @IsDefined()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assigneeId!: string | null;
}
