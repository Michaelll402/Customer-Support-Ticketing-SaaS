import { Inject, Injectable } from '@nestjs/common';
import {
  AssignmentRequestStatus,
  AssignmentRequestType,
  RoleName,
  SlaTargetState,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/database/prisma.service';
import type {
  AgentMetricRowDto,
  PriorityCounts,
  ReportAgentMetricsDto,
  ReportAssignmentRequestsDto,
  ReportMeDto,
  ReportOverviewDto,
  ReportQueueDto,
  ReportQueueTeamBreakdownDto,
  SlaSummaryDto,
  StatusCounts,
} from './dto/report-response.dto';

type Viewer = { sub: string; role: RoleName };

const OPEN_STATUSES: TicketStatus[] = [TicketStatus.OPEN, TicketStatus.PENDING];
const ALL_STATUSES = Object.values(TicketStatus);
const ALL_PRIORITIES = Object.values(TicketPriority);
const ALL_REQUEST_TYPES = Object.values(AssignmentRequestType);

interface SlimTicket {
  assigneeId?: string | null;
  status: TicketStatus;
  createdAt: Date;
  firstRespondedAt: Date | null;
  resolvedAt: Date | null;
  firstResponseDueAt: Date | null;
  resolutionDueAt: Date | null;
  firstResponseState: SlaTargetState;
  resolutionState: SlaTargetState;
}

const slimTicketSelect = {
  assigneeId: true,
  status: true,
  createdAt: true,
  firstRespondedAt: true,
  resolvedAt: true,
  firstResponseDueAt: true,
  resolutionDueAt: true,
  firstResponseState: true,
  resolutionState: true,
} satisfies Prisma.TicketSelect;

const diffMinutes = (from: Date, to: Date): number =>
  (to.getTime() - from.getTime()) / 60_000;

const round1 = (value: number): number => Math.round(value * 10) / 10;

@Injectable()
export class ReportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // --- Scoping ------------------------------------------------------------

  /**
   * The set of tickets a report viewer may aggregate over. Trashed tickets are
   * always excluded. ADMIN is global; MANAGER is limited to tickets in teams
   * they belong to plus globally-unassigned triage tickets (mirrors ticket
   * visibility, team-centric — unrelated-team tickets never appear).
   */
  private buildScopeWhere(viewer: Viewer): Prisma.TicketWhereInput {
    if (viewer.role === RoleName.ADMIN) {
      return { deletedAt: null };
    }

    return {
      deletedAt: null,
      OR: [
        { team: { members: { some: { userId: viewer.sub } } } },
        { assigneeId: null, teamId: null },
      ],
    };
  }

  private windowStartFrom(now: Date, windowDays: number): Date {
    return new Date(now.getTime() - windowDays * 86_400_000);
  }

  private pct(met: number, completed: number): number | null {
    if (completed === 0) {
      return null;
    }
    return round1((met / completed) * 100);
  }

  // --- Overview -----------------------------------------------------------

  async getOverview(
    viewer: Viewer,
    windowDays: number,
    now: Date,
  ): Promise<ReportOverviewDto> {
    const windowStart = this.windowStartFrom(now, windowDays);
    const scope = this.buildScopeWhere(viewer);

    const [
      statusGroups,
      priorityGroups,
      firstResponseGroups,
      resolutionGroups,
      ticketsCreatedInWindow,
      resolvedInWindow,
      currentlyUnassigned,
    ] = await Promise.all([
      this.prisma.ticket.groupBy({
        by: ['status'],
        where: scope,
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['priority'],
        where: scope,
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['firstResponseState'],
        where: { ...scope, firstResponseDueAt: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['resolutionState'],
        where: { ...scope, resolutionDueAt: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.ticket.count({
        where: { ...scope, createdAt: { gte: windowStart, lte: now } },
      }),
      this.prisma.ticket.count({
        where: { ...scope, resolvedAt: { gte: windowStart, lte: now } },
      }),
      this.prisma.ticket.count({ where: { ...scope, assigneeId: null } }),
    ]);

    const countsByStatus = this.toStatusCounts(
      statusGroups.map((g) => ({ key: g.status, count: g._count._all })),
    );
    const countsByPriority = this.toPriorityCounts(
      priorityGroups.map((g) => ({ key: g.priority, count: g._count._all })),
    );

    return {
      windowDays,
      windowStart: windowStart.toISOString(),
      generatedAt: now.toISOString(),
      ticketsCreatedInWindow,
      resolvedInWindow,
      currentlyOpen: countsByStatus.OPEN + countsByStatus.PENDING,
      currentlyUnassigned,
      countsByStatus,
      countsByPriority,
      firstResponseSla: this.toSlaSummary(
        firstResponseGroups.map((g) => ({
          state: g.firstResponseState,
          count: g._count._all,
        })),
      ),
      resolutionSla: this.toSlaSummary(
        resolutionGroups.map((g) => ({
          state: g.resolutionState,
          count: g._count._all,
        })),
      ),
    };
  }

  // --- Queue --------------------------------------------------------------

  async getQueue(viewer: Viewer, now: Date): Promise<ReportQueueDto> {
    const scope = this.buildScopeWhere(viewer);
    const openWhere: Prisma.TicketWhereInput = {
      ...scope,
      status: { in: OPEN_STATUSES },
    };

    const atRiskOr: Prisma.TicketWhereInput = {
      OR: [
        { firstResponseState: SlaTargetState.AT_RISK },
        { resolutionState: SlaTargetState.AT_RISK },
      ],
    };
    const breachedOr: Prisma.TicketWhereInput = {
      OR: [
        { firstResponseState: SlaTargetState.BREACHED },
        { resolutionState: SlaTargetState.BREACHED },
      ],
    };

    const [
      openByTeam,
      unassignedByTeam,
      atRiskByTeam,
      breachedByTeam,
      statusGroups,
      priorityGroups,
      oldestOpen,
    ] = await Promise.all([
      this.prisma.ticket.groupBy({
        by: ['teamId'],
        where: openWhere,
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['teamId'],
        where: { ...openWhere, assigneeId: null },
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['teamId'],
        where: { AND: [openWhere, atRiskOr] },
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['teamId'],
        where: { AND: [openWhere, breachedOr] },
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['status'],
        where: openWhere,
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['priority'],
        where: openWhere,
        _count: { _all: true },
      }),
      this.prisma.ticket.findFirst({
        where: openWhere,
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);

    const open = this.teamCountMap(openByTeam);
    const unassigned = this.teamCountMap(unassignedByTeam);
    const atRisk = this.teamCountMap(atRiskByTeam);
    const breached = this.teamCountMap(breachedByTeam);

    const teamIds = [...open.keys()].filter((id): id is string => id !== null);
    const teams = teamIds.length
      ? await this.prisma.team.findMany({
          where: { id: { in: teamIds } },
          select: { id: true, name: true },
        })
      : [];
    const teamNames = new Map(teams.map((t) => [t.id, t.name]));

    const teamRows: ReportQueueTeamBreakdownDto[] = [...open.keys()].map(
      (teamId) => ({
        teamId,
        teamName: teamId
          ? (teamNames.get(teamId) ?? 'Unknown team')
          : '(No team)',
        openCount: open.get(teamId) ?? 0,
        unassignedCount: unassigned.get(teamId) ?? 0,
        atRiskCount: atRisk.get(teamId) ?? 0,
        breachedCount: breached.get(teamId) ?? 0,
      }),
    );
    teamRows.sort((a, b) => {
      if (a.teamId === null) return 1;
      if (b.teamId === null) return -1;
      return a.teamName.localeCompare(b.teamName);
    });

    const sum = (map: Map<string | null, number>): number =>
      [...map.values()].reduce((total, value) => total + value, 0);

    const totalOpen = sum(open);
    const unassignedTotal = sum(unassigned);

    return {
      generatedAt: now.toISOString(),
      totalOpen,
      unassigned: unassignedTotal,
      assigned: totalOpen - unassignedTotal,
      oldestOpenAgeMinutes: oldestOpen
        ? Math.round(diffMinutes(oldestOpen.createdAt, now))
        : null,
      countsByStatus: this.toStatusCounts(
        statusGroups.map((g) => ({ key: g.status, count: g._count._all })),
      ),
      countsByPriority: this.toPriorityCounts(
        priorityGroups.map((g) => ({ key: g.priority, count: g._count._all })),
      ),
      atRiskCount: sum(atRisk),
      breachedCount: sum(breached),
      teams: teamRows,
    };
  }

  // --- Agent metrics ------------------------------------------------------

  async getAgentMetrics(
    viewer: Viewer,
    windowDays: number,
    now: Date,
  ): Promise<ReportAgentMetricsDto> {
    const windowStart = this.windowStartFrom(now, windowDays);

    const userWhere: Prisma.UserWhereInput = {
      isActive: true,
      role: { name: { in: [RoleName.AGENT, RoleName.MANAGER] } },
    };

    if (viewer.role === RoleName.MANAGER) {
      const teamIds = await this.managerTeamIds(viewer.sub);
      if (teamIds.length === 0) {
        return this.emptyAgentMetrics(windowDays, windowStart, now);
      }
      userWhere.teamMemberships = { some: { teamId: { in: teamIds } } };
    }

    const users = await this.prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: { select: { name: true } },
        teamMemberships: {
          select: { team: { select: { id: true, name: true } } },
        },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    const userIds = users.map((user) => user.id);
    if (userIds.length === 0) {
      return this.emptyAgentMetrics(windowDays, windowStart, now);
    }

    const tickets = await this.prisma.ticket.findMany({
      where: { assigneeId: { in: userIds }, deletedAt: null },
      select: slimTicketSelect,
    });

    const ticketsByAssignee = new Map<string, SlimTicket[]>();
    for (const ticket of tickets) {
      if (!ticket.assigneeId) continue;
      const bucket = ticketsByAssignee.get(ticket.assigneeId) ?? [];
      bucket.push(ticket);
      ticketsByAssignee.set(ticket.assigneeId, bucket);
    }

    const agents: AgentMetricRowDto[] = users.map((user) => {
      const aggregates = this.aggregateTickets(
        ticketsByAssignee.get(user.id) ?? [],
        windowStart,
        now,
      );
      return {
        userId: user.id,
        displayName: `${user.firstName} ${user.lastName}`,
        role: user.role.name,
        teams: user.teamMemberships.map((membership) => ({
          id: membership.team.id,
          name: membership.team.name,
        })),
        ...aggregates,
      };
    });

    return {
      generatedAt: now.toISOString(),
      windowDays,
      windowStart: windowStart.toISOString(),
      agents,
    };
  }

  // --- Me -----------------------------------------------------------------

  async getMe(
    viewer: Viewer,
    windowDays: number,
    now: Date,
  ): Promise<ReportMeDto> {
    const windowStart = this.windowStartFrom(now, windowDays);

    const [tickets, pendingCreatedByMe] = await Promise.all([
      this.prisma.ticket.findMany({
        where: { assigneeId: viewer.sub, deletedAt: null },
        select: slimTicketSelect,
      }),
      this.prisma.assignmentRequest.count({
        where: {
          requestedById: viewer.sub,
          status: AssignmentRequestStatus.PENDING,
          ticket: { deletedAt: null },
        },
      }),
    ]);

    const aggregates = this.aggregateTickets(tickets, windowStart, now);

    let awaitingMyReview: number | null = null;
    if (viewer.role === RoleName.MANAGER || viewer.role === RoleName.ADMIN) {
      awaitingMyReview = await this.prisma.assignmentRequest.count({
        where: {
          status: AssignmentRequestStatus.PENDING,
          ticket: this.requestTicketFilter(viewer, true),
        },
      });
    }

    return {
      generatedAt: now.toISOString(),
      windowDays,
      windowStart: windowStart.toISOString(),
      currentlyAssignedOpen: aggregates.currentlyAssignedOpen,
      resolvedInWindow: aggregates.resolvedInWindow,
      averageFirstResponseMinutes: aggregates.averageFirstResponseMinutes,
      averageResolutionMinutes: aggregates.averageResolutionMinutes,
      firstResponseSla: {
        completed: aggregates.firstResponseCompleted,
        met: aggregates.firstResponseMet,
        metPercentage: aggregates.firstResponseMetPercentage,
      },
      resolutionSla: {
        completed: aggregates.resolutionCompleted,
        met: aggregates.resolutionMet,
        metPercentage: aggregates.resolutionMetPercentage,
      },
      assignedAtRisk: aggregates.assignedAtRisk,
      assignedBreached: aggregates.assignedBreached,
      pendingAssignmentRequestsCreatedByMe: pendingCreatedByMe,
      pendingAssignmentRequestsAwaitingMyReview: awaitingMyReview,
    };
  }

  // --- Assignment requests ------------------------------------------------

  async getAssignmentRequests(
    viewer: Viewer,
    windowDays: number,
    now: Date,
  ): Promise<ReportAssignmentRequestsDto> {
    const windowStart = this.windowStartFrom(now, windowDays);
    // Active pending counts exclude trashed tickets; reviewed-in-window counts
    // keep historical reviews even if the ticket was later trashed.
    const activeScope = this.requestTicketFilter(viewer, true);
    const historicalScope = this.requestTicketFilter(viewer, false);

    const [
      pending,
      approvedInWindow,
      rejectedInWindow,
      cancelledInWindow,
      typeGroups,
      reviewedRows,
      oldestPending,
    ] = await Promise.all([
      this.prisma.assignmentRequest.count({
        where: { status: AssignmentRequestStatus.PENDING, ticket: activeScope },
      }),
      this.prisma.assignmentRequest.count({
        where: {
          status: AssignmentRequestStatus.APPROVED,
          reviewedAt: { gte: windowStart, lte: now },
          ...(historicalScope ? { ticket: historicalScope } : {}),
        },
      }),
      this.prisma.assignmentRequest.count({
        where: {
          status: AssignmentRequestStatus.REJECTED,
          reviewedAt: { gte: windowStart, lte: now },
          ...(historicalScope ? { ticket: historicalScope } : {}),
        },
      }),
      this.prisma.assignmentRequest.count({
        where: {
          status: AssignmentRequestStatus.CANCELLED,
          updatedAt: { gte: windowStart, lte: now },
          ...(historicalScope ? { ticket: historicalScope } : {}),
        },
      }),
      this.prisma.assignmentRequest.groupBy({
        by: ['type'],
        where: historicalScope ? { ticket: historicalScope } : {},
        _count: { _all: true },
      }),
      this.prisma.assignmentRequest.findMany({
        where: {
          status: {
            in: [
              AssignmentRequestStatus.APPROVED,
              AssignmentRequestStatus.REJECTED,
            ],
          },
          reviewedAt: { gte: windowStart, lte: now },
          ...(historicalScope ? { ticket: historicalScope } : {}),
        },
        select: { createdAt: true, reviewedAt: true },
      }),
      this.prisma.assignmentRequest.findFirst({
        where: { status: AssignmentRequestStatus.PENDING, ticket: activeScope },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);

    let reviewSum = 0;
    let reviewCount = 0;
    for (const row of reviewedRows) {
      if (row.reviewedAt && row.reviewedAt >= row.createdAt) {
        reviewSum += diffMinutes(row.createdAt, row.reviewedAt);
        reviewCount += 1;
      }
    }

    const countsByType = ALL_REQUEST_TYPES.reduce(
      (acc, type) => {
        acc[type] = 0;
        return acc;
      },
      {} as Record<AssignmentRequestType, number>,
    );
    for (const group of typeGroups) {
      countsByType[group.type] = group._count._all;
    }

    return {
      generatedAt: now.toISOString(),
      windowDays,
      windowStart: windowStart.toISOString(),
      pending,
      approvedInWindow,
      rejectedInWindow,
      cancelledInWindow,
      averageReviewMinutes: reviewCount
        ? round1(reviewSum / reviewCount)
        : null,
      countsByType,
      oldestPendingAgeMinutes: oldestPending
        ? Math.round(diffMinutes(oldestPending.createdAt, now))
        : null,
    };
  }

  // --- Shared helpers -----------------------------------------------------

  private async managerTeamIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    });
    return memberships.map((membership) => membership.teamId);
  }

  /**
   * The ticket filter scoping assignment-request reports. MANAGER is limited to
   * requests whose ticket belongs to one of their teams; ADMIN is global.
   * `requireActive` adds `deletedAt: null` for active (pending) counts.
   */
  private requestTicketFilter(
    viewer: Viewer,
    requireActive: boolean,
  ): Prisma.TicketWhereInput | undefined {
    const filter: Prisma.TicketWhereInput = {};
    if (viewer.role === RoleName.MANAGER) {
      filter.team = { members: { some: { userId: viewer.sub } } };
    }
    if (requireActive) {
      filter.deletedAt = null;
    }
    return Object.keys(filter).length > 0 ? filter : undefined;
  }

  private aggregateTickets(
    tickets: SlimTicket[],
    windowStart: Date,
    now: Date,
  ): Omit<AgentMetricRowDto, 'userId' | 'displayName' | 'role' | 'teams'> {
    let currentlyAssignedOpen = 0;
    let resolvedInWindow = 0;
    let firstResponseSum = 0;
    let firstResponseSamples = 0;
    let resolutionSum = 0;
    let resolutionSamples = 0;
    let firstResponseCompleted = 0;
    let firstResponseMet = 0;
    let resolutionCompleted = 0;
    let resolutionMet = 0;
    let assignedAtRisk = 0;
    let assignedBreached = 0;

    for (const ticket of tickets) {
      const isOpen =
        ticket.status === TicketStatus.OPEN ||
        ticket.status === TicketStatus.PENDING;

      if (isOpen) currentlyAssignedOpen += 1;

      if (
        ticket.resolvedAt &&
        ticket.resolvedAt >= windowStart &&
        ticket.resolvedAt <= now
      ) {
        resolvedInWindow += 1;
      }

      if (
        ticket.firstRespondedAt &&
        ticket.firstRespondedAt >= ticket.createdAt
      ) {
        firstResponseSum += diffMinutes(
          ticket.createdAt,
          ticket.firstRespondedAt,
        );
        firstResponseSamples += 1;
      }

      if (ticket.resolvedAt && ticket.resolvedAt >= ticket.createdAt) {
        resolutionSum += diffMinutes(ticket.createdAt, ticket.resolvedAt);
        resolutionSamples += 1;
      }

      if (ticket.firstResponseDueAt) {
        if (
          ticket.firstResponseState === SlaTargetState.MET ||
          ticket.firstResponseState === SlaTargetState.BREACHED
        ) {
          firstResponseCompleted += 1;
        }
        if (ticket.firstResponseState === SlaTargetState.MET) {
          firstResponseMet += 1;
        }
      }

      if (ticket.resolutionDueAt) {
        if (
          ticket.resolutionState === SlaTargetState.MET ||
          ticket.resolutionState === SlaTargetState.BREACHED
        ) {
          resolutionCompleted += 1;
        }
        if (ticket.resolutionState === SlaTargetState.MET) {
          resolutionMet += 1;
        }
      }

      if (
        isOpen &&
        (ticket.firstResponseState === SlaTargetState.AT_RISK ||
          ticket.resolutionState === SlaTargetState.AT_RISK)
      ) {
        assignedAtRisk += 1;
      }
      if (
        isOpen &&
        (ticket.firstResponseState === SlaTargetState.BREACHED ||
          ticket.resolutionState === SlaTargetState.BREACHED)
      ) {
        assignedBreached += 1;
      }
    }

    return {
      currentlyAssignedOpen,
      resolvedInWindow,
      averageFirstResponseMinutes: firstResponseSamples
        ? round1(firstResponseSum / firstResponseSamples)
        : null,
      averageResolutionMinutes: resolutionSamples
        ? round1(resolutionSum / resolutionSamples)
        : null,
      firstResponseCompleted,
      firstResponseMet,
      firstResponseMetPercentage: this.pct(
        firstResponseMet,
        firstResponseCompleted,
      ),
      resolutionCompleted,
      resolutionMet,
      resolutionMetPercentage: this.pct(resolutionMet, resolutionCompleted),
      assignedAtRisk,
      assignedBreached,
    };
  }

  private emptyAgentMetrics(
    windowDays: number,
    windowStart: Date,
    now: Date,
  ): ReportAgentMetricsDto {
    return {
      generatedAt: now.toISOString(),
      windowDays,
      windowStart: windowStart.toISOString(),
      agents: [],
    };
  }

  private teamCountMap(
    groups: Array<{ teamId: string | null; _count: { _all: number } }>,
  ): Map<string | null, number> {
    return new Map(groups.map((g) => [g.teamId, g._count._all]));
  }

  private toStatusCounts(
    rows: Array<{ key: TicketStatus; count: number }>,
  ): StatusCounts {
    const counts = ALL_STATUSES.reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {} as StatusCounts);
    for (const row of rows) {
      counts[row.key] = row.count;
    }
    return counts;
  }

  private toPriorityCounts(
    rows: Array<{ key: TicketPriority; count: number }>,
  ): PriorityCounts {
    const counts = ALL_PRIORITIES.reduce((acc, priority) => {
      acc[priority] = 0;
      return acc;
    }, {} as PriorityCounts);
    for (const row of rows) {
      counts[row.key] = row.count;
    }
    return counts;
  }

  private toSlaSummary(
    rows: Array<{ state: SlaTargetState; count: number }>,
  ): SlaSummaryDto {
    const by: Record<SlaTargetState, number> = {
      [SlaTargetState.ON_TRACK]: 0,
      [SlaTargetState.AT_RISK]: 0,
      [SlaTargetState.BREACHED]: 0,
      [SlaTargetState.MET]: 0,
    };
    for (const row of rows) {
      by[row.state] = row.count;
    }

    const applicableTotal = by.ON_TRACK + by.AT_RISK + by.BREACHED + by.MET;
    const completedTotal = by.MET + by.BREACHED;

    return {
      onTrack: by.ON_TRACK,
      atRisk: by.AT_RISK,
      breached: by.BREACHED,
      met: by.MET,
      applicableTotal,
      completedTotal,
      metPercentage: this.pct(by.MET, completedTotal),
    };
  }
}
