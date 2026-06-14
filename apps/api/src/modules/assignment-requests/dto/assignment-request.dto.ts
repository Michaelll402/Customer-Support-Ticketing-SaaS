import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AssignmentRequestStatus,
  AssignmentRequestType,
  TicketStatus,
  type Ticket,
  type User,
} from '@prisma/client';

type UserSummarySource = Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;

type TicketSummarySource = Pick<
  Ticket,
  'id' | 'number' | 'subject' | 'status' | 'teamId' | 'assigneeId'
> & {
  assignee?: UserSummarySource | null;
};

/**
 * The Prisma shape this DTO maps from. Produced by the service's include.
 */
export interface AssignmentRequestRecord {
  id: string;
  ticketId: string;
  type: AssignmentRequestType;
  status: AssignmentRequestStatus;
  reason: string;
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  requestedBy: UserSummarySource;
  requestedAssignee: UserSummarySource | null;
  reviewedBy: UserSummarySource | null;
  ticket: TicketSummarySource;
}

class AssignmentRequestUserSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Avery' })
  firstName!: string;

  @ApiProperty({ example: 'Agent' })
  lastName!: string;

  @ApiProperty({ example: 'agent@demo.test' })
  email!: string;

  static fromUser(user: UserSummarySource): AssignmentRequestUserSummaryDto {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    };
  }
}

class AssignmentRequestTicketSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 1001 })
  number!: number;

  @ApiProperty({ example: 'Checkout flow returns a 500 error' })
  subject!: string;

  @ApiProperty({ enum: TicketStatus })
  status!: TicketStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  teamId!: string | null;

  @ApiPropertyOptional({ type: AssignmentRequestUserSummaryDto })
  currentAssignee!: AssignmentRequestUserSummaryDto | null;

  static fromTicket(
    ticket: TicketSummarySource,
  ): AssignmentRequestTicketSummaryDto {
    return {
      id: ticket.id,
      number: ticket.number,
      subject: ticket.subject,
      status: ticket.status,
      teamId: ticket.teamId,
      currentAssignee: ticket.assignee
        ? AssignmentRequestUserSummaryDto.fromUser(ticket.assignee)
        : null,
    };
  }
}

/**
 * Staff-only assignment-request projection. These endpoints are never exposed to
 * customers, so staff display fields (including email) are safe to include.
 */
export class AssignmentRequestDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  ticketId!: string;

  @ApiProperty({ enum: AssignmentRequestType })
  type!: AssignmentRequestType;

  @ApiProperty({ enum: AssignmentRequestStatus })
  status!: AssignmentRequestStatus;

  @ApiProperty()
  reason!: string;

  @ApiPropertyOptional({ nullable: true })
  reviewNote!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  reviewedAt!: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: AssignmentRequestTicketSummaryDto })
  ticket!: AssignmentRequestTicketSummaryDto;

  @ApiProperty({ type: AssignmentRequestUserSummaryDto })
  requestedBy!: AssignmentRequestUserSummaryDto;

  @ApiPropertyOptional({ type: AssignmentRequestUserSummaryDto })
  requestedAssignee!: AssignmentRequestUserSummaryDto | null;

  @ApiPropertyOptional({ type: AssignmentRequestUserSummaryDto })
  reviewedBy!: AssignmentRequestUserSummaryDto | null;

  static fromRecord(record: AssignmentRequestRecord): AssignmentRequestDto {
    return {
      id: record.id,
      ticketId: record.ticketId,
      type: record.type,
      status: record.status,
      reason: record.reason,
      reviewNote: record.reviewNote,
      reviewedAt: record.reviewedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      ticket: AssignmentRequestTicketSummaryDto.fromTicket(record.ticket),
      requestedBy: AssignmentRequestUserSummaryDto.fromUser(record.requestedBy),
      requestedAssignee: record.requestedAssignee
        ? AssignmentRequestUserSummaryDto.fromUser(record.requestedAssignee)
        : null,
      reviewedBy: record.reviewedBy
        ? AssignmentRequestUserSummaryDto.fromUser(record.reviewedBy)
        : null,
    };
  }
}
