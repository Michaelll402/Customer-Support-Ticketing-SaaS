import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SlaTargetState,
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

  @ApiPropertyOptional({
    description:
      'Email address. Omitted for staff users in customer-facing responses so staff contact details are not exposed.',
    example: 'customer@example.test',
  })
  email?: string;

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
    description:
      'First-response SLA due date. Staff-only; omitted from customer responses.',
    format: 'date-time',
  })
  firstResponseDueAt?: Date | null;

  @ApiPropertyOptional({
    description:
      'Resolution SLA due date. Staff-only; omitted from customer responses.',
    format: 'date-time',
  })
  resolutionDueAt?: Date | null;

  @ApiPropertyOptional({
    description: 'When the first staff response occurred. Staff-only.',
    format: 'date-time',
  })
  firstRespondedAt?: Date | null;

  @ApiPropertyOptional({
    description: 'When the ticket was resolved or closed. Staff-only.',
    format: 'date-time',
  })
  resolvedAt?: Date | null;

  @ApiPropertyOptional({
    description: 'First-response SLA state. Staff-only.',
    enum: SlaTargetState,
  })
  firstResponseState?: SlaTargetState;

  @ApiPropertyOptional({
    description: 'Resolution SLA state. Staff-only.',
    enum: SlaTargetState,
  })
  resolutionState?: SlaTargetState;

  @ApiPropertyOptional({
    description: 'Identifier of the applied SLA plan. Staff-only.',
    format: 'uuid',
  })
  slaPlanId?: string | null;

  @ApiProperty({
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({
    format: 'date-time',
  })
  updatedAt!: Date;

  static fromRecord(
    record: TicketDetailRecord,
    includeStaffFields = true,
  ): TicketDetailDto {
    return {
      id: record.id,
      number: record.number,
      subject: record.subject,
      description: record.description,
      status: record.status,
      priority: record.priority,
      requester: {
        id: record.requester.id,
        // The requester is always the ticket owner, so returning their own
        // email is not a staff-PII disclosure.
        email: record.requester.email,
        firstName: record.requester.firstName,
        lastName: record.requester.lastName,
      },
      assignee: record.assignee
        ? {
            id: record.assignee.id,
            firstName: record.assignee.firstName,
            lastName: record.assignee.lastName,
            ...(includeStaffFields ? { email: record.assignee.email } : {}),
          }
        : null,
      team: record.team ? TicketTeamSummaryDto.fromTeam(record.team) : null,
      category: record.category
        ? TicketCategorySummaryDto.fromCategory(record.category)
        : null,
      tags: record.tags.map((entry) => TicketTagSummaryDto.fromTag(entry.tag)),
      // SLA fields are operational and staff-only; customers receive none of
      // them (fail-closed: a customer response simply omits these keys).
      ...(includeStaffFields
        ? {
            firstResponseDueAt: record.firstResponseDueAt,
            resolutionDueAt: record.resolutionDueAt,
            firstRespondedAt: record.firstRespondedAt,
            resolvedAt: record.resolvedAt,
            firstResponseState: record.firstResponseState,
            resolutionState: record.resolutionState,
            slaPlanId: record.slaPlanId,
          }
        : {}),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
