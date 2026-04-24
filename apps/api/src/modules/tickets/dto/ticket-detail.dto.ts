import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TicketPriority,
  TicketStatus,
  type Category,
  type Tag,
  type Team,
} from '@prisma/client';

import type { TicketDetailRecord } from '../tickets.service';

class TicketUserSummaryDto {
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    example: 'customer@example.test',
  })
  email!: string;

  @ApiProperty({
    example: 'Casey',
  })
  firstName!: string;

  @ApiProperty({
    example: 'Customer',
  })
  lastName!: string;
}

class TicketTeamSummaryDto {
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

  static fromTeam(team: Team): TicketTeamSummaryDto {
    return {
      id: team.id,
      name: team.name,
      description: team.description,
    };
  }
}

class TicketCategorySummaryDto {
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

  static fromCategory(category: Category): TicketCategorySummaryDto {
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      color: category.color,
    };
  }
}

class TicketTagSummaryDto {
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

  static fromTag(tag: Tag): TicketTagSummaryDto {
    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
    };
  }
}

export class TicketDetailDto {
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    example: 1001,
  })
  number!: number;

  @ApiProperty({
    example: 'Checkout flow returns a 500 error',
  })
  subject!: string;

  @ApiProperty({
    example:
      'The customer receives a 500 response on the final checkout step after confirming their shipping address.',
  })
  description!: string;

  @ApiProperty({
    enum: TicketStatus,
    example: TicketStatus.OPEN,
  })
  status!: TicketStatus;

  @ApiProperty({
    enum: TicketPriority,
    example: TicketPriority.HIGH,
  })
  priority!: TicketPriority;

  @ApiProperty({
    type: TicketUserSummaryDto,
  })
  requester!: TicketUserSummaryDto;

  @ApiPropertyOptional({
    type: TicketUserSummaryDto,
  })
  assignee!: TicketUserSummaryDto | null;

  @ApiPropertyOptional({
    type: TicketTeamSummaryDto,
  })
  team!: TicketTeamSummaryDto | null;

  @ApiPropertyOptional({
    type: TicketCategorySummaryDto,
  })
  category!: TicketCategorySummaryDto | null;

  @ApiProperty({
    type: [TicketTagSummaryDto],
  })
  tags!: TicketTagSummaryDto[];

  @ApiPropertyOptional({
    format: 'date-time',
  })
  firstResponseDueAt!: Date | null;

  @ApiPropertyOptional({
    format: 'date-time',
  })
  resolutionDueAt!: Date | null;

  @ApiProperty({
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({
    format: 'date-time',
  })
  updatedAt!: Date;

  static fromRecord(record: TicketDetailRecord): TicketDetailDto {
    return {
      id: record.id,
      number: record.number,
      subject: record.subject,
      description: record.description,
      status: record.status,
      priority: record.priority,
      requester: {
        id: record.requester.id,
        email: record.requester.email,
        firstName: record.requester.firstName,
        lastName: record.requester.lastName,
      },
      assignee: record.assignee
        ? {
            id: record.assignee.id,
            email: record.assignee.email,
            firstName: record.assignee.firstName,
            lastName: record.assignee.lastName,
          }
        : null,
      team: record.team ? TicketTeamSummaryDto.fromTeam(record.team) : null,
      category: record.category
        ? TicketCategorySummaryDto.fromCategory(record.category)
        : null,
      tags: record.tags.map((entry) => TicketTagSummaryDto.fromTag(entry.tag)),
      firstResponseDueAt: record.firstResponseDueAt,
      resolutionDueAt: record.resolutionDueAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
