import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Team } from '@prisma/client';

export class TicketTeamOptionDto {
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    example: 'Technical Support',
  })
  name!: string;

  @ApiPropertyOptional({
    example: 'Primary queue for platform issues and troubleshooting.',
  })
  description!: string | null;

  static fromTeam(team: Team): TicketTeamOptionDto {
    return {
      id: team.id,
      name: team.name,
      description: team.description,
    };
  }
}
