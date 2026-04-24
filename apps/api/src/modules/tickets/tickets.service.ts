import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  Prisma,
  RoleName,
  TicketEventType,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';

import type { AccessTokenPayload } from '../auth/auth.types';
import { PrismaService } from '../../common/database/prisma.service';
import { TicketDetailDto } from './dto/ticket-detail.dto';
import { TicketCategoryOptionDto } from './dto/ticket-category-option.dto';
import type { CreateTicketDto } from './dto/create-ticket.dto';
import { SortOrder, TicketListSortBy } from './dto/ticket-list-query.dto';
import { TicketListItemDto } from './dto/ticket-list-item.dto';
import type { TicketListQueryDto } from './dto/ticket-list-query.dto';
import type { TicketListResponseDto } from './dto/ticket-list-response.dto';
import type { UpdateTicketDto } from './dto/update-ticket.dto';

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

export type TicketDetailRecord = Prisma.TicketGetPayload<{
  include: typeof ticketDetailInclude;
}>;

export type TicketListRecord = Prisma.TicketGetPayload<{
  include: typeof ticketListInclude;
}>;

type TicketVisibilityViewer = Pick<AccessTokenPayload, 'role' | 'sub'>;

const priorityRank: Record<TicketPriority, number> = {
  [TicketPriority.LOW]: 1,
  [TicketPriority.MEDIUM]: 2,
  [TicketPriority.HIGH]: 3,
  [TicketPriority.URGENT]: 4,
};

@Injectable()
export class TicketsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
    const visibleTickets = await this.prisma.ticket.findMany({
      where: this.buildListWhere(viewer, query),
      include: ticketListInclude,
    });

    const sortedTickets = [...visibleTickets].sort((left, right) =>
      this.compareTicketListRecords(left, right, query.sortBy, query.sortOrder),
    );

    const startIndex = (query.page - 1) * query.limit;
    const totalItems = sortedTickets.length;
    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / query.limit);
    const items = sortedTickets
      .slice(startIndex, startIndex + query.limit)
      .map((ticket) => TicketListItemDto.fromRecord(ticket));

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
      throw new ForbiddenException(
        'Only customers can create tickets in Milestone 2.',
      );
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

    if (input.categoryId) {
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

    const ticket = await this.prisma.ticket.create({
      data: {
        categoryId: input.categoryId ?? null,
        description: input.description,
        priority: input.priority,
        requesterId: requester.sub,
        status: TicketStatus.OPEN,
        subject: input.subject,
        events: {
          create: {
            actorId: requester.sub,
            type: TicketEventType.CREATED,
          },
        },
      },
      include: ticketDetailInclude,
    });

    return TicketDetailDto.fromRecord(ticket);
  }

  async updateTicket(
    ticketId: string,
    viewer: TicketVisibilityViewer,
    input: UpdateTicketDto,
  ): Promise<TicketDetailDto> {
    if (viewer.role !== RoleName.CUSTOMER) {
      throw new ForbiddenException(
        'Only customers can patch tickets in Milestone 2.',
      );
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
          'Customers may only close or reopen their own tickets in Milestone 2.',
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

    return TicketDetailDto.fromRecord(updatedTicket);
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
      return TicketDetailDto.fromRecord(visibleTicket);
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

  private buildVisibilityWhere(
    viewer: TicketVisibilityViewer,
  ): Prisma.TicketWhereInput {
    switch (viewer.role) {
      case RoleName.CUSTOMER:
        return {
          requesterId: viewer.sub,
        };
      case RoleName.AGENT:
      case RoleName.MANAGER:
        return {
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
      case RoleName.ADMIN:
      default:
        return {};
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

  private compareTicketListRecords(
    left: TicketListRecord,
    right: TicketListRecord,
    sortBy: TicketListSortBy,
    sortOrder: SortOrder,
  ): number {
    const direction = sortOrder === SortOrder.ASC ? 1 : -1;

    let comparison = 0;

    switch (sortBy) {
      case TicketListSortBy.NUMBER:
        comparison = left.number - right.number;
        break;
      case TicketListSortBy.UPDATED_AT:
        comparison = left.updatedAt.getTime() - right.updatedAt.getTime();
        break;
      case TicketListSortBy.PRIORITY:
        comparison = priorityRank[left.priority] - priorityRank[right.priority];
        break;
      case TicketListSortBy.CREATED_AT:
      default:
        comparison = left.createdAt.getTime() - right.createdAt.getTime();
        break;
    }

    if (comparison !== 0) {
      return comparison * direction;
    }

    return (left.number - right.number) * direction;
  }
}
