import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  NotificationType,
  Prisma,
  RoleName,
  SlaPlanAppliesTo,
  SlaTargetState,
  TicketEventType,
  TicketStatus,
  type SlaPlan,
  type TicketPriority,
} from '@prisma/client';

import { PrismaService } from '../../common/database/prisma.service';
import { QueueService } from '../queue/queue.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  SLA_AT_RISK_REMAINING_FRACTION,
  buildSlaNotificationJobId,
  type SlaTarget,
} from './sla.constants';

const MINUTE_MS = 60_000;

const RESOLVED_STATUSES: ReadonlySet<TicketStatus> = new Set([
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED,
]);

const REOPEN_STATUSES: ReadonlySet<TicketStatus> = new Set([
  TicketStatus.OPEN,
  TicketStatus.PENDING,
]);

const scanTicketSelect = Prisma.validator<Prisma.TicketSelect>()({
  id: true,
  number: true,
  status: true,
  priority: true,
  requesterId: true,
  assigneeId: true,
  teamId: true,
  categoryId: true,
  updatedAt: true,
  firstResponseState: true,
  firstResponseDueAt: true,
  resolutionState: true,
  resolutionDueAt: true,
  slaPlan: {
    select: { firstResponseMinutes: true, resolutionMinutes: true },
  },
  tags: { select: { tagId: true } },
});

type ScanTicket = Prisma.TicketGetPayload<{ select: typeof scanTicketSelect }>;

export interface TicketSlaCreateData {
  slaPlanId?: string;
  firstResponseDueAt?: Date;
  resolutionDueAt?: Date;
}

export interface ResolutionTransitionSla {
  resolvedAt?: Date | null;
  resolutionState?: SlaTargetState;
  resolutionDueAt?: Date | null;
}

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QueueService) private readonly queueService: QueueService,
    @Inject(RealtimeService) private readonly realtimeService: RealtimeService,
  ) {}

  /**
   * Deterministic plan matching: the most specific active plan wins
   * (CATEGORY > PRIORITY > ALL). Ties within a tier are broken by oldest
   * createdAt, then lowest id, so duplicates resolve stably.
   */
  matchPlan(
    plans: ReadonlyArray<SlaPlan>,
    ticket: { categoryId: string | null; priority: TicketPriority },
  ): SlaPlan | null {
    const active = plans.filter((plan) => plan.isActive);

    const pick = (candidates: SlaPlan[]): SlaPlan | null => {
      if (candidates.length === 0) return null;
      return [...candidates].sort((left, right) => {
        const byCreated = left.createdAt.getTime() - right.createdAt.getTime();
        if (byCreated !== 0) return byCreated;
        return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
      })[0]!;
    };

    if (ticket.categoryId !== null) {
      const categoryPlan = pick(
        active.filter(
          (plan) =>
            plan.appliesTo === SlaPlanAppliesTo.CATEGORY &&
            plan.categoryId === ticket.categoryId,
        ),
      );
      if (categoryPlan) return categoryPlan;
    }

    const priorityPlan = pick(
      active.filter(
        (plan) =>
          plan.appliesTo === SlaPlanAppliesTo.PRIORITY &&
          plan.priority === ticket.priority,
      ),
    );
    if (priorityPlan) return priorityPlan;

    return pick(
      active.filter((plan) => plan.appliesTo === SlaPlanAppliesTo.ALL),
    );
  }

  computeDueDates(
    plan: Pick<SlaPlan, 'firstResponseMinutes' | 'resolutionMinutes'>,
    from: Date,
  ): { firstResponseDueAt: Date; resolutionDueAt: Date } {
    return {
      firstResponseDueAt: new Date(
        from.getTime() + plan.firstResponseMinutes * MINUTE_MS,
      ),
      resolutionDueAt: new Date(
        from.getTime() + plan.resolutionMinutes * MINUTE_MS,
      ),
    };
  }

  async resolvePlanForTicket(
    categoryId: string | null,
    priority: TicketPriority,
  ): Promise<SlaPlan | null> {
    const plans = await this.prisma.slaPlan.findMany({
      where: { isActive: true },
    });
    return this.matchPlan(plans, { categoryId, priority });
  }

  /** SLA fields to merge into a ticket create; empty when no plan matches. */
  async buildCreationSla(
    categoryId: string | null,
    priority: TicketPriority,
    now: Date,
  ): Promise<TicketSlaCreateData> {
    const plan = await this.resolvePlanForTicket(categoryId, priority);
    if (!plan) return {};

    const due = this.computeDueDates(plan, now);
    return {
      slaPlanId: plan.id,
      firstResponseDueAt: due.firstResponseDueAt,
      resolutionDueAt: due.resolutionDueAt,
    };
  }

  /**
   * Marks the first response as met exactly once. Guarded on firstRespondedAt
   * being null so repeat staff replies never move the timestamp or state again.
   * A late first response still transitions to MET (its breach was already
   * recorded by the scanner when the deadline passed).
   */
  async markFirstResponse(ticketId: string, now: Date): Promise<void> {
    await this.prisma.ticket.updateMany({
      where: { id: ticketId, firstRespondedAt: null },
      data: {
        firstRespondedAt: now,
        firstResponseState: SlaTargetState.MET,
      },
    });
  }

  /**
   * SLA changes to merge into a guarded status transition:
   *  - resolving (-> RESOLVED/CLOSED): stamp resolvedAt and mark resolution MET;
   *  - reopening (RESOLVED/CLOSED -> OPEN/PENDING): clear resolvedAt, reset
   *    resolution to ON_TRACK, and recompute resolutionDueAt from the plan and
   *    the reopen time. The first-response target is never touched here.
   */
  async resolveStatusTransitionSla(
    ticketId: string,
    fromStatus: TicketStatus,
    toStatus: TicketStatus,
    now: Date,
  ): Promise<ResolutionTransitionSla> {
    if (RESOLVED_STATUSES.has(toStatus)) {
      return { resolvedAt: now, resolutionState: SlaTargetState.MET };
    }

    if (RESOLVED_STATUSES.has(fromStatus) && REOPEN_STATUSES.has(toStatus)) {
      const plan = await this.loadTicketPlan(ticketId);
      return {
        resolvedAt: null,
        resolutionState: SlaTargetState.ON_TRACK,
        ...(plan
          ? {
              resolutionDueAt: new Date(
                now.getTime() + plan.resolutionMinutes * MINUTE_MS,
              ),
            }
          : {}),
      };
    }

    return {};
  }

  private async loadTicketPlan(
    ticketId: string,
  ): Promise<Pick<SlaPlan, 'resolutionMinutes'> | null> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { slaPlanId: true },
    });
    if (!ticket?.slaPlanId) return null;

    return this.prisma.slaPlan.findUnique({
      where: { id: ticket.slaPlanId },
      select: { resolutionMinutes: true },
    });
  }

  // ---- Background scanner ----------------------------------------------------

  async runScan(now: Date = new Date()): Promise<void> {
    const candidates = await this.prisma.ticket.findMany({
      where: {
        // Trashed tickets are excluded from SLA evaluation entirely.
        deletedAt: null,
        OR: [
          {
            firstResponseState: {
              in: [SlaTargetState.ON_TRACK, SlaTargetState.AT_RISK],
            },
            firstResponseDueAt: { not: null },
          },
          {
            resolutionState: {
              in: [SlaTargetState.ON_TRACK, SlaTargetState.AT_RISK],
            },
            resolutionDueAt: { not: null },
          },
        ],
      },
      select: scanTicketSelect,
    });

    for (const ticket of candidates) {
      await this.evaluateTarget(ticket, 'FIRST_RESPONSE', now);
      await this.evaluateTarget(ticket, 'RESOLUTION', now);
    }
  }

  private async evaluateTarget(
    ticket: ScanTicket,
    target: SlaTarget,
    now: Date,
  ): Promise<void> {
    const isFirstResponse = target === 'FIRST_RESPONSE';
    const state = isFirstResponse
      ? ticket.firstResponseState
      : ticket.resolutionState;
    const dueAt = isFirstResponse
      ? ticket.firstResponseDueAt
      : ticket.resolutionDueAt;
    const windowMinutes = isFirstResponse
      ? ticket.slaPlan?.firstResponseMinutes
      : ticket.slaPlan?.resolutionMinutes;

    if (!dueAt) return;
    if (state === SlaTargetState.MET || state === SlaTargetState.BREACHED) {
      return;
    }

    let nextState: SlaTargetState | null = null;
    if (now.getTime() >= dueAt.getTime()) {
      nextState = SlaTargetState.BREACHED;
    } else if (
      state === SlaTargetState.ON_TRACK &&
      windowMinutes !== undefined &&
      windowMinutes !== null &&
      now.getTime() >= this.atRiskAt(dueAt, windowMinutes)
    ) {
      nextState = SlaTargetState.AT_RISK;
    }

    if (nextState === null) return;

    const transitioned = await this.commitTransition(
      ticket.id,
      target,
      state,
      nextState,
      dueAt,
    );
    if (!transitioned) return;

    await this.notifyTransition(ticket, target, nextState);
    this.emitTicketUpdated(ticket);
  }

  /** At-risk fires once 80% of the window has elapsed (20% remaining). */
  private atRiskAt(dueAt: Date, windowMinutes: number): number {
    return (
      dueAt.getTime() -
      windowMinutes * MINUTE_MS * SLA_AT_RISK_REMAINING_FRACTION
    );
  }

  /** Concurrency-safe, idempotent transition + system event in one transaction. */
  private async commitTransition(
    ticketId: string,
    target: SlaTarget,
    fromState: SlaTargetState,
    toState: SlaTargetState,
    dueAt: Date,
  ): Promise<boolean> {
    const where: Prisma.TicketWhereInput =
      target === 'FIRST_RESPONSE'
        ? { id: ticketId, firstResponseState: fromState }
        : { id: ticketId, resolutionState: fromState };
    const data: Prisma.TicketUpdateManyMutationInput =
      target === 'FIRST_RESPONSE'
        ? { firstResponseState: toState }
        : { resolutionState: toState };

    try {
      return await this.prisma.$transaction(async (tx) => {
        const result = await tx.ticket.updateMany({ where, data });
        if (result.count === 0) return false;

        await tx.ticketEvent.create({
          data: {
            actorId: null,
            ticketId,
            type:
              toState === SlaTargetState.BREACHED
                ? TicketEventType.SLA_BREACHED
                : TicketEventType.SLA_AT_RISK,
            metadata: {
              target,
              previousState: fromState,
              newState: toState,
              dueAt: dueAt.toISOString(),
            },
          },
        });
        return true;
      });
    } catch (error) {
      this.logger.error({
        event: 'sla.transition_failed',
        ticketId,
        target,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private async notifyTransition(
    ticket: ScanTicket,
    target: SlaTarget,
    state: SlaTargetState,
  ): Promise<void> {
    const recipients = await this.resolveRecipients(ticket);
    if (recipients.length === 0) return;

    const isBreach = state === SlaTargetState.BREACHED;
    const targetLabel =
      target === 'FIRST_RESPONSE' ? 'first response' : 'resolution';
    const message = isBreach
      ? `Ticket #${ticket.number} has breached its ${targetLabel} SLA.`
      : `Ticket #${ticket.number} is at risk of breaching its ${targetLabel} SLA.`;

    try {
      await this.queueService.enqueueNotification(
        {
          message,
          recipientUserIds: recipients,
          ticketId: ticket.id,
          type: isBreach
            ? NotificationType.SLA_BREACHED
            : NotificationType.SLA_AT_RISK,
          source: { eventType: isBreach ? 'SLA_BREACHED' : 'SLA_AT_RISK' },
        },
        buildSlaNotificationJobId(
          ticket.id,
          target,
          isBreach ? 'BREACHED' : 'AT_RISK',
        ),
      );
    } catch (error) {
      this.logger.warn({
        event: 'sla.notification_enqueue_failed',
        ticketId: ticket.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Recipients are the assignee plus team managers; never the requester. */
  private async resolveRecipients(ticket: ScanTicket): Promise<string[]> {
    const candidateIds: string[] = [];
    if (ticket.assigneeId) candidateIds.push(ticket.assigneeId);
    if (ticket.teamId) {
      const members = await this.prisma.teamMember.findMany({
        where: { teamId: ticket.teamId },
        select: { userId: true },
      });
      candidateIds.push(...members.map((member) => member.userId));
    }

    const unique = [
      ...new Set(candidateIds.filter((id) => id !== ticket.requesterId)),
    ];
    if (unique.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      include: { role: true },
    });

    return users
      .filter(
        (user) =>
          user.role.name !== RoleName.CUSTOMER &&
          (user.id === ticket.assigneeId ||
            user.role.name === RoleName.MANAGER),
      )
      .map((user) => user.id);
  }

  private emitTicketUpdated(ticket: ScanTicket): void {
    try {
      this.realtimeService.emitTicketUpdated(ticket.id, {
        assigneeId: ticket.assigneeId,
        categoryId: ticket.categoryId,
        id: ticket.id,
        number: ticket.number,
        priority: ticket.priority,
        status: ticket.status,
        tagIds: ticket.tags.map((tag) => tag.tagId),
        teamId: ticket.teamId,
        updatedAt: ticket.updatedAt,
      });
    } catch (error) {
      this.logger.warn({
        event: 'sla.realtime_emit_failed',
        ticketId: ticket.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
