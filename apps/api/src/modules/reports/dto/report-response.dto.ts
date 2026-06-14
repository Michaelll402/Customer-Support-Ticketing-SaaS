import { ApiProperty } from '@nestjs/swagger';
import type {
  AssignmentRequestType,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';

export type StatusCounts = Record<TicketStatus, number>;
export type PriorityCounts = Record<TicketPriority, number>;
export type AssignmentRequestTypeCounts = Record<AssignmentRequestType, number>;

const numberMap = {
  type: 'object',
  additionalProperties: { type: 'number' },
} as const;

export class SlaSummaryDto {
  @ApiProperty() onTrack!: number;
  @ApiProperty() atRisk!: number;
  @ApiProperty() breached!: number;
  @ApiProperty() met!: number;
  @ApiProperty({ description: 'Targets with a non-null due date.' })
  applicableTotal!: number;
  @ApiProperty({ description: 'MET + BREACHED.' })
  completedTotal!: number;
  @ApiProperty({
    nullable: true,
    description: 'MET / completedTotal × 100, rounded to 1 dp; null if zero.',
  })
  metPercentage!: number | null;
}

export class ReportOverviewDto {
  @ApiProperty() windowDays!: number;
  @ApiProperty({ format: 'date-time' }) windowStart!: string;
  @ApiProperty({ format: 'date-time' }) generatedAt!: string;
  @ApiProperty() ticketsCreatedInWindow!: number;
  @ApiProperty() resolvedInWindow!: number;
  @ApiProperty({ description: 'Current OPEN + PENDING in scope.' })
  currentlyOpen!: number;
  @ApiProperty() currentlyUnassigned!: number;
  @ApiProperty(numberMap) countsByStatus!: StatusCounts;
  @ApiProperty(numberMap) countsByPriority!: PriorityCounts;
  @ApiProperty({ type: SlaSummaryDto }) firstResponseSla!: SlaSummaryDto;
  @ApiProperty({ type: SlaSummaryDto }) resolutionSla!: SlaSummaryDto;
}

export class ReportQueueTeamBreakdownDto {
  @ApiProperty({ format: 'uuid', nullable: true })
  teamId!: string | null;
  @ApiProperty() teamName!: string;
  @ApiProperty() openCount!: number;
  @ApiProperty() unassignedCount!: number;
  @ApiProperty() atRiskCount!: number;
  @ApiProperty() breachedCount!: number;
}

export class ReportQueueDto {
  @ApiProperty({ format: 'date-time' }) generatedAt!: string;
  @ApiProperty() totalOpen!: number;
  @ApiProperty() unassigned!: number;
  @ApiProperty() assigned!: number;
  @ApiProperty({ nullable: true })
  oldestOpenAgeMinutes!: number | null;
  @ApiProperty(numberMap) countsByStatus!: StatusCounts;
  @ApiProperty(numberMap) countsByPriority!: PriorityCounts;
  @ApiProperty({
    description:
      'Open tickets with any AT_RISK target (first response or resolution).',
  })
  atRiskCount!: number;
  @ApiProperty({
    description: 'Open tickets with any BREACHED target.',
  })
  breachedCount!: number;
  @ApiProperty({ type: [ReportQueueTeamBreakdownDto] })
  teams!: ReportQueueTeamBreakdownDto[];
}

export class AgentTeamSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
}

export class AgentMetricRowDto {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() role!: string;
  @ApiProperty({ type: [AgentTeamSummaryDto] })
  teams!: AgentTeamSummaryDto[];
  @ApiProperty() currentlyAssignedOpen!: number;
  @ApiProperty() resolvedInWindow!: number;
  @ApiProperty({ nullable: true })
  averageFirstResponseMinutes!: number | null;
  @ApiProperty({ nullable: true })
  averageResolutionMinutes!: number | null;
  @ApiProperty() firstResponseCompleted!: number;
  @ApiProperty() firstResponseMet!: number;
  @ApiProperty({ nullable: true })
  firstResponseMetPercentage!: number | null;
  @ApiProperty() resolutionCompleted!: number;
  @ApiProperty() resolutionMet!: number;
  @ApiProperty({ nullable: true })
  resolutionMetPercentage!: number | null;
  @ApiProperty() assignedAtRisk!: number;
  @ApiProperty() assignedBreached!: number;
}

export class ReportAgentMetricsDto {
  @ApiProperty({ format: 'date-time' }) generatedAt!: string;
  @ApiProperty() windowDays!: number;
  @ApiProperty({ format: 'date-time' }) windowStart!: string;
  @ApiProperty({ type: [AgentMetricRowDto] })
  agents!: AgentMetricRowDto[];
}

export class SlaCompletionDto {
  @ApiProperty() completed!: number;
  @ApiProperty() met!: number;
  @ApiProperty({ nullable: true })
  metPercentage!: number | null;
}

export class ReportMeDto {
  @ApiProperty({ format: 'date-time' }) generatedAt!: string;
  @ApiProperty() windowDays!: number;
  @ApiProperty({ format: 'date-time' }) windowStart!: string;
  @ApiProperty() currentlyAssignedOpen!: number;
  @ApiProperty() resolvedInWindow!: number;
  @ApiProperty({ nullable: true })
  averageFirstResponseMinutes!: number | null;
  @ApiProperty({ nullable: true })
  averageResolutionMinutes!: number | null;
  @ApiProperty({ type: SlaCompletionDto })
  firstResponseSla!: SlaCompletionDto;
  @ApiProperty({ type: SlaCompletionDto })
  resolutionSla!: SlaCompletionDto;
  @ApiProperty() assignedAtRisk!: number;
  @ApiProperty() assignedBreached!: number;
  @ApiProperty() pendingAssignmentRequestsCreatedByMe!: number;
  @ApiProperty({
    nullable: true,
    description:
      'PENDING requests in the reviewer scope; null for plain agents.',
  })
  pendingAssignmentRequestsAwaitingMyReview!: number | null;
}

export class ReportAssignmentRequestsDto {
  @ApiProperty({ format: 'date-time' }) generatedAt!: string;
  @ApiProperty() windowDays!: number;
  @ApiProperty({ format: 'date-time' }) windowStart!: string;
  @ApiProperty({
    description: 'PENDING requests on non-trashed tickets in scope.',
  })
  pending!: number;
  @ApiProperty() approvedInWindow!: number;
  @ApiProperty() rejectedInWindow!: number;
  @ApiProperty() cancelledInWindow!: number;
  @ApiProperty({ nullable: true })
  averageReviewMinutes!: number | null;
  @ApiProperty(numberMap) countsByType!: AssignmentRequestTypeCounts;
  @ApiProperty({ nullable: true })
  oldestPendingAgeMinutes!: number | null;
}
