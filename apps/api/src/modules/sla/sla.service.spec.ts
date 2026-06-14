import 'reflect-metadata';

import {
  RoleName,
  SlaPlanAppliesTo,
  SlaTargetState,
  TicketEventType,
  TicketPriority,
  TicketStatus,
  type SlaPlan,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../common/database/prisma.service';
import type { QueueService } from '../queue/queue.service';
import type { RealtimeService } from '../realtime/realtime.service';
import { SlaService } from './sla.service';

const NOW = new Date('2026-06-13T12:00:00.000Z');

const buildPlan = (overrides: Partial<SlaPlan> = {}): SlaPlan => ({
  id: 'plan-all',
  name: 'Standard',
  firstResponseMinutes: 60,
  resolutionMinutes: 1440,
  appliesTo: SlaPlanAppliesTo.ALL,
  priority: null,
  categoryId: null,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const pureService = () =>
  new SlaService(
    {} as unknown as PrismaService,
    {} as unknown as QueueService,
    {} as unknown as RealtimeService,
  );

describe('SlaService.matchPlan', () => {
  it('prefers an active CATEGORY plan over PRIORITY and ALL', () => {
    const service = pureService();
    const plans = [
      buildPlan({ id: 'all', appliesTo: SlaPlanAppliesTo.ALL }),
      buildPlan({
        id: 'prio',
        appliesTo: SlaPlanAppliesTo.PRIORITY,
        priority: TicketPriority.HIGH,
      }),
      buildPlan({
        id: 'cat',
        appliesTo: SlaPlanAppliesTo.CATEGORY,
        categoryId: 'cat-1',
      }),
    ];

    const match = service.matchPlan(plans, {
      categoryId: 'cat-1',
      priority: TicketPriority.HIGH,
    });

    expect(match?.id).toBe('cat');
  });

  it('prefers a PRIORITY plan over ALL when no category matches', () => {
    const service = pureService();
    const plans = [
      buildPlan({ id: 'all', appliesTo: SlaPlanAppliesTo.ALL }),
      buildPlan({
        id: 'prio',
        appliesTo: SlaPlanAppliesTo.PRIORITY,
        priority: TicketPriority.URGENT,
      }),
      buildPlan({
        id: 'cat',
        appliesTo: SlaPlanAppliesTo.CATEGORY,
        categoryId: 'other',
      }),
    ];

    const match = service.matchPlan(plans, {
      categoryId: 'cat-1',
      priority: TicketPriority.URGENT,
    });

    expect(match?.id).toBe('prio');
  });

  it('falls back to the ALL plan', () => {
    const service = pureService();
    const match = service.matchPlan(
      [buildPlan({ id: 'all', appliesTo: SlaPlanAppliesTo.ALL })],
      { categoryId: null, priority: TicketPriority.LOW },
    );
    expect(match?.id).toBe('all');
  });

  it('ignores inactive plans', () => {
    const service = pureService();
    const match = service.matchPlan(
      [
        buildPlan({
          id: 'all',
          appliesTo: SlaPlanAppliesTo.ALL,
          isActive: false,
        }),
      ],
      { categoryId: null, priority: TicketPriority.LOW },
    );
    expect(match).toBeNull();
  });

  it('returns null when nothing matches', () => {
    const service = pureService();
    const match = service.matchPlan(
      [
        buildPlan({
          id: 'cat',
          appliesTo: SlaPlanAppliesTo.CATEGORY,
          categoryId: 'other',
        }),
      ],
      { categoryId: 'cat-1', priority: TicketPriority.LOW },
    );
    expect(match).toBeNull();
  });

  it('breaks ties deterministically by oldest createdAt then id', () => {
    const service = pureService();
    const plans = [
      buildPlan({
        id: 'b',
        appliesTo: SlaPlanAppliesTo.ALL,
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
      }),
      buildPlan({
        id: 'a',
        appliesTo: SlaPlanAppliesTo.ALL,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ];
    expect(
      service.matchPlan(plans, {
        categoryId: null,
        priority: TicketPriority.LOW,
      })?.id,
    ).toBe('a');
  });
});

describe('SlaService.computeDueDates', () => {
  it('adds the plan minutes to the from time', () => {
    const service = pureService();
    const due = service.computeDueDates(
      { firstResponseMinutes: 60, resolutionMinutes: 1440 },
      NOW,
    );
    expect(due.firstResponseDueAt.toISOString()).toBe(
      '2026-06-13T13:00:00.000Z',
    );
    expect(due.resolutionDueAt.toISOString()).toBe('2026-06-14T12:00:00.000Z');
  });
});

describe('SlaService.buildCreationSla', () => {
  it('returns plan id and due dates when a plan matches', async () => {
    const findMany = vi.fn().mockResolvedValue([buildPlan({ id: 'p1' })]);
    const service = new SlaService(
      { slaPlan: { findMany } } as unknown as PrismaService,
      {} as unknown as QueueService,
      {} as unknown as RealtimeService,
    );

    const sla = await service.buildCreationSla(null, TicketPriority.LOW, NOW);

    expect(sla.slaPlanId).toBe('p1');
    expect(sla.firstResponseDueAt?.toISOString()).toBe(
      '2026-06-13T13:00:00.000Z',
    );
  });

  it('returns an empty fragment when no plan matches', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new SlaService(
      { slaPlan: { findMany } } as unknown as PrismaService,
      {} as unknown as QueueService,
      {} as unknown as RealtimeService,
    );

    const sla = await service.buildCreationSla(null, TicketPriority.LOW, NOW);
    expect(sla).toEqual({});
  });
});

describe('SlaService.markFirstResponse', () => {
  it('guards on firstRespondedAt being null and sets MET', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const service = new SlaService(
      { ticket: { updateMany } } as unknown as PrismaService,
      {} as unknown as QueueService,
      {} as unknown as RealtimeService,
    );

    await service.markFirstResponse('ticket-1', NOW);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'ticket-1', firstRespondedAt: null },
      data: { firstRespondedAt: NOW, firstResponseState: SlaTargetState.MET },
    });
  });
});

describe('SlaService.resolveStatusTransitionSla', () => {
  it('stamps resolution MET when resolving', async () => {
    const service = pureService();
    const sla = await service.resolveStatusTransitionSla(
      'ticket-1',
      TicketStatus.OPEN,
      TicketStatus.RESOLVED,
      NOW,
    );
    expect(sla).toEqual({
      resolvedAt: NOW,
      resolutionState: SlaTargetState.MET,
    });
  });

  it('recomputes resolution from the plan on reopen', async () => {
    const ticketFindUnique = vi.fn().mockResolvedValue({ slaPlanId: 'p1' });
    const slaPlanFindUnique = vi
      .fn()
      .mockResolvedValue({ resolutionMinutes: 1440 });
    const service = new SlaService(
      {
        ticket: { findUnique: ticketFindUnique },
        slaPlan: { findUnique: slaPlanFindUnique },
      } as unknown as PrismaService,
      {} as unknown as QueueService,
      {} as unknown as RealtimeService,
    );

    const sla = await service.resolveStatusTransitionSla(
      'ticket-1',
      TicketStatus.CLOSED,
      TicketStatus.OPEN,
      NOW,
    );

    expect(sla.resolvedAt).toBeNull();
    expect(sla.resolutionState).toBe(SlaTargetState.ON_TRACK);
    expect(sla.resolutionDueAt?.toISOString()).toBe('2026-06-14T12:00:00.000Z');
  });

  it('reopens without a due date when the ticket has no plan', async () => {
    const ticketFindUnique = vi.fn().mockResolvedValue({ slaPlanId: null });
    const service = new SlaService(
      {
        ticket: { findUnique: ticketFindUnique },
        slaPlan: { findUnique: vi.fn() },
      } as unknown as PrismaService,
      {} as unknown as QueueService,
      {} as unknown as RealtimeService,
    );

    const sla = await service.resolveStatusTransitionSla(
      'ticket-1',
      TicketStatus.RESOLVED,
      TicketStatus.PENDING,
      NOW,
    );

    expect(sla).toEqual({
      resolvedAt: null,
      resolutionState: SlaTargetState.ON_TRACK,
    });
  });

  it('returns an empty fragment for non-resolution transitions', async () => {
    const service = pureService();
    const sla = await service.resolveStatusTransitionSla(
      'ticket-1',
      TicketStatus.OPEN,
      TicketStatus.PENDING,
      NOW,
    );
    expect(sla).toEqual({});
  });
});

// ---- Scanner ----------------------------------------------------------------

interface ScanMockOptions {
  transitionCount?: number;
  teamMembers?: Array<{ userId: string }>;
  users?: Array<{ id: string; role: { name: RoleName } }>;
  enqueueRejects?: boolean;
}

const buildScanCandidate = (overrides: Record<string, unknown> = {}) => ({
  id: 'ticket-1',
  number: 42,
  status: TicketStatus.OPEN,
  priority: TicketPriority.HIGH,
  requesterId: 'customer-1',
  assigneeId: 'agent-1',
  teamId: 'team-1',
  categoryId: null,
  updatedAt: NOW,
  firstResponseState: SlaTargetState.ON_TRACK,
  firstResponseDueAt: new Date('2026-06-13T13:00:00.000Z'),
  resolutionState: SlaTargetState.ON_TRACK,
  resolutionDueAt: new Date('2026-06-14T12:00:00.000Z'),
  slaPlan: { firstResponseMinutes: 60, resolutionMinutes: 1440 },
  tags: [] as Array<{ tagId: string }>,
  ...overrides,
});

const buildScanService = (
  candidates: ReturnType<typeof buildScanCandidate>[],
  options: ScanMockOptions = {},
) => {
  const updateMany = vi
    .fn()
    .mockResolvedValue({ count: options.transitionCount ?? 1 });
  const eventCreate = vi.fn().mockResolvedValue({});
  const $transaction = vi.fn(
    async (
      cb: (client: {
        ticket: { updateMany: typeof updateMany };
        ticketEvent: { create: typeof eventCreate };
      }) => Promise<unknown>,
    ) => cb({ ticket: { updateMany }, ticketEvent: { create: eventCreate } }),
  );
  const ticketFindMany = vi.fn().mockResolvedValue(candidates);
  const teamMemberFindMany = vi
    .fn()
    .mockResolvedValue(options.teamMembers ?? []);
  const userFindMany = vi.fn().mockResolvedValue(options.users ?? []);

  const prisma = {
    ticket: { findMany: ticketFindMany, updateMany },
    ticketEvent: { create: eventCreate },
    teamMember: { findMany: teamMemberFindMany },
    user: { findMany: userFindMany },
    $transaction,
  } as unknown as PrismaService;

  const enqueueNotification = options.enqueueRejects
    ? vi.fn().mockRejectedValue(new Error('Redis unavailable'))
    : vi.fn().mockResolvedValue(undefined);
  const queue = { enqueueNotification } as unknown as QueueService;

  const emitTicketUpdated = vi.fn();
  const realtime = { emitTicketUpdated } as unknown as RealtimeService;

  return {
    service: new SlaService(prisma, queue, realtime),
    ticketFindMany,
    updateMany,
    eventCreate,
    enqueueNotification,
    emitTicketUpdated,
  };
};

describe('SlaService.runScan', () => {
  it('transitions ON_TRACK to AT_RISK once 80% of the window has elapsed', async () => {
    // window 60m, dueAt 13:00, atRiskAt = 12:48; at 12:48 it is at risk.
    const candidate = buildScanCandidate({
      resolutionState: SlaTargetState.MET, // ignore resolution target here
    });
    const { service, eventCreate, enqueueNotification, updateMany } =
      buildScanService([candidate], {
        users: [{ id: 'agent-1', role: { name: RoleName.AGENT } }],
        teamMembers: [{ userId: 'agent-1' }],
      });

    await service.runScan(new Date('2026-06-13T12:48:00.000Z'));

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'ticket-1', firstResponseState: SlaTargetState.ON_TRACK },
      data: { firstResponseState: SlaTargetState.AT_RISK },
    });
    expect(eventCreate).toHaveBeenCalledTimes(1);
    expect(eventCreate.mock.calls[0]![0].data.type).toBe(
      TicketEventType.SLA_AT_RISK,
    );
    expect(enqueueNotification).toHaveBeenCalledTimes(1);
  });

  it('transitions to BREACHED at the due timestamp boundary', async () => {
    const candidate = buildScanCandidate({
      resolutionState: SlaTargetState.MET,
    });
    const { service, eventCreate } = buildScanService([candidate], {
      users: [{ id: 'agent-1', role: { name: RoleName.AGENT } }],
      teamMembers: [{ userId: 'agent-1' }],
    });

    await service.runScan(new Date('2026-06-13T13:00:00.000Z'));

    expect(eventCreate.mock.calls[0]![0].data.type).toBe(
      TicketEventType.SLA_BREACHED,
    );
  });

  it('does not emit an event or notification when the guarded update matches nothing', async () => {
    const candidate = buildScanCandidate({
      resolutionState: SlaTargetState.MET,
    });
    const { service, eventCreate, enqueueNotification } = buildScanService(
      [candidate],
      { transitionCount: 0 },
    );

    await service.runScan(new Date('2026-06-13T13:00:00.000Z'));

    expect(eventCreate).not.toHaveBeenCalled();
    expect(enqueueNotification).not.toHaveBeenCalled();
  });

  it('excludes trashed tickets from the scan candidate query', async () => {
    const { service, ticketFindMany } = buildScanService([]);

    await service.runScan(new Date('2026-06-13T13:00:00.000Z'));

    expect(ticketFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });

  it('skips a target whose due date is null', async () => {
    const candidate = buildScanCandidate({
      firstResponseDueAt: null,
      resolutionState: SlaTargetState.MET,
    });
    const { service, updateMany } = buildScanService([candidate]);

    await service.runScan(new Date('2026-06-13T13:00:00.000Z'));

    expect(updateMany).not.toHaveBeenCalled();
  });

  it('excludes the requester and includes the assignee and team managers', async () => {
    const candidate = buildScanCandidate({
      resolutionState: SlaTargetState.MET,
    });
    const { service, enqueueNotification } = buildScanService([candidate], {
      teamMembers: [
        { userId: 'agent-1' },
        { userId: 'manager-1' },
        { userId: 'customer-1' },
      ],
      users: [
        { id: 'agent-1', role: { name: RoleName.AGENT } },
        { id: 'manager-1', role: { name: RoleName.MANAGER } },
      ],
    });

    await service.runScan(new Date('2026-06-13T13:00:00.000Z'));

    const [payload] = enqueueNotification.mock.calls[0]!;
    expect(payload.recipientUserIds).toEqual(
      expect.arrayContaining(['agent-1', 'manager-1']),
    );
    expect(payload.recipientUserIds).not.toContain('customer-1');
  });

  it('stays non-fatal when the notification enqueue rejects', async () => {
    const candidate = buildScanCandidate({
      resolutionState: SlaTargetState.MET,
    });
    const { service } = buildScanService([candidate], {
      enqueueRejects: true,
      users: [{ id: 'agent-1', role: { name: RoleName.AGENT } }],
      teamMembers: [{ userId: 'agent-1' }],
    });

    await expect(
      service.runScan(new Date('2026-06-13T13:00:00.000Z')),
    ).resolves.toBeUndefined();
  });
});
