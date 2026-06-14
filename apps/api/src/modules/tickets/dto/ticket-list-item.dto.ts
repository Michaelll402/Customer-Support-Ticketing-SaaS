import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SlaTargetState,
  TicketPriority,
  TicketStatus,
  type Category,
  type Team,
  type User,
} from '@prisma/client';

import type { TicketListRecord } from '../tickets.service';

class TicketListUserSummaryDto {
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiPropertyOptional({
    description:
      'Email address. Omitted from customer-facing responses so staff contact details are not exposed.',
    example: 'agent@demo.test',
  })
  email?: string;

  @ApiProperty({
    example: 'Avery',
  })
  firstName!: string;

  @ApiProperty({
    example: 'Agent',
  })
  lastName!: string;

  static fromUser(
    user: Pick<User, 'email' | 'firstName' | 'id' | 'lastName'>,
    includeEmail: boolean,
  ): TicketListUserSummaryDto {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      ...(includeEmail ? { email: user.email } : {}),
    };
  }
}

class TicketListTeamSummaryDto {
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    example: 'Technical Support',
  })
  name!: string;

  static fromTeam(team: Pick<Team, 'id' | 'name'>): TicketListTeamSummaryDto {
    return {
      id: team.id,
      name: team.name,
    };
  }
}

class TicketListCategorySummaryDto {
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    example: 'Technical Issue',
  })
  name!: string;

  static fromCategory(
    category: Pick<Category, 'id' | 'name'>,
  ): TicketListCategorySummaryDto {
    return {
      id: category.id,
      name: category.name,
    };
  }
}

export class TicketListItemDto {
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
    enum: TicketStatus,
    example: TicketStatus.OPEN,
  })
  status!: TicketStatus;

  @ApiProperty({
    enum: TicketPriority,
    example: TicketPriority.HIGH,
  })
  priority!: TicketPriority;

  @ApiPropertyOptional({
    type: TicketListUserSummaryDto,
  })
  assignee!: TicketListUserSummaryDto | null;

  @ApiPropertyOptional({
    type: TicketListTeamSummaryDto,
  })
  team!: TicketListTeamSummaryDto | null;

  @ApiPropertyOptional({
    type: TicketListCategorySummaryDto,
  })
  category!: TicketListCategorySummaryDto | null;

  @ApiPropertyOptional({
    description: 'First-response SLA state. Staff-only; omitted for customers.',
    enum: SlaTargetState,
  })
  firstResponseState?: SlaTargetState;

  @ApiPropertyOptional({
    description: 'Resolution SLA state. Staff-only; omitted for customers.',
    enum: SlaTargetState,
  })
  resolutionState?: SlaTargetState;

  @ApiPropertyOptional({
    description: 'First-response SLA due date. Staff-only.',
    format: 'date-time',
  })
  firstResponseDueAt?: Date | null;

  @ApiPropertyOptional({
    description: 'Resolution SLA due date. Staff-only.',
    format: 'date-time',
  })
  resolutionDueAt?: Date | null;

  @ApiPropertyOptional({
    description:
      'When the ticket was moved to the trash, if soft-deleted. Staff-only.',
    format: 'date-time',
  })
  deletedAt?: Date | null;

  @ApiProperty({
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({
    format: 'date-time',
  })
  updatedAt!: Date;

  static fromRecord(
    record: TicketListRecord,
    includeStaffFields = true,
  ): TicketListItemDto {
    return {
      id: record.id,
      number: record.number,
      subject: record.subject,
      status: record.status,
      priority: record.priority,
      assignee: record.assignee
        ? TicketListUserSummaryDto.fromUser(record.assignee, includeStaffFields)
        : null,
      team: record.team ? TicketListTeamSummaryDto.fromTeam(record.team) : null,
      category: record.category
        ? TicketListCategorySummaryDto.fromCategory(record.category)
        : null,
      // SLA and trash fields are staff-only; customer list rows omit them.
      ...(includeStaffFields
        ? {
            firstResponseState: record.firstResponseState,
            resolutionState: record.resolutionState,
            firstResponseDueAt: record.firstResponseDueAt,
            resolutionDueAt: record.resolutionDueAt,
            deletedAt: record.deletedAt,
          }
        : {}),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
