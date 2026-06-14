import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  NotificationType,
  Prisma,
  RoleName,
  TicketEventType,
  type TicketPriority,
  TicketStatus,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';

import type { AccessTokenPayload } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { QueueService } from '../queue/queue.service';
import type { NotificationJobPayload } from '../queue/queue.constants';
import { RealtimeService } from '../realtime/realtime.service';
import { SlaService } from '../sla/sla.service';
import { StorageService } from '../storage/storage.service';
import { PrismaService } from '../../common/database/prisma.service';
import type { AssignTicketDto } from './dto/assign-ticket.dto';
import { AssignableUserDto } from './dto/assignable-user.dto';
import type { AttachmentDownloadUrlDto } from './dto/ticket-attachment.dto';
import { TicketAttachmentDto } from './dto/ticket-attachment.dto';
import { TicketDetailDto } from './dto/ticket-detail.dto';
import { TicketCategoryOptionDto } from './dto/ticket-category-option.dto';
import { TicketMessageDto } from './dto/ticket-message.dto';
import { TicketTagOptionDto } from './dto/ticket-tag-option.dto';
import { TicketTeamOptionDto } from './dto/ticket-team-option.dto';
import type { CreateTicketDto } from './dto/create-ticket.dto';
import type { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import { SortOrder, TicketListSortBy } from './dto/ticket-list-query.dto';
import { TicketListItemDto } from './dto/ticket-list-item.dto';
import type { TicketListQueryDto } from './dto/ticket-list-query.dto';
import type { TicketListResponseDto } from './dto/ticket-list-response.dto';
import { TicketTimelineDto } from './dto/ticket-timeline.dto';
import type { TransferTicketTeamDto } from './dto/transfer-ticket-team.dto';
import type { UpdateTicketCategoryDto } from './dto/update-ticket-category.dto';
import type { UpdateTicketDto } from './dto/update-ticket.dto';
import type { UpdateTicketPriorityDto } from './dto/update-ticket-priority.dto';
import type { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import type { UpdateTicketTagsDto } from './dto/update-ticket-tags.dto';

const ticketDetailInclude = Prisma.validator<Prisma.TicketInclude>()({
  assignee: {
    select: {
      email: true,
      firstName: true,
      id: true,
      lastName: true,
    },
  },
  category: true,
  requester: {
    select: {
      email: true,
      firstName: true,
      id: true,
      lastName: true,
    },
  },
  tags: {
    include: {
      tag: true,
    },
  },
  team: true,
});

const ticketListInclude = Prisma.validator<Prisma.TicketInclude>()({
  assignee: {
    select: {
      email: true,
      firstName: true,
      id: true,
      lastName: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
    },
  },
  team: {
    select: {
      id: true,
      name: true,
    },
  },
});

const ticketMessageInclude = Prisma.validator<Prisma.TicketMessageInclude>()({
  attachments: {
    orderBy: {
      createdAt: 'asc',
    },
  },
  author: {
    select: {
      email: true,
      firstName: true,
      id: true,
      lastName: true,
    },
  },
});

const ticketTimelineEventInclude =
  Prisma.validator<Prisma.TicketEventInclude>()({
    actor: {
      select: {
        email: true,
        firstName: true,
        id: true,
        lastName: true,
      },
    },
  });

export type TicketDetailRecord = Prisma.TicketGetPayload<{
  include: typeof ticketDetailInclude;
}>;

export type TicketListRecord = Prisma.TicketGetPayload<{
  include: typeof ticketListInclude;
}>;

export type TicketMessageRecord = Prisma.TicketMessageGetPayload<{
  include: typeof ticketMessageInclude;
}>;

export type TicketTimelineMessageRecord = TicketMessageRecord;

export type TicketTimelineEventRecord = Prisma.TicketEventGetPayload<{
  include: typeof ticketTimelineEventInclude;
}>;

type TicketVisibilityViewer = Pick<AccessTokenPayload, 'role' | 'sub'>;
type VisibleTicketForMutation = {
  id: string;
  status: TicketStatus;
};

type VisibleTicketForWorkflow = {
  id: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId: string | null;
  teamId: string | null;
  categoryId: string | null;
};

export const TICKET_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

const DEFAULT_TICKET_TEAM_NAME = 'Technical Support';

const CATEGORY_NAME_TO_TEAM_NAME: Record<string, string> = {
  Billing: 'Billing',
};

const STAFF_ROLES: ReadonlySet<RoleName> = new Set<RoleName>([
  RoleName.AGENT,
  RoleName.MANAGER,
  RoleName.ADMIN,
]);

const ALLOWED_STAFF_STATUS_TRANSITIONS: Record<
  TicketStatus,
  ReadonlyArray<TicketStatus>
> = {
  [TicketStatus.OPEN]: [
    TicketStatus.PENDING,
    TicketStatus.RESOLVED,
    TicketStatus.CLOSED,
  ],
  [TicketStatus.PENDING]: [
    TicketStatus.OPEN,
    TicketStatus.RESOLVED,
    TicketStatus.CLOSED,
  ],
  [TicketStatus.RESOLVED]: [TicketStatus.OPEN, TicketStatus.CLOSED],
  [TicketStatus.CLOSED]: [TicketStatus.OPEN],
};

// Allow-list of system event types a customer may see on their own ticket
// timeline. Anything not listed here (assignment, team transfer, tagging,
// categorization, priority changes, internal notes/attachments) is internal
// staff workflow and is filtered out at the query layer. Using an allow-list
// keeps the filter fail-closed: any new event type is hidden from customers
// until it is explicitly added here.
const CUSTOMER_VISIBLE_TIMELINE_EVENT_TYPES: ReadonlyArray<TicketEventType> = [
  TicketEventType.CREATED,
  TicketEventType.STATUS_CHANGED,
  TicketEventType.CLOSED_BY_CUSTOMER,
  TicketEventType.REOPENED_BY_CUSTOMER,
  TicketEventType.REPLIED,
];

const TICKET_ATTACHMENT_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/csv',
  'text/plain',
]);

export type TicketAttachmentUploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(QueueService) private readonly queueService: QueueService,
    @Inject(RealtimeService) private readonly realtimeService: RealtimeService,
    @Inject(SlaService) private readonly slaService: SlaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async listTicketCategories(): Promise<TicketCategoryOptionDto[]> {
    const categories = await this.prisma.category.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    return categories.map((category) =>
      TicketCategoryOptionDto.fromCategory(category),
    );
  }

  async listTickets(
    viewer: TicketVisibilityViewer,
    query: TicketListQueryDto,
  ): Promise<TicketListResponseDto> {
    const where = this.buildListWhere(viewer, query);
    const orderBy = this.buildListOrderBy(query.sortBy, query.sortOrder);
    const skip = (query.page - 1) * query.limit;

    const [totalItems, visibleTickets] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        include: ticketListInclude,
        orderBy,
        skip,
        take: query.limit,
      }),
    ]);

    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / query.limit);
    const includeStaffEmail = viewer.role !== RoleName.CUSTOMER;
    const items = visibleTickets.map((ticket) =>
      TicketListItemDto.fromRecord(ticket, includeStaffEmail),
    );

    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1 && totalPages > 0,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
    };
  }

  async createTicket(
    requester: TicketVisibilityViewer,
    input: CreateTicketDto,
  ): Promise<TicketDetailDto> {
    if (requester.role !== RoleName.CUSTOMER) {
      throw new ForbiddenException('Only customers can create tickets.');
    }

    const requesterExists = await this.prisma.user.findUnique({
      where: {
        id: requester.sub,
      },
      select: {
        id: true,
      },
    });

    if (!requesterExists) {
      throw new UnauthorizedException('Authenticated user no longer exists.');
    }

    let resolvedCategory: { id: string; name: string } | null = null;

    if (input.categoryId) {
      resolvedCategory = await this.prisma.category.findUnique({
        where: {
          id: input.categoryId,
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!resolvedCategory) {
        throw new NotFoundException('Category not found.');
      }
    }

    const teamId = await this.resolveTeamIdForCategory(
      resolvedCategory?.name ?? null,
    );

    // Compute SLA due dates from the matching plan (if any). Without a plan the
    // returned fragment is empty, so the ticket keeps null due dates.
    const sla = await this.slaService.buildCreationSla(
      input.categoryId ?? null,
      input.priority,
      new Date(),
    );

    const ticket = await this.prisma.ticket.create({
      data: {
        categoryId: input.categoryId ?? null,
        description: input.description,
        priority: input.priority,
        requesterId: requester.sub,
        status: TicketStatus.OPEN,
        subject: input.subject,
        teamId,
        ...sla,
        events: {
          create: {
            actorId: requester.sub,
            type: TicketEventType.CREATED,
          },
        },
      },
      include: ticketDetailInclude,
    });

    // The creator is always a customer, so staff emails are withheld.
    return TicketDetailDto.fromRecord(ticket, false);
  }

  private async resolveTeamIdForCategory(
    categoryName: string | null,
  ): Promise<string | null> {
    const targetTeamName =
      (categoryName !== null && CATEGORY_NAME_TO_TEAM_NAME[categoryName]) ||
      DEFAULT_TICKET_TEAM_NAME;
    const team = await this.prisma.team.findUnique({
      where: {
        name: targetTeamName,
      },
      select: {
        id: true,
      },
    });
    return team?.id ?? null;
  }

  async updateTicket(
    ticketId: string,
    viewer: TicketVisibilityViewer,
    input: UpdateTicketDto,
  ): Promise<TicketDetailDto> {
    if (viewer.role !== RoleName.CUSTOMER) {
      throw new ForbiddenException('Only customers can patch tickets.');
    }

    if (
      input.subject === undefined &&
      input.description === undefined &&
      input.status === undefined
    ) {
      throw new BadRequestException(
        'Provide at least one allowed ticket field to update.',
      );
    }

    const visibleTicket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        requesterId: viewer.sub,
      },
      include: ticketDetailInclude,
    });

    if (!visibleTicket) {
      const ticketExists = await this.prisma.ticket.findUnique({
        where: {
          id: ticketId,
        },
        select: {
          id: true,
        },
      });

      if (!ticketExists) {
        throw new NotFoundException('Ticket not found.');
      }

      throw new ForbiddenException('You do not have access to this ticket.');
    }

    const data: Prisma.TicketUpdateInput = {};
    let eventCreate:
      | Prisma.TicketEventUncheckedCreateWithoutTicketInput
      | undefined;

    if (input.subject !== undefined) {
      data.subject = input.subject;
    }

    if (input.description !== undefined) {
      data.description = input.description;
    }

    if (input.status !== undefined) {
      if (input.status === TicketStatus.CLOSED) {
        if (visibleTicket.status === TicketStatus.CLOSED) {
          throw new BadRequestException('Ticket is already closed.');
        }

        data.status = TicketStatus.CLOSED;
        eventCreate = {
          actorId: viewer.sub,
          metadata: {
            fromStatus: visibleTicket.status,
            toStatus: TicketStatus.CLOSED,
          },
          type: TicketEventType.CLOSED_BY_CUSTOMER,
        };
      } else if (input.status === TicketStatus.OPEN) {
        if (visibleTicket.status !== TicketStatus.CLOSED) {
          throw new BadRequestException(
            'Only closed tickets can be reopened by customers.',
          );
        }

        data.status = TicketStatus.OPEN;
        eventCreate = {
          actorId: viewer.sub,
          metadata: {
            fromStatus: visibleTicket.status,
            toStatus: TicketStatus.OPEN,
          },
          type: TicketEventType.REOPENED_BY_CUSTOMER,
        };
      } else {
        throw new BadRequestException(
          'Customers may only close or reopen their own tickets.',
        );
      }
    }

    if (eventCreate) {
      data.events = {
        create: eventCreate,
      };
    }

    const updatedTicket = await this.prisma.ticket.update({
      where: {
        id: visibleTicket.id,
      },
      data,
      include: ticketDetailInclude,
    });

    // This narrow patch route is customer-only, so staff emails are withheld.
    return TicketDetailDto.fromRecord(updatedTicket, false);
  }

  async createPublicReply(
    ticketId: string,
    viewer: TicketVisibilityViewer,
    input: CreateTicketMessageDto,
  ): Promise<TicketMessageDto> {
    const visibleTicket = await this.findVisibleTicketForMutation(
      ticketId,
      viewer,
    );

    if (visibleTicket.status === TicketStatus.CLOSED) {
      throw new BadRequestException(
        'Closed tickets cannot receive public replies.',
      );
    }

    const message = await this.createMessageWithEvent({
      actorId: viewer.sub,
      attachmentIds: input.attachmentIds ?? [],
      body: input.body,
      isInternal: false,
      ticketId: visibleTicket.id,
      type: TicketEventType.REPLIED,
    });

    // The first PUBLIC reply by a staff member stops the first-response SLA
    // clock. Customer replies and internal notes never count.
    if (STAFF_ROLES.has(viewer.role)) {
      await this.markFirstResponseSafely(visibleTicket.id);
    }

    await this.produceReplyNotification(
      visibleTicket.id,
      viewer.sub,
      message.id,
    );

    try {
      this.realtimeService.emitTicketMessageCreatedPublic(visibleTicket.id, {
        authorId: message.authorId,
        createdAt: message.createdAt,
        id: message.id,
        isInternal: false,
        ticketId: visibleTicket.id,
      });
    } catch (error) {
      this.logger.warn({
        event: 'realtime.emit_failed_at_producer',
        error: error instanceof Error ? error.message : String(error),
        wsEvent: 'ticket.message.created.public',
      });
    }

    return TicketMessageDto.fromRecord(message);
  }

  async createInternalNote(
    ticketId: string,
    viewer: TicketVisibilityViewer,
    input: CreateTicketMessageDto,
  ): Promise<TicketMessageDto> {
    if (viewer.role === RoleName.CUSTOMER) {
      throw new ForbiddenException('Customers cannot create internal notes.');
    }

    const visibleTicket = await this.findVisibleTicketForMutation(
      ticketId,
      viewer,
    );

    const message = await this.createMessageWithEvent({
      actorId: viewer.sub,
      attachmentIds: input.attachmentIds ?? [],
      body: input.body,
      isInternal: true,
      ticketId: visibleTicket.id,
      type: TicketEventType.NOTE_ADDED,
    });

    await this.produceInternalNoteNotification(
      visibleTicket.id,
      viewer.sub,
      message.id,
    );

    try {
      this.realtimeService.emitTicketMessageCreatedInternal(visibleTicket.id, {
        authorId: message.authorId,
        createdAt: message.createdAt,
        id: message.id,
        isInternal: true,
        ticketId: visibleTicket.id,
      });
    } catch (error) {
      this.logger.warn({
        event: 'realtime.emit_failed_at_producer',
        error: error instanceof Error ? error.message : String(error),
        wsEvent: 'ticket.message.created.internal',
      });
    }

    return TicketMessageDto.fromRecord(message);
  }

  async getTicketTimeline(
    ticketId: string,
    viewer: TicketVisibilityViewer,
  ): Promise<TicketTimelineDto> {
    const visibleTicket = await this.findVisibleTicketForMutation(
      ticketId,
      viewer,
    );
    const messageWhere: Prisma.TicketMessageWhereInput = {
      ticketId: visibleTicket.id,
    };
    const eventWhere: Prisma.TicketEventWhereInput = {
      ticketId: visibleTicket.id,
    };

    if (viewer.role === RoleName.CUSTOMER) {
      messageWhere.isInternal = false;
      eventWhere.type = {
        in: [...CUSTOMER_VISIBLE_TIMELINE_EVENT_TYPES],
      };
    }

    const [messages, events] = await Promise.all([
      this.prisma.ticketMessage.findMany({
        where: messageWhere,
        include: ticketMessageInclude,
        orderBy: {
          createdAt: 'asc',
        },
      }),
      this.prisma.ticketEvent.findMany({
        where: eventWhere,
        include: ticketTimelineEventInclude,
        orderBy: {
          createdAt: 'asc',
        },
      }),
    ]);

    return TicketTimelineDto.fromRecords(
      visibleTicket.id,
      messages,
      events,
      viewer.role !== RoleName.CUSTOMER,
    );
  }

  async uploadTicketAttachment(
    ticketId: string,
    viewer: TicketVisibilityViewer,
    file: TicketAttachmentUploadFile | undefined,
  ): Promise<TicketAttachmentDto> {
    const visibleTicket = await this.findVisibleTicketForMutation(
      ticketId,
      viewer,
    );
    const normalizedFile = this.validateAttachmentFile(file);
    const storedKey = this.buildAttachmentStoredKey(
      visibleTicket.id,
      normalizedFile.filename,
    );

    await this.storage.upload({
      buffer: normalizedFile.buffer,
      key: storedKey,
      mimeType: normalizedFile.mimeType,
    });

    try {
      const attachment = await this.prisma.$transaction(async (transaction) => {
        const createdAttachment = await transaction.attachment.create({
          data: {
            filename: normalizedFile.filename,
            messageId: null,
            mimeType: normalizedFile.mimeType,
            sizeBytes: normalizedFile.sizeBytes,
            storedKey,
            ticketId: visibleTicket.id,
            uploadedById: viewer.sub,
          },
        });

        await transaction.ticketEvent.create({
          data: {
            actorId: viewer.sub,
            metadata: {
              attachmentId: createdAttachment.id,
              filename: createdAttachment.filename,
              mimeType: createdAttachment.mimeType,
              sizeBytes: createdAttachment.sizeBytes,
            },
            ticketId: visibleTicket.id,
            type: TicketEventType.ATTACHMENT_ADDED,
          },
        });

        return createdAttachment;
      });

      return TicketAttachmentDto.fromRecord(attachment);
    } catch (error) {
      await this.storage.delete(storedKey).catch(() => undefined);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('Attachment metadata failed.');
    }
  }

  async getTicketAttachmentDownloadUrl(
    ticketId: string,
    attachmentId: string,
    viewer: TicketVisibilityViewer,
  ): Promise<AttachmentDownloadUrlDto> {
    const visibleTicket = await this.findVisibleTicketForMutation(
      ticketId,
      viewer,
    );
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        ticketId: visibleTicket.id,
      },
      include: {
        message: {
          select: {
            id: true,
            isInternal: true,
            ticketId: true,
          },
        },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found.');
    }

    if (viewer.role === RoleName.CUSTOMER) {
      if (
        !attachment.message ||
        attachment.message.ticketId !== visibleTicket.id ||
        attachment.message.isInternal
      ) {
        throw new ForbiddenException(
          'You do not have access to this attachment.',
        );
      }
    }

    return this.storage.getSignedUrl(attachment.storedKey, {
      downloadFilename: attachment.filename,
    });
  }

  async getTicketById(
    ticketId: string,
    viewer: TicketVisibilityViewer,
  ): Promise<TicketDetailDto> {
    const visibleTicket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        ...this.buildVisibilityWhere(viewer),
      },
      include: ticketDetailInclude,
    });

    if (visibleTicket) {
      return TicketDetailDto.fromRecord(
        visibleTicket,
        viewer.role !== RoleName.CUSTOMER,
      );
    }

    const ticketExists = await this.prisma.ticket.findUnique({
      where: {
        id: ticketId,
      },
      select: {
        id: true,
      },
    });

    if (!ticketExists) {
      throw new NotFoundException('Ticket not found.');
    }

    throw new ForbiddenException('You do not have access to this ticket.');
  }

  async assignTicket(
    ticketId: string,
    viewer: TicketVisibilityViewer,
    input: AssignTicketDto,
  ): Promise<TicketDetailDto> {
    this.requireStaff(viewer);

    const visibleTicket = await this.findVisibleTicketForWorkflow(
      ticketId,
      viewer,
    );

    if (input.assigneeId === visibleTicket.assigneeId) {
      return this.loadTicketDetail(ticketId);
    }

    if (input.assigneeId !== null) {
      const assigneeUser = await this.prisma.user.findUnique({
        where: {
          id: input.assigneeId,
        },
        include: {
          role: true,
        },
      });

      if (!assigneeUser || !STAFF_ROLES.has(assigneeUser.role.name)) {
        throw new BadRequestException(
          'Assignee must be an agent, manager, or admin.',
        );
      }

      if (viewer.role !== RoleName.ADMIN) {
        if (visibleTicket.teamId === null) {
          throw new ForbiddenException(
            'Only admins can assign tickets without a team.',
          );
        }

        const membership = await this.prisma.teamMember.findFirst({
          where: {
            userId: input.assigneeId,
            teamId: visibleTicket.teamId,
          },
        });

        if (!membership) {
          throw new BadRequestException(
            'Assignee must belong to the ticket team.',
          );
        }
      }
    }

    const eventType =
      visibleTicket.assigneeId === null && input.assigneeId !== null
        ? TicketEventType.ASSIGNED
        : TicketEventType.REASSIGNED;
    const eventId = randomUUID();

    const updated = await this.prisma.ticket.update({
      where: {
        id: visibleTicket.id,
      },
      data: {
        assigneeId: input.assigneeId,
        events: {
          create: {
            id: eventId,
            actorId: viewer.sub,
            metadata: {
              fromAssigneeId: visibleTicket.assigneeId,
              toAssigneeId: input.assigneeId,
            },
            type: eventType,
          },
        },
      },
      include: ticketDetailInclude,
    });

    if (input.assigneeId !== null && input.assigneeId !== viewer.sub) {
      await this.produceAssignmentNotification({
        actorId: viewer.sub,
        eventId,
        eventType,
        newAssigneeId: input.assigneeId,
        ticketId: updated.id,
        ticketNumber: updated.number,
      });
    }

    const dto = TicketDetailDto.fromRecord(updated);
    this.emitTicketUpdatedFromDto(dto);
    return dto;
  }

  async updateTicketStatus(
    ticketId: string,
    viewer: TicketVisibilityViewer,
    input: UpdateTicketStatusDto,
  ): Promise<TicketDetailDto> {
    this.requireStaff(viewer);

    const visibleTicket = await this.findVisibleTicketForWorkflow(
      ticketId,
      viewer,
    );
    const fromStatus = visibleTicket.status;

    if (input.status === fromStatus) {
      return this.loadTicketDetail(ticketId);
    }

    const allowed = ALLOWED_STAFF_STATUS_TRANSITIONS[fromStatus];

    if (!allowed.includes(input.status)) {
      throw new BadRequestException(
        `Status transition from ${fromStatus} to ${input.status} is not allowed.`,
      );
    }

    const eventId = randomUUID();

    // Resolution SLA changes applied atomically with the status transition:
    // resolving stamps resolvedAt/MET; reopening clears it and recomputes the
    // resolution due date. First response is untouched here.
    const slaData = await this.slaService.resolveStatusTransitionSla(
      visibleTicket.id,
      fromStatus,
      input.status,
      new Date(),
    );

    // Atomic guarded transition: the update only succeeds while the row is still
    // in `fromStatus`, so two concurrent requests cannot both commit and produce
    // an effective transition the matrix forbids. A zero count means another
    // request changed the status first -> surface a 409 instead of writing a
    // misleading TicketEvent.
    await this.prisma.$transaction(async (tx) => {
      const transition = await tx.ticket.updateMany({
        where: {
          id: visibleTicket.id,
          status: fromStatus,
        },
        data: {
          status: input.status,
          ...slaData,
        },
      });

      if (transition.count === 0) {
        throw new ConflictException(
          'Ticket status changed concurrently. Reload the ticket and try again.',
        );
      }

      await tx.ticketEvent.create({
        data: {
          id: eventId,
          actorId: viewer.sub,
          ticketId: visibleTicket.id,
          metadata: {
            fromStatus,
            toStatus: input.status,
          },
          type: TicketEventType.STATUS_CHANGED,
        },
      });
    });

    const dto = await this.loadTicketDetail(ticketId);

    await this.produceStatusChangeNotification({
      actorId: viewer.sub,
      assigneeId: dto.assignee?.id ?? null,
      eventId,
      fromStatus,
      requesterId: dto.requester.id,
      ticketId: dto.id,
      ticketNumber: dto.number,
      toStatus: input.status,
    });

    this.emitTicketUpdatedFromDto(dto);
    return dto;
  }

  async updateTicketPriority(
    ticketId: string,
    viewer: TicketVisibilityViewer,
    input: UpdateTicketPriorityDto,
  ): Promise<TicketDetailDto> {
    this.requireStaff(viewer);

    const visibleTicket = await this.findVisibleTicketForWorkflow(
      ticketId,
      viewer,
    );

    if (input.priority === visibleTicket.priority) {
      return this.loadTicketDetail(ticketId);
    }

    const updated = await this.prisma.ticket.update({
      where: {
        id: visibleTicket.id,
      },
      data: {
        priority: input.priority,
        events: {
          create: {
            actorId: viewer.sub,
            metadata: {
              fromPriority: visibleTicket.priority,
              toPriority: input.priority,
            },
            type: TicketEventType.PRIORITY_CHANGED,
          },
        },
      },
      include: ticketDetailInclude,
    });

    const dto = TicketDetailDto.fromRecord(updated);
    this.emitTicketUpdatedFromDto(dto);
    return dto;
  }

  async updateTicketTags(
    ticketId: string,
    viewer: TicketVisibilityViewer,
    input: UpdateTicketTagsDto,
  ): Promise<TicketDetailDto> {
    this.requireStaff(viewer);

    const visibleTicket = await this.findVisibleTicketForWorkflow(
      ticketId,
      viewer,
    );
    const uniqueTagIds = [...new Set(input.tagIds)];

    if (uniqueTagIds.length > 0) {
      const existingTags = await this.prisma.tag.findMany({
        where: {
          id: {
            in: uniqueTagIds,
          },
        },
        select: {
          id: true,
        },
      });

      if (existingTags.length !== uniqueTagIds.length) {
        throw new BadRequestException('One or more tag IDs do not exist.');
      }
    }

    const currentLinks = await this.prisma.ticketTag.findMany({
      where: {
        ticketId: visibleTicket.id,
      },
      select: {
        tagId: true,
      },
    });
    const currentTagIds = new Set(currentLinks.map((link) => link.tagId));
    const requestedTagIds = new Set(uniqueTagIds);
    const added = uniqueTagIds.filter((id) => !currentTagIds.has(id));
    const removed = [...currentTagIds].filter((id) => !requestedTagIds.has(id));

    if (added.length === 0 && removed.length === 0) {
      return this.loadTicketDetail(ticketId);
    }

    await this.prisma.$transaction(async (tx) => {
      if (removed.length > 0) {
        await tx.ticketTag.deleteMany({
          where: {
            ticketId: visibleTicket.id,
            tagId: {
              in: removed,
            },
          },
        });
      }

      if (added.length > 0) {
        await tx.ticketTag.createMany({
          data: added.map((tagId) => ({
            ticketId: visibleTicket.id,
            tagId,
          })),
        });
      }

      await tx.ticket.update({
        where: {
          id: visibleTicket.id,
        },
        data: {
          events: {
            create: {
              actorId: viewer.sub,
              metadata: {
                added,
                removed,
              },
              type: TicketEventType.TAGGED,
            },
          },
        },
      });
    });

    const dto = await this.loadTicketDetail(ticketId);
    this.emitTicketUpdatedFromDto(dto);
    return dto;
  }

  async updateTicketCategory(
    ticketId: string,
    viewer: TicketVisibilityViewer,
    input: UpdateTicketCategoryDto,
  ): Promise<TicketDetailDto> {
    this.requireStaff(viewer);

    const visibleTicket = await this.findVisibleTicketForWorkflow(
      ticketId,
      viewer,
    );

    if (input.categoryId === visibleTicket.categoryId) {
      return this.loadTicketDetail(ticketId);
    }

    if (input.categoryId !== null) {
      const category = await this.prisma.category.findUnique({
        where: {
          id: input.categoryId,
        },
        select: {
          id: true,
        },
      });

      if (!category) {
        throw new NotFoundException('Category not found.');
      }
    }

    const updated = await this.prisma.ticket.update({
      where: {
        id: visibleTicket.id,
      },
      data: {
        categoryId: input.categoryId,
        events: {
          create: {
            actorId: viewer.sub,
            metadata: {
              fromCategoryId: visibleTicket.categoryId,
              toCategoryId: input.categoryId,
            },
            type: TicketEventType.CATEGORIZED,
          },
        },
      },
      include: ticketDetailInclude,
    });

    const dto = TicketDetailDto.fromRecord(updated);
    this.emitTicketUpdatedFromDto(dto);
    return dto;
  }

  async transferTicketTeam(
    ticketId: string,
    viewer: TicketVisibilityViewer,
    input: TransferTicketTeamDto,
  ): Promise<TicketDetailDto> {
    if (viewer.role !== RoleName.MANAGER && viewer.role !== RoleName.ADMIN) {
      throw new ForbiddenException(
        'Only managers and admins can transfer tickets between teams.',
      );
    }

    const visibleTicket = await this.findVisibleTicketForWorkflow(
      ticketId,
      viewer,
    );

    if (visibleTicket.teamId === input.teamId) {
      return this.loadTicketDetail(ticketId);
    }

    const destinationTeam = await this.prisma.team.findUnique({
      where: {
        id: input.teamId,
      },
      select: {
        id: true,
      },
    });

    if (!destinationTeam) {
      throw new NotFoundException('Destination team not found.');
    }

    if (viewer.role === RoleName.MANAGER) {
      const managerAccess = await this.prisma.teamMember.findFirst({
        where: {
          userId: viewer.sub,
          teamId: input.teamId,
        },
      });

      if (!managerAccess) {
        throw new ForbiddenException(
          'Managers can only transfer tickets to teams they belong to.',
        );
      }
    }

    let mustClearAssignee = false;
    if (visibleTicket.assigneeId !== null) {
      const assigneeMembership = await this.prisma.teamMember.findFirst({
        where: {
          userId: visibleTicket.assigneeId,
          teamId: input.teamId,
        },
      });

      if (!assigneeMembership) {
        mustClearAssignee = true;
      }
    }

    const fromTeamId = visibleTicket.teamId;
    const fromAssigneeId = visibleTicket.assigneeId;

    await this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: {
          id: visibleTicket.id,
        },
        data: {
          teamId: input.teamId,
          ...(mustClearAssignee ? { assigneeId: null } : {}),
        },
      });

      await tx.ticketEvent.create({
        data: {
          actorId: viewer.sub,
          ticketId: visibleTicket.id,
          metadata: {
            fromTeamId,
            toTeamId: input.teamId,
          },
          type: TicketEventType.TEAM_TRANSFERRED,
        },
      });

      if (mustClearAssignee) {
        await tx.ticketEvent.create({
          data: {
            actorId: viewer.sub,
            ticketId: visibleTicket.id,
            metadata: {
              fromAssigneeId,
              toAssigneeId: null,
            },
            type: TicketEventType.REASSIGNED,
          },
        });
      }
    });

    const dto = await this.loadTicketDetail(ticketId);
    this.emitTicketUpdatedFromDto(dto);
    return dto;
  }

  async moveTicketToTrash(
    ticketId: string,
    viewer: TicketVisibilityViewer,
  ): Promise<void> {
    this.requireAdmin(viewer);

    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, deletedAt: null },
      select: { id: true, number: true, subject: true },
    });

    if (!ticket) {
      const exists = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true },
      });

      if (exists) {
        throw new ConflictException('Ticket is already in the trash.');
      }

      throw new NotFoundException('Ticket not found.');
    }

    // Soft delete: the row and all of its conversation/SLA history are kept so
    // the action is fully reversible via restore.
    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { deletedAt: new Date(), deletedById: viewer.sub },
    });

    await this.recordTicketAudit(viewer.sub, 'admin.ticket.trashed', ticket);
    await this.emitTicketUpdatedAfterTrashChange(ticket.id);
  }

  async restoreTicket(
    ticketId: string,
    viewer: TicketVisibilityViewer,
  ): Promise<TicketDetailDto> {
    this.requireAdmin(viewer);

    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, deletedAt: { not: null } },
      select: { id: true, number: true, subject: true },
    });

    if (!ticket) {
      const exists = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true },
      });

      if (exists) {
        throw new ConflictException('Ticket is not in the trash.');
      }

      throw new NotFoundException('Ticket not found.');
    }

    // Restore preserves every relation (messages, events, attachments, team,
    // assignee, status, and SLA history) — only the trash markers are cleared.
    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { deletedAt: null, deletedById: null },
    });

    await this.recordTicketAudit(viewer.sub, 'admin.ticket.restored', ticket);

    const dto = await this.loadTicketDetail(ticketId);
    this.emitTicketUpdatedFromDto(dto);
    return dto;
  }

  async listTrashedTickets(
    viewer: TicketVisibilityViewer,
    query: TicketListQueryDto,
  ): Promise<TicketListResponseDto> {
    this.requireAdmin(viewer);

    const where: Prisma.TicketWhereInput = { deletedAt: { not: null } };
    const orderBy = this.buildListOrderBy(query.sortBy, query.sortOrder);
    const skip = (query.page - 1) * query.limit;

    const [totalItems, tickets] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        include: ticketListInclude,
        orderBy,
        skip,
        take: query.limit,
      }),
    ]);

    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / query.limit);

    return {
      items: tickets.map((ticket) =>
        TicketListItemDto.fromRecord(ticket, true),
      ),
      meta: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1 && totalPages > 0,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
    };
  }

  private requireAdmin(viewer: TicketVisibilityViewer): void {
    if (viewer.role !== RoleName.ADMIN) {
      throw new ForbiddenException('Only admins can manage the ticket trash.');
    }
  }

  private async recordTicketAudit(
    actorId: string,
    action: string,
    ticket: { id: string; number: number; subject: string },
  ): Promise<void> {
    try {
      await this.auditService.record({
        actorId,
        action,
        targetType: 'Ticket',
        targetId: ticket.id,
        metadata: { number: ticket.number, subject: ticket.subject },
      });
    } catch (error) {
      this.logger.warn({
        event: 'audit.record_failed',
        action,
        ticketId: ticket.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async emitTicketUpdatedAfterTrashChange(
    ticketId: string,
  ): Promise<void> {
    try {
      const dto = await this.loadTicketDetail(ticketId);
      this.emitTicketUpdatedFromDto(dto);
    } catch (error) {
      this.logger.warn({
        event: 'realtime.emit_failed_at_producer',
        error: error instanceof Error ? error.message : String(error),
        wsEvent: 'ticket.updated',
      });
    }
  }

  async listTicketTags(): Promise<TicketTagOptionDto[]> {
    const tags = await this.prisma.tag.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    return tags.map((tag) => TicketTagOptionDto.fromTag(tag));
  }

  async listTicketTeams(): Promise<TicketTeamOptionDto[]> {
    const teams = await this.prisma.team.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    return teams.map((team) => TicketTeamOptionDto.fromTeam(team));
  }

  async listAssignableUsers(
    ticketId: string,
    viewer: TicketVisibilityViewer,
  ): Promise<AssignableUserDto[]> {
    this.requireStaff(viewer);

    const visibleTicket = await this.findVisibleTicketForWorkflow(
      ticketId,
      viewer,
    );

    const where: Prisma.UserWhereInput = {
      role: {
        name: {
          in: [RoleName.AGENT, RoleName.MANAGER, RoleName.ADMIN],
        },
      },
    };

    if (viewer.role !== RoleName.ADMIN) {
      if (visibleTicket.teamId === null) {
        return [];
      }

      where.teamMemberships = {
        some: {
          teamId: visibleTicket.teamId,
        },
      };
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        role: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    return users.map((user) => AssignableUserDto.fromRecord(user));
  }

  private requireStaff(viewer: TicketVisibilityViewer): void {
    if (!STAFF_ROLES.has(viewer.role)) {
      throw new ForbiddenException(
        'Only staff users can perform this workflow action.',
      );
    }
  }

  private emitTicketUpdatedFromDto(dto: TicketDetailDto): void {
    try {
      this.realtimeService.emitTicketUpdated(dto.id, {
        assigneeId: dto.assignee?.id ?? null,
        categoryId: dto.category?.id ?? null,
        id: dto.id,
        number: dto.number,
        priority: dto.priority,
        status: dto.status,
        tagIds: dto.tags.map((tag) => tag.id),
        teamId: dto.team?.id ?? null,
        updatedAt: dto.updatedAt,
      });
    } catch (error) {
      this.logger.warn({
        event: 'realtime.emit_failed_at_producer',
        error: error instanceof Error ? error.message : String(error),
        wsEvent: 'ticket.updated',
      });
    }
  }

  private async findVisibleTicketForWorkflow(
    ticketId: string,
    viewer: TicketVisibilityViewer,
  ): Promise<VisibleTicketForWorkflow> {
    const visibleTicket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        ...this.buildVisibilityWhere(viewer),
      },
      select: {
        id: true,
        status: true,
        priority: true,
        assigneeId: true,
        teamId: true,
        categoryId: true,
      },
    });

    if (visibleTicket) {
      return visibleTicket;
    }

    const ticketExists = await this.prisma.ticket.findUnique({
      where: {
        id: ticketId,
      },
      select: {
        id: true,
      },
    });

    if (!ticketExists) {
      throw new NotFoundException('Ticket not found.');
    }

    throw new ForbiddenException('You do not have access to this ticket.');
  }

  private async loadTicketDetail(ticketId: string): Promise<TicketDetailDto> {
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
      },
      include: ticketDetailInclude,
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found.');
    }

    return TicketDetailDto.fromRecord(ticket);
  }

  private async produceReplyNotification(
    ticketId: string,
    actorId: string,
    messageId: string,
  ): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        number: true,
        requesterId: true,
        assigneeId: true,
      },
    });

    if (!ticket) return;

    const recipients = this.uniqueExcludingActor(
      [ticket.requesterId, ticket.assigneeId],
      actorId,
    );

    if (recipients.length === 0) return;

    await this.safeEnqueue(
      {
        message: `A new public reply was added to ticket #${ticket.number}.`,
        recipientUserIds: recipients,
        source: {
          actorId,
          eventType: 'REPLIED',
        },
        ticketId,
        type: NotificationType.TICKET_REPLIED,
      },
      messageId,
    );
  }

  private async produceInternalNoteNotification(
    ticketId: string,
    actorId: string,
    messageId: string,
  ): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        number: true,
        assigneeId: true,
        teamId: true,
      },
    });

    if (!ticket) return;

    const candidateIds: string[] = [];
    if (ticket.assigneeId !== null) {
      candidateIds.push(ticket.assigneeId);
    }
    if (ticket.teamId !== null) {
      const teamMembers = await this.prisma.teamMember.findMany({
        where: { teamId: ticket.teamId },
        select: { userId: true },
      });
      for (const member of teamMembers) {
        candidateIds.push(member.userId);
      }
    }

    const uniqueCandidates = this.uniqueExcludingActor(candidateIds, actorId);

    if (uniqueCandidates.length === 0) return;

    const staffUsers = await this.prisma.user.findMany({
      where: {
        id: { in: uniqueCandidates },
      },
      include: {
        role: true,
      },
    });

    const recipients = staffUsers
      .filter((user) => user.role.name !== RoleName.CUSTOMER)
      .map((user) => user.id);

    if (recipients.length === 0) return;

    await this.safeEnqueue(
      {
        message: `An internal note was added to ticket #${ticket.number}.`,
        recipientUserIds: recipients,
        source: {
          actorId,
          eventType: 'NOTE_ADDED',
        },
        ticketId,
        type: NotificationType.NOTE_ADDED,
      },
      messageId,
    );
  }

  private async produceAssignmentNotification(input: {
    actorId: string;
    eventId: string;
    eventType: TicketEventType;
    newAssigneeId: string;
    ticketId: string;
    ticketNumber: number;
  }): Promise<void> {
    await this.safeEnqueue(
      {
        message: `Ticket #${input.ticketNumber} was assigned to you.`,
        recipientUserIds: [input.newAssigneeId],
        source: {
          actorId: input.actorId,
          eventId: input.eventId,
          eventType: input.eventType,
        },
        ticketId: input.ticketId,
        type: NotificationType.TICKET_ASSIGNED,
      },
      input.eventId,
    );
  }

  private async produceStatusChangeNotification(input: {
    actorId: string;
    assigneeId: string | null;
    eventId: string;
    fromStatus: TicketStatus;
    requesterId: string;
    ticketId: string;
    ticketNumber: number;
    toStatus: TicketStatus;
  }): Promise<void> {
    const recipients = this.uniqueExcludingActor(
      [input.requesterId, input.assigneeId],
      input.actorId,
    );

    if (recipients.length === 0) return;

    await this.safeEnqueue(
      {
        message: `Ticket #${input.ticketNumber} status changed to ${input.toStatus}.`,
        recipientUserIds: recipients,
        source: {
          actorId: input.actorId,
          eventId: input.eventId,
          eventType: 'STATUS_CHANGED',
        },
        ticketId: input.ticketId,
        type: NotificationType.STATUS_CHANGED,
      },
      input.eventId,
    );
  }

  private uniqueExcludingActor(
    candidateIds: ReadonlyArray<string | null | undefined>,
    actorId: string,
  ): string[] {
    return [
      ...new Set(
        candidateIds.filter(
          (id): id is string =>
            typeof id === 'string' && id.length > 0 && id !== actorId,
        ),
      ),
    ];
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

  private async markFirstResponseSafely(ticketId: string): Promise<void> {
    try {
      await this.slaService.markFirstResponse(ticketId, new Date());
    } catch (error) {
      this.logger.warn({
        event: 'sla.first_response_failed',
        ticketId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async findVisibleTicketForMutation(
    ticketId: string,
    viewer: TicketVisibilityViewer,
  ): Promise<VisibleTicketForMutation> {
    const visibleTicket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        ...this.buildVisibilityWhere(viewer),
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (visibleTicket) {
      return visibleTicket;
    }

    const ticketExists = await this.prisma.ticket.findUnique({
      where: {
        id: ticketId,
      },
      select: {
        id: true,
      },
    });

    if (!ticketExists) {
      throw new NotFoundException('Ticket not found.');
    }

    throw new ForbiddenException('You do not have access to this ticket.');
  }

  private createMessageWithEvent(input: {
    actorId: string;
    attachmentIds: string[];
    body: string;
    isInternal: boolean;
    ticketId: string;
    type: TicketEventType;
  }): Promise<TicketMessageRecord> {
    const uniqueAttachmentIds = this.validateUniqueAttachmentIds(
      input.attachmentIds,
    );

    return this.prisma.$transaction(async (transaction) => {
      const attachments = await this.findLinkableAttachments(
        transaction,
        input.ticketId,
        input.actorId,
        uniqueAttachmentIds,
      );
      const message = await transaction.ticketMessage.create({
        data: {
          authorId: input.actorId,
          body: input.body,
          isInternal: input.isInternal,
          ticketId: input.ticketId,
        },
        include: ticketMessageInclude,
      });

      if (attachments.length > 0) {
        const updateResult = await transaction.attachment.updateMany({
          data: {
            messageId: message.id,
          },
          where: {
            id: {
              in: uniqueAttachmentIds,
            },
            messageId: null,
            ticketId: input.ticketId,
            uploadedById: input.actorId,
          },
        });

        if (updateResult.count !== attachments.length) {
          throw new BadRequestException(
            'Attachment IDs must refer to unattached files on this ticket.',
          );
        }
      }

      await transaction.ticketEvent.create({
        data: {
          actorId: input.actorId,
          ticketId: input.ticketId,
          type: input.type,
        },
      });

      return {
        ...message,
        attachments: attachments.map((attachment) => ({
          ...attachment,
          messageId: message.id,
        })),
      };
    });
  }

  private validateUniqueAttachmentIds(attachmentIds: string[]) {
    const uniqueAttachmentIds = [...new Set(attachmentIds)];

    if (uniqueAttachmentIds.length !== attachmentIds.length) {
      throw new BadRequestException(
        'Duplicate attachment IDs are not allowed.',
      );
    }

    return uniqueAttachmentIds;
  }

  private async findLinkableAttachments(
    transaction: Pick<Prisma.TransactionClient, 'attachment'>,
    ticketId: string,
    actorId: string,
    attachmentIds: string[],
  ) {
    if (attachmentIds.length === 0) {
      return [];
    }

    const attachments = await transaction.attachment.findMany({
      orderBy: {
        createdAt: 'asc',
      },
      where: {
        id: {
          in: attachmentIds,
        },
        messageId: null,
        ticketId,
        uploadedById: actorId,
      },
    });

    if (attachments.length !== attachmentIds.length) {
      throw new BadRequestException(
        'Attachment IDs must refer to unattached files on this ticket.',
      );
    }

    return attachments;
  }

  private validateAttachmentFile(
    file: TicketAttachmentUploadFile | undefined,
  ): {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  } {
    if (!file) {
      throw new BadRequestException('A file upload is required.');
    }

    if (!file.buffer || file.size <= 0) {
      throw new BadRequestException('Attachment file cannot be empty.');
    }

    if (file.size > TICKET_ATTACHMENT_MAX_BYTES) {
      throw new BadRequestException('Attachment file exceeds the 10 MB limit.');
    }

    if (!TICKET_ATTACHMENT_ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Attachment MIME type is not allowed.');
    }

    return {
      buffer: file.buffer,
      filename: this.normalizeAttachmentFilename(file.originalname),
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  }

  private normalizeAttachmentFilename(originalName: string) {
    const withoutPath = originalName.split(/[\\/]/).pop()?.trim() ?? '';
    const normalized = withoutPath
      .replace(/[^\w. -]+/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 180)
      .trim();

    return normalized || 'attachment';
  }

  private buildAttachmentStoredKey(ticketId: string, filename: string) {
    const safeFilename = filename
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 120);

    return `tickets/${ticketId}/attachments/${randomUUID()}-${
      safeFilename || 'attachment'
    }`;
  }

  private buildVisibilityWhere(
    viewer: TicketVisibilityViewer,
  ): Prisma.TicketWhereInput {
    // Trashed (soft-deleted) tickets are excluded from every normal
    // list/detail/mutation path for all roles, including admins. Admins reach
    // them only through the dedicated trash endpoints.
    switch (viewer.role) {
      case RoleName.CUSTOMER:
        return {
          deletedAt: null,
          requesterId: viewer.sub,
        };
      case RoleName.AGENT:
        return {
          deletedAt: null,
          OR: [
            {
              assigneeId: viewer.sub,
            },
            {
              team: {
                members: {
                  some: {
                    userId: viewer.sub,
                  },
                },
              },
            },
          ],
        };
      case RoleName.MANAGER:
        return {
          deletedAt: null,
          OR: [
            {
              assigneeId: viewer.sub,
            },
            {
              team: {
                members: {
                  some: {
                    userId: viewer.sub,
                  },
                },
              },
            },
            // Globally unassigned tickets (no team AND no assignee) surface to
            // managers for triage. Ordinary agents never see them, and assigning
            // either a team or a user removes a ticket from this triage view.
            {
              assigneeId: null,
              teamId: null,
            },
          ],
        };
      case RoleName.ADMIN:
      default:
        return {
          deletedAt: null,
        };
    }
  }

  private buildListWhere(
    viewer: TicketVisibilityViewer,
    query: TicketListQueryDto,
  ): Prisma.TicketWhereInput {
    const visibilityWhere = this.buildVisibilityWhere(viewer);
    const filterWhere: Prisma.TicketWhereInput = {};

    if (query.status) {
      filterWhere.status = query.status;
    }

    if (query.priority) {
      filterWhere.priority = query.priority;
    }

    if (query.assigneeId) {
      filterWhere.assigneeId = query.assigneeId;
    }

    if (query.teamId) {
      filterWhere.teamId = query.teamId;
    }

    if (query.categoryId) {
      filterWhere.categoryId = query.categoryId;
    }

    const clauses = [visibilityWhere, filterWhere].filter(
      (clause) => Object.keys(clause).length > 0,
    );

    if (clauses.length === 0) {
      return {};
    }

    if (clauses.length === 1) {
      return clauses[0]!;
    }

    return {
      AND: clauses,
    };
  }

  private buildListOrderBy(
    sortBy: TicketListSortBy,
    sortOrder: SortOrder,
  ): Prisma.TicketOrderByWithRelationInput[] {
    const direction: Prisma.SortOrder =
      sortOrder === SortOrder.ASC ? 'asc' : 'desc';

    switch (sortBy) {
      case TicketListSortBy.NUMBER:
        return [{ number: direction }];
      case TicketListSortBy.UPDATED_AT:
        return [{ updatedAt: direction }, { number: direction }];
      case TicketListSortBy.PRIORITY:
        return [{ priority: direction }, { number: direction }];
      case TicketListSortBy.CREATED_AT:
      default:
        return [{ createdAt: direction }, { number: direction }];
    }
  }
}
