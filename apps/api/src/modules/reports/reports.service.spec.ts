import { RoleName } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../common/database/prisma.service';
import { ReportsService } from './reports.service';

const NOW = new Date('2026-06-14T12:00:00.000Z');

interface GroupByArgs {
  by: string[];
  where?: unknown;
}
interface CountArgs {
  where?: unknown;
}
interface ReadArgs {
  where?: unknown;
  select?: unknown;
  orderBy?: unknown;
}

const whereText = (where: unknown): string => JSON.stringify(where ?? {});

const createPrismaMock = () => {
  const prisma = {
    ticket: {
      groupBy: vi.fn<(args: GroupByArgs) => Promise<unknown[]>>(async () => []),
      count: vi.fn<(args: CountArgs) => Promise<number>>(async () => 0),
      findMany: vi.fn<(args: ReadArgs) => Promise<unknown[]>>(async () => []),
      findFirst: vi.fn<(args: ReadArgs) => Promise<unknown>>(async () => null),
    },
    team: {
      findMany: vi.fn<(args: ReadArgs) => Promise<unknown[]>>(async () => []),
    },
    teamMember: {
      findMany: vi.fn<(args: ReadArgs) => Promise<unknown[]>>(async () => []),
    },
    user: {
      findMany: vi.fn<(args: ReadArgs) => Promise<unknown[]>>(async () => []),
    },
    assignmentRequest: {
      count: vi.fn<(args: CountArgs) => Promise<number>>(async () => 0),
      groupBy: vi.fn<(args: GroupByArgs) => Promise<unknown[]>>(async () => []),
      findMany: vi.fn<(args: ReadArgs) => Promise<unknown[]>>(async () => []),
      findFirst: vi.fn<(args: ReadArgs) => Promise<unknown>>(async () => null),
    },
  };
  const service = new ReportsService(prisma as unknown as PrismaService);
  return { prisma, service };
};

const admin = { sub: 'admin-1', role: RoleName.ADMIN };
const manager = { sub: 'mgr-1', role: RoleName.MANAGER };

describe('ReportsService.getOverview', () => {
  let mock: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    mock = createPrismaMock();
    mock.prisma.ticket.groupBy.mockImplementation(async (args: GroupByArgs) => {
      switch (args.by[0]) {
        case 'status':
          return [
            { status: 'OPEN', _count: { _all: 3 } },
            { status: 'PENDING', _count: { _all: 2 } },
          ];
        case 'priority':
          return [{ priority: 'HIGH', _count: { _all: 4 } }];
        case 'firstResponseState':
          return [
            { firstResponseState: 'MET', _count: { _all: 6 } },
            { firstResponseState: 'BREACHED', _count: { _all: 4 } },
            { firstResponseState: 'ON_TRACK', _count: { _all: 2 } },
            { firstResponseState: 'AT_RISK', _count: { _all: 1 } },
          ];
        case 'resolutionState':
          return [{ resolutionState: 'ON_TRACK', _count: { _all: 5 } }];
        default:
          return [];
      }
    });
    mock.prisma.ticket.count.mockImplementation(async (args: CountArgs) => {
      const text = whereText(args.where);
      if (text.includes('createdAt')) return 9;
      if (text.includes('resolvedAt')) return 7;
      return 2; // unassigned
    });
  });

  it('zero-fills status and priority keys and derives currentlyOpen', async () => {
    const result = await mock.service.getOverview(admin, 30, NOW);

    expect(result.countsByStatus).toEqual({
      OPEN: 3,
      PENDING: 2,
      RESOLVED: 0,
      CLOSED: 0,
    });
    expect(result.countsByPriority).toEqual({
      LOW: 0,
      MEDIUM: 0,
      HIGH: 4,
      URGENT: 0,
    });
    expect(result.currentlyOpen).toBe(5);
    expect(result.ticketsCreatedInWindow).toBe(9);
    expect(result.resolvedInWindow).toBe(7);
    expect(result.currentlyUnassigned).toBe(2);
    expect(result.windowDays).toBe(30);
    expect(result.windowStart).toBe('2026-05-15T12:00:00.000Z');
    expect(result.generatedAt).toBe(NOW.toISOString());
  });

  it('computes SLA summary with met percentage over completed targets', async () => {
    const result = await mock.service.getOverview(admin, 30, NOW);

    expect(result.firstResponseSla).toEqual({
      onTrack: 2,
      atRisk: 1,
      breached: 4,
      met: 6,
      applicableTotal: 13,
      completedTotal: 10,
      metPercentage: 60,
    });
  });

  it('returns null met percentage when no targets are completed', async () => {
    const result = await mock.service.getOverview(admin, 30, NOW);
    // resolutionState groups only ON_TRACK → completedTotal 0.
    expect(result.resolutionSla.completedTotal).toBe(0);
    expect(result.resolutionSla.metPercentage).toBeNull();
  });

  it('scopes admin globally (deletedAt only)', async () => {
    await mock.service.getOverview(admin, 30, NOW);
    const firstWhere = mock.prisma.ticket.groupBy.mock.calls[0]![0].where;
    expect(firstWhere).toEqual({ deletedAt: null });
  });

  it('scopes a manager to their teams plus globally-unassigned triage', async () => {
    await mock.service.getOverview(manager, 30, NOW);
    const firstWhere = mock.prisma.ticket.groupBy.mock.calls[0]![0]
      .where as Record<string, unknown>;
    expect(firstWhere.deletedAt).toBeNull();
    expect(firstWhere.OR).toEqual([
      { team: { members: { some: { userId: 'mgr-1' } } } },
      { assigneeId: null, teamId: null },
    ]);
  });

  it('clamps the window start using a single now value (UTC)', async () => {
    const result = await mock.service.getOverview(admin, 7, NOW);
    expect(result.windowStart).toBe('2026-06-07T12:00:00.000Z');
  });
});

describe('ReportsService.getQueue', () => {
  let mock: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    mock = createPrismaMock();
    mock.prisma.ticket.groupBy.mockImplementation(async (args: GroupByArgs) => {
      if (args.by[0] === 'teamId') {
        const text = whereText(args.where);
        if (text.includes('"assigneeId":null')) {
          return [{ teamId: 't1', _count: { _all: 2 } }];
        }
        if (text.includes('AT_RISK')) {
          return [{ teamId: 't1', _count: { _all: 1 } }];
        }
        if (text.includes('BREACHED')) {
          return [{ teamId: 't2', _count: { _all: 1 } }];
        }
        return [
          { teamId: 't1', _count: { _all: 5 } },
          { teamId: 't2', _count: { _all: 3 } },
          { teamId: null, _count: { _all: 2 } },
        ];
      }
      if (args.by[0] === 'status') {
        return [
          { status: 'OPEN', _count: { _all: 7 } },
          { status: 'PENDING', _count: { _all: 3 } },
        ];
      }
      if (args.by[0] === 'priority') {
        return [{ priority: 'URGENT', _count: { _all: 4 } }];
      }
      return [];
    });
    mock.prisma.team.findMany.mockResolvedValue([
      { id: 't1', name: 'Billing & Payments' },
      { id: 't2', name: 'Technical Support' },
    ]);
    mock.prisma.ticket.findFirst.mockResolvedValue({
      createdAt: new Date('2026-06-14T10:00:00.000Z'),
    });
  });

  it('groups open work by team with unassigned/at-risk/breached counts', async () => {
    const result = await mock.service.getQueue(admin, NOW);

    expect(result.totalOpen).toBe(10); // 5 + 3 + 2
    expect(result.unassigned).toBe(2);
    expect(result.assigned).toBe(8);
    expect(result.atRiskCount).toBe(1);
    expect(result.breachedCount).toBe(1);

    const billing = result.teams.find((t) => t.teamId === 't1')!;
    expect(billing).toMatchObject({
      teamName: 'Billing & Payments',
      openCount: 5,
      unassignedCount: 2,
      atRiskCount: 1,
      breachedCount: 0,
    });
    // The null-team open tickets appear as a "(No team)" row, sorted last.
    const noTeam = result.teams.find((t) => t.teamId === null)!;
    expect(noTeam.teamName).toBe('(No team)');
    expect(result.teams[result.teams.length - 1]!.teamId).toBeNull();
  });

  it('computes oldest open age in minutes and zero-fills queue status keys', async () => {
    const result = await mock.service.getQueue(admin, NOW);
    expect(result.oldestOpenAgeMinutes).toBe(120);
    expect(result.countsByStatus).toEqual({
      OPEN: 7,
      PENDING: 3,
      RESOLVED: 0,
      CLOSED: 0,
    });
  });

  it('returns null oldest age when the queue is empty', async () => {
    mock.prisma.ticket.groupBy.mockResolvedValue([]);
    mock.prisma.ticket.findFirst.mockResolvedValue(null);
    const result = await mock.service.getQueue(admin, NOW);
    expect(result.totalOpen).toBe(0);
    expect(result.oldestOpenAgeMinutes).toBeNull();
    expect(result.teams).toEqual([]);
  });
});

describe('ReportsService.getAgentMetrics', () => {
  let mock: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    mock = createPrismaMock();
    mock.prisma.user.findMany.mockResolvedValue([
      {
        id: 'agent-1',
        firstName: 'Avery',
        lastName: 'Agent',
        role: { name: 'AGENT' },
        teamMemberships: [
          { team: { id: 't1', name: 'Billing & Payments' } },
          { team: { id: 't2', name: 'Technical Support' } },
        ],
      },
    ]);
    mock.prisma.ticket.findMany.mockResolvedValue([
      {
        assigneeId: 'agent-1',
        status: 'OPEN',
        createdAt: new Date('2026-06-14T10:00:00.000Z'),
        firstRespondedAt: new Date('2026-06-14T10:30:00.000Z'),
        resolvedAt: null,
        firstResponseDueAt: new Date('2026-06-14T11:00:00.000Z'),
        resolutionDueAt: new Date('2026-06-15T10:00:00.000Z'),
        firstResponseState: 'MET',
        resolutionState: 'AT_RISK',
      },
      {
        assigneeId: 'agent-1',
        status: 'RESOLVED',
        createdAt: new Date('2026-06-13T10:00:00.000Z'),
        firstRespondedAt: new Date('2026-06-13T10:30:00.000Z'),
        resolvedAt: new Date('2026-06-13T12:00:00.000Z'),
        firstResponseDueAt: new Date('2026-06-13T11:00:00.000Z'),
        resolutionDueAt: new Date('2026-06-14T10:00:00.000Z'),
        firstResponseState: 'BREACHED',
        resolutionState: 'MET',
      },
    ]);
  });

  it('aggregates averages, percentages, and dedupes multi-team agents', async () => {
    const result = await mock.service.getAgentMetrics(admin, 30, NOW);

    expect(result.agents).toHaveLength(1);
    const row = result.agents[0]!;
    expect(row.userId).toBe('agent-1');
    expect(row.displayName).toBe('Avery Agent');
    expect(row.teams).toHaveLength(2); // one row despite two teams
    expect(row.currentlyAssignedOpen).toBe(1);
    expect(row.resolvedInWindow).toBe(1);
    // both tickets responded 30m after creation
    expect(row.averageFirstResponseMinutes).toBe(30);
    // one resolved ticket, 120m
    expect(row.averageResolutionMinutes).toBe(120);
    // first response: MET + BREACHED completed (2), 1 met → 50%
    expect(row.firstResponseCompleted).toBe(2);
    expect(row.firstResponseMet).toBe(1);
    expect(row.firstResponseMetPercentage).toBe(50);
    // resolution: only the MET one is completed (AT_RISK is not)
    expect(row.resolutionCompleted).toBe(1);
    expect(row.resolutionMet).toBe(1);
    expect(row.resolutionMetPercentage).toBe(100);
    // open ticket has resolutionState AT_RISK
    expect(row.assignedAtRisk).toBe(1);
    expect(row.assignedBreached).toBe(0);
  });

  it('requests only active AGENT/MANAGER users', async () => {
    await mock.service.getAgentMetrics(admin, 30, NOW);
    const where = mock.prisma.user.findMany.mock.calls[0]![0].where;
    expect(where).toMatchObject({
      isActive: true,
      role: { name: { in: ['AGENT', 'MANAGER'] } },
    });
  });

  it('restricts a manager to staff in their own teams', async () => {
    mock.prisma.teamMember.findMany.mockResolvedValue([{ teamId: 't1' }]);
    await mock.service.getAgentMetrics(manager, 30, NOW);
    expect(mock.prisma.teamMember.findMany).toHaveBeenCalledWith({
      where: { userId: 'mgr-1' },
      select: { teamId: true },
    });
    const where = mock.prisma.user.findMany.mock.calls[0]![0].where as Record<
      string,
      unknown
    >;
    expect(where.teamMemberships).toEqual({ some: { teamId: { in: ['t1'] } } });
  });

  it('returns no agents for a manager with no teams', async () => {
    mock.prisma.teamMember.findMany.mockResolvedValue([]);
    const result = await mock.service.getAgentMetrics(manager, 30, NOW);
    expect(result.agents).toEqual([]);
    expect(mock.prisma.user.findMany).not.toHaveBeenCalled();
  });
});

describe('ReportsService.getMe', () => {
  let mock: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    mock = createPrismaMock();
    mock.prisma.ticket.findMany.mockResolvedValue([]);
  });

  it('reports a plain agent’s own metrics with no review bucket', async () => {
    mock.prisma.assignmentRequest.count.mockResolvedValue(2);
    const result = await mock.service.getMe(
      { sub: 'agent-1', role: RoleName.AGENT },
      30,
      NOW,
    );
    expect(result.pendingAssignmentRequestsCreatedByMe).toBe(2);
    expect(result.pendingAssignmentRequestsAwaitingMyReview).toBeNull();
    // The "created by me" count must filter by the caller and PENDING.
    const where = mock.prisma.assignmentRequest.count.mock.calls[0]![0].where;
    expect(where).toMatchObject({
      requestedById: 'agent-1',
      status: 'PENDING',
      ticket: { deletedAt: null },
    });
  });

  it('adds an awaiting-review bucket for a manager', async () => {
    mock.prisma.assignmentRequest.count
      .mockResolvedValueOnce(1) // created by me
      .mockResolvedValueOnce(4); // awaiting my review
    const result = await mock.service.getMe(manager, 30, NOW);
    expect(result.pendingAssignmentRequestsAwaitingMyReview).toBe(4);
    const reviewWhere = mock.prisma.assignmentRequest.count.mock.calls[1]![0]
      .where as Record<string, unknown>;
    expect(reviewWhere.status).toBe('PENDING');
    expect(reviewWhere.ticket).toMatchObject({
      team: { members: { some: { userId: 'mgr-1' } } },
      deletedAt: null,
    });
  });
});

describe('ReportsService.getAssignmentRequests', () => {
  let mock: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    mock = createPrismaMock();
    mock.prisma.assignmentRequest.count.mockImplementation(
      async (args: CountArgs) => {
        const text = whereText(args.where);
        if (text.includes('PENDING')) return 3;
        if (text.includes('APPROVED')) return 5;
        if (text.includes('REJECTED')) return 2;
        if (text.includes('CANCELLED')) return 1;
        return 0;
      },
    );
    mock.prisma.assignmentRequest.groupBy.mockResolvedValue([
      { type: 'REASSIGN_USER', _count: { _all: 8 } },
    ]);
    mock.prisma.assignmentRequest.findMany.mockResolvedValue([
      {
        createdAt: new Date('2026-06-14T10:00:00.000Z'),
        reviewedAt: new Date('2026-06-14T10:20:00.000Z'),
      },
      {
        createdAt: new Date('2026-06-14T09:00:00.000Z'),
        reviewedAt: new Date('2026-06-14T10:00:00.000Z'),
      },
    ]);
    mock.prisma.assignmentRequest.findFirst.mockResolvedValue({
      createdAt: new Date('2026-06-14T11:00:00.000Z'),
    });
  });

  it('aggregates pending/review counts, average review time, and type counts', async () => {
    const result = await mock.service.getAssignmentRequests(admin, 30, NOW);
    expect(result.pending).toBe(3);
    expect(result.approvedInWindow).toBe(5);
    expect(result.rejectedInWindow).toBe(2);
    expect(result.cancelledInWindow).toBe(1);
    expect(result.averageReviewMinutes).toBe(40); // (20 + 60) / 2
    expect(result.countsByType).toEqual({
      REASSIGN_USER: 8,
      RETURN_TO_QUEUE: 0,
    });
    expect(result.oldestPendingAgeMinutes).toBe(60);
  });

  it('excludes trashed tickets from active pending and scopes a manager by team', async () => {
    await mock.service.getAssignmentRequests(manager, 30, NOW);
    const pendingCall = mock.prisma.assignmentRequest.count.mock.calls.find(
      (call) => whereText(call[0].where).includes('PENDING'),
    )!;
    const where = pendingCall[0].where as Record<string, unknown>;
    expect(where.ticket).toMatchObject({
      team: { members: { some: { userId: 'mgr-1' } } },
      deletedAt: null,
    });
  });

  it('returns null average review time when nothing was reviewed', async () => {
    mock.prisma.assignmentRequest.findMany.mockResolvedValue([]);
    const result = await mock.service.getAssignmentRequests(admin, 30, NOW);
    expect(result.averageReviewMinutes).toBeNull();
  });
});
