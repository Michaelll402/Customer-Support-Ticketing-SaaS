import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AssignmentRequestStatus,
  AssignmentRequestType,
  NotificationType,
  RoleName,
  TicketEventType,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/database/prisma.service';
import type { AccessTokenPayload } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import type { NotificationJobPayload } from '../queue/queue.constants';
import { QueueService } from '../queue/queue.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  AssignmentRequestDto,
  type AssignmentRequestRecord,
} from './dto/assignment-request.dto';
import type { AssignmentRequestListQueryDto } from './dto/assignment-request-list-query.dto';
import type { CreateAssignmentRequestDto } from './dto/create-assignment-request.dto';

type Actor = Pick<AccessTokenPayload, 'role' | 'sub'>;

const userSummarySelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} satisfies Prisma.UserSelect;

const assignmentRequestInclude = {
  requestedBy: { select: userSummarySelect },
  requestedAssignee: { select: userSummarySelect },
  reviewedBy: { select: userSummarySelect },
  ticket: {
    select: {
      id: true,
      number: true,
      subject: true,
      status: true,
      teamId: true,
      assigneeId: true,
      assignee: { select: userSummarySelect },
    },
  },
} satisfies Prisma.AssignmentRequestInclude;

@Injectable()
export class AssignmentRequestsService {
  private readonly logger = new Logger(AssignmentRequestsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QueueService) private readonly queueService: QueueService,
    @Inject(RealtimeService) private readonly realtimeService: RealtimeService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  // --- Create -------------------------------------------------------------

  async createForTicket(
    ticketId: string,
    actor: Actor,
    input: CreateAssignmentRequestDto,
  ): Promise<AssignmentRequestDto> {
    // Only agents use the request workflow; managers/admins assign directly.
    if (actor.role !== RoleName.AGENT) {
      throw new ForbiddenException(
        'Only agents submit reassignment requests. Managers and admins assign tickets directly.',
      );
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        number: true,
        teamId: true,
        assigneeId: true,
        deletedAt: true,
      },
    });

    // Trashed or missing tickets are opaque to agents.
    if (!ticket || ticket.deletedAt) {
      throw new NotFoundException('Ticket not found.');
    }

    if (ticket.assigneeId !== actor.sub) {
      throw new ForbiddenException(
        'Only the current assignee can request a reassignment for this ticket.',
      );
    }

    if (!ticket.teamId) {
      throw new BadRequestException(
        'This ticket is not owned by a team, so it cannot be reassigned through a request.',
      );
    }

    await this.validateRequestShape(input, ticket.teamId, ticket.assigneeId);

    // Guarded transaction: reject a second simultaneously-pending request from
    // the same agent on the same ticket with a 409.
    const created = await this.prisma.$transaction(async (tx) => {
      const existingPending = await tx.assignmentRequest.findFirst({
        where: {
          ticketId,
          requestedById: actor.sub,
          status: AssignmentRequestStatus.PENDING,
        },
        select: { id: true },
      });

      if (existingPending) {
        throw new ConflictException(
          'You already have a pending reassignment request for this ticket.',
        );
      }

      return tx.assignmentRequest.create({
        data: {
          ticketId,
          requestedById: actor.sub,
          requestedAssigneeId:
            input.type === AssignmentRequestType.REASSIGN_USER
              ? (input.requestedAssigneeId ?? null)
              : null,
          type: input.type,
          reason: input.reason,
        },
        include: assignmentRequestInclude,
      });
    });

    await this.recordAudit(
      actor.sub,
      'workflow.assignment_request.created',
      created,
    );
    await this.notifyReviewersOnCreate(created, ticket.teamId, ticket.number);
    await this.emitTicketUpdated(ticketId);

    return AssignmentRequestDto.fromRecord(created);
  }

  private async validateRequestShape(
    input: CreateAssignmentRequestDto,
    teamId: string,
    currentAssigneeId: string | null,
  ): Promise<void> {
    if (input.type === AssignmentRequestType.RETURN_TO_QUEUE) {
      if (input.requestedAssigneeId) {
        throw new BadRequestException(
          'RETURN_TO_QUEUE requests must not include a requestedAssigneeId.',
        );
      }
      return;
    }

    const requestedAssigneeId = input.requestedAssigneeId;
    if (!requestedAssigneeId) {
      throw new BadRequestException(
        'requestedAssigneeId is required for a REASSIGN_USER request.',
      );
    }

    if (requestedAssigneeId === currentAssigneeId) {
      throw new BadRequestException(
        'The requested assignee already owns this ticket.',
      );
    }

    const requestedUser = await this.prisma.user.findUnique({
      where: { id: requestedAssigneeId },
      select: { isActive: true, role: { select: { name: true } } },
    });

    if (!requestedUser || !requestedUser.isActive) {
      throw new BadRequestException(
        'The requested assignee does not exist or is inactive.',
      );
    }

    if (
      requestedUser.role.name !== RoleName.AGENT &&
      requestedUser.role.name !== RoleName.MANAGER
    ) {
      throw new BadRequestException(
        'The requested assignee must be an agent or manager.',
      );
    }

    const membership = await this.prisma.teamMember.findFirst({
      where: { userId: requestedAssigneeId, teamId },
      select: { id: true },
    });

    if (!membership) {
      throw new BadRequestException(
        'The requested assignee must belong to the ticket team.',
      );
    }
  }

  // --- Cancel -------------------------------------------------------------

  async cancelForTicket(
    ticketId: string,
    requestId: string,
    actor: Actor,
  ): Promise<AssignmentRequestDto> {
    const request = await this.prisma.assignmentRequest.findUnique({
      where: { id: requestId },
      include: assignmentRequestInclude,
    });

    if (!request || request.ticketId !== ticketId) {
      throw new NotFoundException('Assignment request not found.');
    }

    if (request.requestedById !== actor.sub) {
      throw new ForbiddenException(
        'You can only cancel your own assignment requests.',
      );
    }

    if (request.status !== AssignmentRequestStatus.PENDING) {
      throw new ConflictException(
        'This request has already been reviewed or cancelled.',
      );
    }

    const updated = await this.prisma.assignmentRequest.update({
      where: { id: requestId },
      data: { status: AssignmentRequestStatus.CANCELLED },
      include: assignmentRequestInclude,
    });

    await this.recordAudit(
      actor.sub,
      'workflow.assignment_request.cancelled',
      updated,
    );
    await this.emitTicketUpdated(ticketId);

    return AssignmentRequestDto.fromRecord(updated);
  }

  // --- Review (approve / reject) -----------------------------------------

  async approve(
    requestId: string,
    actor: Actor,
    reviewNote: string | undefined,
  ): Promise<AssignmentRequestDto> {
    return this.review(requestId, actor, 'APPROVE', reviewNote ?? null);
  }

  async reject(
    requestId: string,
    actor: Actor,
    reviewNote: string,
  ): Promise<AssignmentRequestDto> {
    return this.review(requestId, actor, 'REJECT', reviewNote);
  }

  private async review(
    requestId: string,
    actor: Actor,
    decision: 'APPROVE' | 'REJECT',
    reviewNote: string | null,
  ): Promise<AssignmentRequestDto> {
    const now = new Date();

    const outcome = await this.prisma.$transaction(async (tx) => {
      const request = await tx.assignmentRequest.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          type: true,
          status: true,
          requestedById: true,
          requestedAssigneeId: true,
          ticket: {
            select: {
              id: true,
              number: true,
              teamId: true,
              assigneeId: true,
              deletedAt: true,
            },
          },
        },
      });

      if (!request) {
        throw new NotFoundException('Assignment request not found.');
      }

      if (request.status !== AssignmentRequestStatus.PENDING) {
        throw new ConflictException('This request is no longer pending.');
      }

      const ticket = request.ticket;
      if (ticket.deletedAt) {
        throw new ConflictException(
          'The ticket is in the trash and cannot be modified.',
        );
      }

      await this.assertReviewerScope(tx, actor, ticket.teamId);

      if (decision === 'REJECT') {
        const updated = await tx.assignmentRequest.update({
          where: { id: request.id },
          data: {
            status: AssignmentRequestStatus.REJECTED,
            reviewedById: actor.sub,
            reviewedAt: now,
            reviewNote,
          },
          include: assignmentRequestInclude,
        });
        return {
          updated,
          ticketNumber: ticket.number,
          requesterId: request.requestedById,
          newAssigneeId: ticket.assigneeId,
          oldAssigneeId: ticket.assigneeId,
        };
      }

      // APPROVE: the owner must be unchanged since the request was created.
      if (ticket.assigneeId !== request.requestedById) {
        throw new ConflictException(
          'The ticket assignee changed after this request was created.',
        );
      }

      let newAssigneeId: string | null;
      if (request.type === AssignmentRequestType.REASSIGN_USER) {
        const requestedAssigneeId = request.requestedAssigneeId;
        if (!requestedAssigneeId || !ticket.teamId) {
          throw new ConflictException(
            'The requested assignee is no longer available.',
          );
        }

        const requestedUser = await tx.user.findUnique({
          where: { id: requestedAssigneeId },
          select: { isActive: true },
        });
        const membership = await tx.teamMember.findFirst({
          where: { userId: requestedAssigneeId, teamId: ticket.teamId },
          select: { id: true },
        });

        if (!requestedUser || !requestedUser.isActive || !membership) {
          throw new ConflictException(
            'The requested assignee is no longer active or no longer on the ticket team.',
          );
        }

        newAssigneeId = requestedAssigneeId;
      } else {
        newAssigneeId = null;
      }

      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          assigneeId: newAssigneeId,
          events: {
            create: {
              id: randomUUID(),
              actorId: actor.sub,
              type: TicketEventType.REASSIGNED,
              metadata: {
                fromAssigneeId: ticket.assigneeId,
                toAssigneeId: newAssigneeId,
                viaAssignmentRequestId: request.id,
              },
            },
          },
        },
      });

      const updated = await tx.assignmentRequest.update({
        where: { id: request.id },
        data: {
          status: AssignmentRequestStatus.APPROVED,
          reviewedById: actor.sub,
          reviewedAt: now,
          reviewNote,
        },
        include: assignmentRequestInclude,
      });

      return {
        updated,
        ticketNumber: ticket.number,
        requesterId: request.requestedById,
        newAssigneeId,
        oldAssigneeId: ticket.assigneeId,
      };
    });

    const action =
      decision === 'APPROVE'
        ? 'workflow.assignment_request.approved'
        : 'workflow.assignment_request.rejected';
    await this.recordAudit(actor.sub, action, outcome.updated);

    if (decision === 'APPROVE') {
      await this.notifyOnApprove(
        outcome.updated.id,
        outcome.ticketNumber,
        outcome.updated.ticketId,
        outcome.requesterId,
        outcome.newAssigneeId,
      );
    } else {
      await this.notifyOnReject(
        outcome.updated.id,
        outcome.ticketNumber,
        outcome.updated.ticketId,
        outcome.requesterId,
      );
    }

    await this.emitTicketUpdated(outcome.updated.ticketId);

    return AssignmentRequestDto.fromRecord(outcome.updated);
  }

  private async assertReviewerScope(
    tx: Prisma.TransactionClient,
    actor: Actor,
    teamId: string | null,
  ): Promise<void> {
    if (actor.role === RoleName.ADMIN) {
      return;
    }

    // Managers may only review requests for tickets in teams they belong to.
    if (!teamId) {
      throw new ForbiddenException(
        'You can only review requests for tickets in your teams.',
      );
    }

    const membership = await tx.teamMember.findFirst({
      where: { teamId, userId: actor.sub },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You can only review requests for tickets in your teams.',
      );
    }
  }

  // --- Read ---------------------------------------------------------------

  async listForReviewer(
    actor: Actor,
    query: AssignmentRequestListQueryDto,
  ): Promise<AssignmentRequestDto[]> {
    const status = query.status ?? AssignmentRequestStatus.PENDING;

    const where: Prisma.AssignmentRequestWhereInput = {
      status,
      // Requests on trashed tickets are never actionable, so they are excluded
      // from the review queue (they reappear automatically once restored).
      ticket: { deletedAt: null },
    };

    if (actor.role === RoleName.MANAGER) {
      where.ticket = {
        deletedAt: null,
        team: { members: { some: { userId: actor.sub } } },
      };
    }

    const requests = await this.prisma.assignmentRequest.findMany({
      where,
      include: assignmentRequestInclude,
      orderBy: { createdAt: 'asc' },
    });

    return requests.map((request) => AssignmentRequestDto.fromRecord(request));
  }

  async listForTicket(
    ticketId: string,
    actor: Actor,
  ): Promise<AssignmentRequestDto[]> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, teamId: true },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found.');
    }

    const where: Prisma.AssignmentRequestWhereInput = { ticketId };

    if (actor.role === RoleName.AGENT) {
      // Agents only ever see the requests they created.
      where.requestedById = actor.sub;
    } else if (actor.role === RoleName.MANAGER) {
      if (!ticket.teamId) {
        return [];
      }
      const membership = await this.prisma.teamMember.findFirst({
        where: { teamId: ticket.teamId, userId: actor.sub },
        select: { id: true },
      });
      if (!membership) {
        throw new ForbiddenException(
          'You can only view requests for tickets in your teams.',
        );
      }
    }

    const requests = await this.prisma.assignmentRequest.findMany({
      where,
      include: assignmentRequestInclude,
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((request) => AssignmentRequestDto.fromRecord(request));
  }

  // --- Side effects -------------------------------------------------------

  private async notifyReviewersOnCreate(
    request: AssignmentRequestRecord,
    teamId: string,
    ticketNumber: number,
  ): Promise<void> {
    const managers = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { name: RoleName.MANAGER },
        teamMemberships: { some: { teamId } },
      },
      select: { id: true },
    });

    const recipients = [
      ...new Set(
        managers
          .map((manager) => manager.id)
          .filter((id) => id !== request.requestedBy.id),
      ),
    ];

    if (recipients.length === 0) return;

    await this.safeEnqueue(
      {
        message: `A reassignment request on ticket #${ticketNumber} needs your review.`,
        recipientUserIds: recipients,
        source: {
          actorId: request.requestedBy.id,
          eventId: request.id,
          eventType: 'ASSIGNMENT_REQUEST_CREATED',
        },
        ticketId: request.ticketId,
        type: NotificationType.ASSIGNMENT_REQUEST_CREATED,
      },
      `ar:${request.id}:created`,
    );
  }

  private async notifyOnApprove(
    requestId: string,
    ticketNumber: number,
    ticketId: string,
    requesterId: string,
    newAssigneeId: string | null,
  ): Promise<void> {
    await this.safeEnqueue(
      {
        message: `Your reassignment request on ticket #${ticketNumber} was approved.`,
        recipientUserIds: [requesterId],
        source: {
          eventId: requestId,
          eventType: 'ASSIGNMENT_REQUEST_APPROVED',
        },
        ticketId,
        type: NotificationType.ASSIGNMENT_REQUEST_APPROVED,
      },
      `ar:${requestId}:approved`,
    );

    if (newAssigneeId && newAssigneeId !== requesterId) {
      await this.safeEnqueue(
        {
          message: `Ticket #${ticketNumber} was assigned to you.`,
          recipientUserIds: [newAssigneeId],
          source: { eventId: requestId, eventType: 'TICKET_ASSIGNED' },
          ticketId,
          type: NotificationType.TICKET_ASSIGNED,
        },
        `ar:${requestId}:assigned`,
      );
    }
  }

  private async notifyOnReject(
    requestId: string,
    ticketNumber: number,
    ticketId: string,
    requesterId: string,
  ): Promise<void> {
    await this.safeEnqueue(
      {
        message: `Your reassignment request on ticket #${ticketNumber} was declined.`,
        recipientUserIds: [requesterId],
        source: {
          eventId: requestId,
          eventType: 'ASSIGNMENT_REQUEST_REJECTED',
        },
        ticketId,
        type: NotificationType.ASSIGNMENT_REQUEST_REJECTED,
      },
      `ar:${requestId}:rejected`,
    );
  }

  private async recordAudit(
    actorId: string,
    action: string,
    request: AssignmentRequestRecord,
  ): Promise<void> {
    try {
      await this.auditService.record({
        actorId,
        action,
        targetType: 'AssignmentRequest',
        targetId: request.id,
        // Safe identifiers only — no reason/reviewNote text, no secrets.
        metadata: {
          ticketId: request.ticketId,
          requestId: request.id,
          requestType: request.type,
          status: request.status,
          requestedById: request.requestedBy.id,
          requestedAssigneeId: request.requestedAssignee?.id ?? null,
        },
      });
    } catch (error) {
      this.logger.warn({
        event: 'audit.record_failed',
        action,
        requestId: request.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async emitTicketUpdated(ticketId: string): Promise<void> {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        select: {
          id: true,
          number: true,
          status: true,
          priority: true,
          assigneeId: true,
          teamId: true,
          categoryId: true,
          updatedAt: true,
          tags: { select: { tagId: true } },
        },
      });

      if (!ticket) return;

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
        event: 'realtime.emit_failed_at_producer',
        error: error instanceof Error ? error.message : String(error),
        wsEvent: 'ticket.updated',
      });
    }
  }

  private async safeEnqueue(
    payload: NotificationJobPayload,
    jobId?: string,
  ): Promise<void> {
    try {
      await this.queueService.enqueueNotification(payload, jobId);
    } catch (error) {
      this.logger.warn({
        event: 'notification.enqueue_failed_at_producer',
        error: error instanceof Error ? error.message : String(error),
        notificationType: payload.type,
      });
    }
  }
}
