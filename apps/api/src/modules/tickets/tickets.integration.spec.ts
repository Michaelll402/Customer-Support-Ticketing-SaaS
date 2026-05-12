import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  NotificationType,
  RoleName,
  TicketEventType,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../../common/database/prisma.service';
import { apiConfiguration } from '../../common/config/api.configuration';
import { validateApiEnv } from '../../common/config/env.validation';
import { validationPipeOptions } from '../../common/validation/validation.pipe-options';
import { AuthModule } from '../auth/auth.module';
import { QueueService } from '../queue/queue.service';
import { RealtimeService } from '../realtime/realtime.service';
import { StorageService } from '../storage/storage.service';
import { TicketsModule } from './tickets.module';

import type { INestApplication } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

interface StoredRole {
  id: string;
  name: RoleName;
}

interface StoredUser {
  email: string;
  firstName: string;
  id: string;
  lastName: string;
  passwordHash: string;
  role: StoredRole;
  roleId: string;
}

interface StoredTeam {
  createdAt: Date;
  description: string | null;
  id: string;
  name: string;
}

interface StoredTeamMember {
  createdAt: Date;
  id: string;
  teamId: string;
  userId: string;
}

interface StoredCategory {
  color: string | null;
  createdAt: Date;
  description: string | null;
  id: string;
  name: string;
}

interface StoredTag {
  color: string | null;
  id: string;
  name: string;
}

interface StoredTicket {
  assigneeId: string | null;
  categoryId: string | null;
  createdAt: Date;
  description: string;
  firstResponseDueAt: Date | null;
  id: string;
  number: number;
  priority: TicketPriority;
  requesterId: string;
  resolutionDueAt: Date | null;
  status: TicketStatus;
  subject: string;
  teamId: string | null;
  updatedAt: Date;
}

interface StoredTicketTag {
  tagId: string;
  ticketId: string;
}

interface StoredTicketEvent {
  actorId: string | null;
  createdAt: Date;
  id: string;
  metadata: Prisma.JsonValue | null;
  ticketId: string;
  type: TicketEventType;
}

interface StoredTicketMessage {
  authorId: string;
  body: string;
  createdAt: Date;
  id: string;
  isInternal: boolean;
  ticketId: string;
  updatedAt: Date;
}

interface StoredAttachment {
  createdAt: Date;
  filename: string;
  id: string;
  messageId: string | null;
  mimeType: string;
  sizeBytes: number;
  storedKey: string;
  ticketId: string;
  uploadedById: string;
}

type TicketIncludeArgs = {
  include?: {
    assignee?: {
      select?: Record<string, boolean>;
    };
    category?: boolean;
    requester?: {
      select?: Record<string, boolean>;
    };
    tags?: {
      include?: {
        tag?: boolean;
      };
    };
    team?: boolean;
  };
};

type FindManyArgs = {
  orderBy?:
    | Prisma.TicketOrderByWithRelationInput
    | Prisma.TicketOrderByWithRelationInput[];
  skip?: number;
  take?: number;
  where?: Prisma.TicketWhereInput;
} & TicketIncludeArgs;

type UpdateArgs = {
  where: {
    id: string;
  };
  data: {
    description?: string;
    events?: {
      create: {
        id?: string;
        actorId: string | null;
        metadata?: Prisma.JsonValue;
        type: TicketEventType;
      };
    };
    status?: TicketStatus;
    subject?: string;
    priority?: TicketPriority;
    assigneeId?: string | null;
    teamId?: string | null;
    categoryId?: string | null;
  };
} & TicketIncludeArgs;

type TagFindManyArgs = {
  orderBy?: {
    name?: 'asc' | 'desc';
  };
  where?: {
    id?: {
      in?: string[];
    };
  };
};

type TicketTagFindManyArgs = {
  where?: {
    ticketId?: string;
  };
};

type TicketTagCreateManyArgs = {
  data: Array<{
    ticketId: string;
    tagId: string;
  }>;
};

type TicketTagDeleteManyArgs = {
  where?: {
    ticketId?: string;
    tagId?: {
      in?: string[];
    };
  };
};

type TeamMemberFindFirstArgs = {
  where?: {
    userId?: string;
    teamId?: string;
  };
};

type UserFindManyArgs = {
  where?: {
    id?: {
      in?: string[];
    };
    role?: {
      name?: {
        in?: RoleName[];
      };
    };
    teamMemberships?: {
      some?: {
        teamId?: string;
      };
    };
  };
  include?: {
    role?: boolean;
  };
  orderBy?: Array<{
    firstName?: 'asc' | 'desc';
    lastName?: 'asc' | 'desc';
  }>;
};

type TeamMemberFindManyArgs = {
  where?: {
    teamId?: string;
  };
  select?: {
    userId?: boolean;
  };
};

type TicketMessageCreateArgs = {
  data: {
    authorId: string;
    body: string;
    isInternal: boolean;
    ticketId: string;
  };
  include?: {
    author?: {
      select?: Record<string, boolean>;
    };
  };
};

type TicketMessageFindManyArgs = {
  where?: {
    isInternal?: boolean;
    ticketId?: string;
  };
  include?: {
    author?: {
      select?: Record<string, boolean>;
    };
  };
  orderBy?: {
    createdAt?: Prisma.SortOrder;
  };
};

type TicketEventFindManyArgs = {
  where?: {
    NOT?: {
      type?:
        | TicketEventType
        | {
            in?: TicketEventType[];
          };
    };
    ticketId?: string;
  };
  include?: {
    actor?: {
      select?: Record<string, boolean>;
    };
  };
  orderBy?: {
    createdAt?: Prisma.SortOrder;
  };
};

type AttachmentCreateArgs = {
  data: {
    filename: string;
    messageId: string | null;
    mimeType: string;
    sizeBytes: number;
    storedKey: string;
    ticketId: string;
    uploadedById: string;
  };
};

type AttachmentFindFirstArgs = {
  include?: {
    message?: {
      select?: Record<string, boolean>;
    };
  };
  where?: {
    id?: string;
    ticketId?: string;
  };
};

type AttachmentFindManyArgs = {
  orderBy?: {
    createdAt?: Prisma.SortOrder;
  };
  where?: {
    id?: {
      in?: string[];
    };
    messageId?: string | null;
    ticketId?: string;
    uploadedById?: string;
  };
};

type AttachmentUpdateManyArgs = {
  data: {
    messageId: string;
  };
  where?: {
    id?: {
      in?: string[];
    };
    messageId?: string | null;
    ticketId?: string;
    uploadedById?: string;
  };
};

const createPrismaMock = () => {
  const roles: StoredRole[] = Object.values(RoleName).map((name, index) => ({
    id: `role-${index + 1}`,
    name,
  }));
  const users: StoredUser[] = [];
  const teams: StoredTeam[] = [];
  const teamMembers: StoredTeamMember[] = [];
  const categories: StoredCategory[] = [];
  const tags: StoredTag[] = [];
  const tickets: StoredTicket[] = [];
  const ticketTags: StoredTicketTag[] = [];
  const ticketEvents: StoredTicketEvent[] = [];
  const ticketMessages: StoredTicketMessage[] = [];
  const attachments: StoredAttachment[] = [];
  let nextTicketNumber = 1000;
  const priorityRank: Record<TicketPriority, number> = {
    [TicketPriority.LOW]: 1,
    [TicketPriority.MEDIUM]: 2,
    [TicketPriority.HIGH]: 3,
    [TicketPriority.URGENT]: 4,
  };

  const attachTicketRelations = (ticket: StoredTicket) => {
    const requester =
      users.find((user) => user.id === ticket.requesterId) ?? null;
    const assignee = ticket.assigneeId
      ? (users.find((user) => user.id === ticket.assigneeId) ?? null)
      : null;
    const team = ticket.teamId
      ? (teams.find((entry) => entry.id === ticket.teamId) ?? null)
      : null;
    const category = ticket.categoryId
      ? (categories.find((entry) => entry.id === ticket.categoryId) ?? null)
      : null;
    const links = ticketTags
      .filter((entry) => entry.ticketId === ticket.id)
      .map((entry) => ({
        tag: tags.find((tag) => tag.id === entry.tagId)!,
        tagId: entry.tagId,
        ticketId: entry.ticketId,
      }));

    if (!requester) {
      throw new Error('Requester missing from test store.');
    }

    return {
      ...ticket,
      assignee,
      category,
      requester,
      tags: links,
      team,
    };
  };

  const ticketMatchesWhere = (
    ticket: StoredTicket,
    where: Prisma.TicketWhereInput | undefined,
  ): boolean => {
    if (!where) {
      return true;
    }

    const andBranches = Array.isArray(where.AND)
      ? where.AND
      : where.AND
        ? [where.AND]
        : [];

    if (
      andBranches.length > 0 &&
      !andBranches.every((branch: Prisma.TicketWhereInput) =>
        ticketMatchesWhere(ticket, branch),
      )
    ) {
      return false;
    }

    const orBranches = Array.isArray(where.OR)
      ? where.OR
      : where.OR
        ? [where.OR]
        : [];

    if (
      orBranches.length > 0 &&
      !orBranches.some((branch: Prisma.TicketWhereInput) =>
        ticketMatchesWhere(ticket, branch),
      )
    ) {
      return false;
    }

    if (where.id && ticket.id !== where.id) {
      return false;
    }

    if (where.requesterId && ticket.requesterId !== where.requesterId) {
      return false;
    }

    if (
      where.assigneeId !== undefined &&
      ticket.assigneeId !== where.assigneeId
    ) {
      return false;
    }

    if (where.teamId && ticket.teamId !== where.teamId) {
      return false;
    }

    if (where.categoryId && ticket.categoryId !== where.categoryId) {
      return false;
    }

    if (where.status && ticket.status !== where.status) {
      return false;
    }

    if (where.priority && ticket.priority !== where.priority) {
      return false;
    }

    if (where.team && 'members' in where.team && where.team.members?.some) {
      const viewerId = where.team.members.some.userId;

      if (!viewerId || !ticket.teamId) {
        return false;
      }

      return teamMembers.some(
        (entry) => entry.teamId === ticket.teamId && entry.userId === viewerId,
      );
    }

    return true;
  };

  const compareTickets = (
    left: StoredTicket,
    right: StoredTicket,
    orderBy:
      | Prisma.TicketOrderByWithRelationInput
      | Prisma.TicketOrderByWithRelationInput[]
      | undefined,
  ) => {
    const clauses = orderBy
      ? Array.isArray(orderBy)
        ? orderBy
        : [orderBy]
      : [];

    for (const clause of clauses) {
      if (clause.number) {
        const comparison = left.number - right.number;

        if (comparison !== 0) {
          return clause.number === 'asc' ? comparison : -comparison;
        }
      }

      if (clause.createdAt) {
        const comparison = left.createdAt.getTime() - right.createdAt.getTime();

        if (comparison !== 0) {
          return clause.createdAt === 'asc' ? comparison : -comparison;
        }
      }

      if (clause.updatedAt) {
        const comparison = left.updatedAt.getTime() - right.updatedAt.getTime();

        if (comparison !== 0) {
          return clause.updatedAt === 'asc' ? comparison : -comparison;
        }
      }

      if (clause.priority) {
        const comparison =
          priorityRank[left.priority] - priorityRank[right.priority];

        if (comparison !== 0) {
          return clause.priority === 'asc' ? comparison : -comparison;
        }
      }
    }

    return 0;
  };

  const userModel = {
    create: vi.fn(
      async ({
        data,
      }: {
        data: {
          email: string;
          firstName: string;
          lastName: string;
          passwordHash: string;
          role: {
            connect: {
              name: RoleName;
            };
          };
        };
      }) => {
        const role = roles.find(
          (entry) => entry.name === data.role.connect.name,
        );

        if (!role) {
          throw new Error('Role not found in test store.');
        }

        const user: StoredUser = {
          email: data.email,
          firstName: data.firstName,
          id: randomUUID(),
          lastName: data.lastName,
          passwordHash: data.passwordHash,
          role,
          roleId: role.id,
        };

        users.push(user);

        return user;
      },
    ),
    findUnique: vi.fn(
      async ({
        where,
      }: {
        where: {
          email?: string;
          id?: string;
        };
      }) => {
        if (where.email) {
          return users.find((user) => user.email === where.email) ?? null;
        }

        if (where.id) {
          return users.find((user) => user.id === where.id) ?? null;
        }

        return null;
      },
    ),
    findMany: vi.fn(async ({ where, orderBy }: UserFindManyArgs = {}) => {
      const results = users.filter((user) => {
        if (where?.id?.in && !where.id.in.includes(user.id)) {
          return false;
        }

        if (
          where?.role?.name?.in &&
          !where.role.name.in.includes(user.role.name)
        ) {
          return false;
        }

        if (where?.teamMemberships?.some?.teamId) {
          const targetTeamId = where.teamMemberships.some.teamId;
          const matches = teamMembers.some(
            (member) =>
              member.userId === user.id && member.teamId === targetTeamId,
          );
          if (!matches) return false;
        }

        return true;
      });

      if (orderBy && orderBy.length > 0) {
        results.sort((left, right) => {
          for (const clause of orderBy) {
            if (clause.firstName) {
              const comparison = left.firstName.localeCompare(right.firstName);
              if (comparison !== 0) {
                return clause.firstName === 'asc' ? comparison : -comparison;
              }
            }
            if (clause.lastName) {
              const comparison = left.lastName.localeCompare(right.lastName);
              if (comparison !== 0) {
                return clause.lastName === 'asc' ? comparison : -comparison;
              }
            }
          }
          return 0;
        });
      }

      return results;
    }),
  };

  const tagModel = {
    findMany: vi.fn(async ({ orderBy, where }: TagFindManyArgs = {}) => {
      const results = tags.filter((tag) => {
        if (where?.id?.in && !where.id.in.includes(tag.id)) {
          return false;
        }
        return true;
      });

      if (orderBy?.name) {
        results.sort((left, right) =>
          orderBy.name === 'asc'
            ? left.name.localeCompare(right.name)
            : right.name.localeCompare(left.name),
        );
      }

      return results;
    }),
  };

  const ticketTagModel = {
    findMany: vi.fn(async ({ where }: TicketTagFindManyArgs = {}) =>
      ticketTags.filter((link) => {
        if (where?.ticketId && link.ticketId !== where.ticketId) {
          return false;
        }
        return true;
      }),
    ),
    createMany: vi.fn(async ({ data }: TicketTagCreateManyArgs) => {
      for (const entry of data) {
        ticketTags.push({
          tagId: entry.tagId,
          ticketId: entry.ticketId,
        });
      }
      return { count: data.length };
    }),
    deleteMany: vi.fn(async ({ where }: TicketTagDeleteManyArgs = {}) => {
      let count = 0;
      for (let index = ticketTags.length - 1; index >= 0; index -= 1) {
        const link = ticketTags[index]!;
        if (where?.ticketId && link.ticketId !== where.ticketId) {
          continue;
        }
        if (where?.tagId?.in && !where.tagId.in.includes(link.tagId)) {
          continue;
        }
        ticketTags.splice(index, 1);
        count += 1;
      }
      return { count };
    }),
  };

  const teamMemberModel = {
    findFirst: vi.fn(async ({ where }: TeamMemberFindFirstArgs = {}) => {
      return (
        teamMembers.find((member) => {
          if (where?.userId && member.userId !== where.userId) return false;
          if (where?.teamId && member.teamId !== where.teamId) return false;
          return true;
        }) ?? null
      );
    }),
    findMany: vi.fn(async ({ where }: TeamMemberFindManyArgs = {}) =>
      teamMembers.filter((member) => {
        if (where?.teamId && member.teamId !== where.teamId) return false;
        return true;
      }),
    ),
  };

  const categoryModel = {
    findMany: vi.fn(
      async ({
        orderBy,
      }: {
        orderBy?: {
          name?: 'asc' | 'desc';
        };
      } = {}) => {
        const results = [...categories];

        if (orderBy?.name) {
          results.sort((left, right) =>
            orderBy.name === 'asc'
              ? left.name.localeCompare(right.name)
              : right.name.localeCompare(left.name),
          );
        }

        return results;
      },
    ),
    findUnique: vi.fn(
      async ({
        where,
      }: {
        where: {
          id: string;
        };
      }) => categories.find((category) => category.id === where.id) ?? null,
    ),
  };

  const teamModel = {
    findUnique: vi.fn(
      async ({
        where,
      }: {
        where: {
          id?: string;
          name?: string;
        };
      }) => {
        if (where.name !== undefined) {
          return teams.find((team) => team.name === where.name) ?? null;
        }
        if (where.id !== undefined) {
          return teams.find((team) => team.id === where.id) ?? null;
        }
        return null;
      },
    ),
    findMany: vi.fn(
      async ({
        orderBy,
      }: {
        orderBy?: { name?: 'asc' | 'desc' };
      } = {}) => {
        const results = [...teams];

        if (orderBy?.name) {
          results.sort((left, right) =>
            orderBy.name === 'asc'
              ? left.name.localeCompare(right.name)
              : right.name.localeCompare(left.name),
          );
        }

        return results;
      },
    ),
  };

  const ticketModel = {
    count: vi.fn(
      async ({
        where,
      }: {
        where?: Prisma.TicketWhereInput;
      } = {}) =>
        tickets.filter((ticket) => ticketMatchesWhere(ticket, where)).length,
    ),
    create: vi.fn(
      async ({
        data,
      }: {
        data: {
          categoryId: string | null;
          description: string;
          events: {
            create: {
              actorId: string | null;
              type: TicketEventType;
            };
          };
          priority: TicketPriority;
          requesterId: string;
          status: TicketStatus;
          subject: string;
          teamId?: string | null;
        };
      } & TicketIncludeArgs) => {
        const now = new Date();
        const ticket: StoredTicket = {
          assigneeId: null,
          categoryId: data.categoryId,
          createdAt: now,
          description: data.description,
          firstResponseDueAt: null,
          id: randomUUID(),
          number: nextTicketNumber++,
          priority: data.priority,
          requesterId: data.requesterId,
          resolutionDueAt: null,
          status: data.status,
          subject: data.subject,
          teamId: data.teamId ?? null,
          updatedAt: now,
        };

        tickets.push(ticket);
        ticketEvents.push({
          actorId: data.events.create.actorId,
          createdAt: now,
          id: randomUUID(),
          metadata: null,
          ticketId: ticket.id,
          type: data.events.create.type,
        });

        return attachTicketRelations(ticket);
      },
    ),
    findFirst: vi.fn(
      async ({
        where,
      }: {
        where?: Prisma.TicketWhereInput;
      } & TicketIncludeArgs) => {
        const ticket = tickets.find((entry) =>
          ticketMatchesWhere(entry, where),
        );

        return ticket ? attachTicketRelations(ticket) : null;
      },
    ),
    findMany: vi.fn(
      async ({ orderBy, skip, take, where }: FindManyArgs = {}) => {
        const filteredTickets = tickets.filter((ticket) =>
          ticketMatchesWhere(ticket, where),
        );
        const sortedTickets = [...filteredTickets].sort((left, right) =>
          compareTickets(left, right, orderBy),
        );
        const pagedTickets = sortedTickets.slice(
          skip ?? 0,
          take === undefined ? undefined : (skip ?? 0) + take,
        );

        return pagedTickets.map((ticket) => attachTicketRelations(ticket));
      },
    ),
    update: vi.fn(async ({ where, data }: UpdateArgs) => {
      const ticket = tickets.find((entry) => entry.id === where.id);

      if (!ticket) {
        throw new Error('Ticket not found in test store.');
      }

      const now = new Date();

      if (data.subject !== undefined) {
        ticket.subject = data.subject;
      }

      if (data.description !== undefined) {
        ticket.description = data.description;
      }

      if (data.status !== undefined) {
        ticket.status = data.status;
      }

      if (data.priority !== undefined) {
        ticket.priority = data.priority;
      }

      if (data.assigneeId !== undefined) {
        ticket.assigneeId = data.assigneeId;
      }

      if (data.teamId !== undefined) {
        ticket.teamId = data.teamId;
      }

      if (data.categoryId !== undefined) {
        ticket.categoryId = data.categoryId;
      }

      ticket.updatedAt = now;

      if (data.events?.create) {
        ticketEvents.push({
          actorId: data.events.create.actorId,
          createdAt: now,
          id: data.events.create.id ?? randomUUID(),
          metadata: data.events.create.metadata ?? null,
          ticketId: ticket.id,
          type: data.events.create.type,
        });
      }

      return attachTicketRelations(ticket);
    }),
    findUnique: vi.fn(
      async ({
        where,
      }: {
        where: {
          id: string;
        };
      }) => tickets.find((ticket) => ticket.id === where.id) ?? null,
    ),
  };

  const ticketMessageModel = {
    create: vi.fn(async ({ data }: TicketMessageCreateArgs) => {
      const ticket = tickets.find((entry) => entry.id === data.ticketId);
      const author = users.find((user) => user.id === data.authorId);

      if (!ticket) {
        throw new Error('Ticket not found in test store.');
      }

      if (!author) {
        throw new Error('Author not found in test store.');
      }

      const now = new Date();
      const message: StoredTicketMessage = {
        authorId: data.authorId,
        body: data.body,
        createdAt: now,
        id: randomUUID(),
        isInternal: data.isInternal,
        ticketId: data.ticketId,
        updatedAt: now,
      };

      ticketMessages.push(message);

      return {
        ...message,
        attachments: [],
        author,
      };
    }),
    findMany: vi.fn(
      async ({ orderBy, where }: TicketMessageFindManyArgs = {}) => {
        const results = ticketMessages
          .filter((message) => {
            if (where?.ticketId && message.ticketId !== where.ticketId) {
              return false;
            }

            if (
              where?.isInternal !== undefined &&
              message.isInternal !== where.isInternal
            ) {
              return false;
            }

            return true;
          })
          .map((message) => {
            const author = users.find((user) => user.id === message.authorId);

            if (!author) {
              throw new Error('Message author not found in test store.');
            }

            return {
              ...message,
              attachments: attachments.filter(
                (attachment) => attachment.messageId === message.id,
              ),
              author,
            };
          });

        if (orderBy?.createdAt) {
          results.sort((left, right) =>
            orderBy.createdAt === 'asc'
              ? left.createdAt.getTime() - right.createdAt.getTime()
              : right.createdAt.getTime() - left.createdAt.getTime(),
          );
        }

        return results;
      },
    ),
  };

  const ticketEventModel = {
    create: vi.fn(
      async ({
        data,
      }: {
        data: {
          actorId: string | null;
          metadata?: Prisma.JsonValue;
          ticketId: string;
          type: TicketEventType;
        };
      }) => {
        const event: StoredTicketEvent = {
          actorId: data.actorId,
          createdAt: new Date(),
          id: randomUUID(),
          metadata: data.metadata ?? null,
          ticketId: data.ticketId,
          type: data.type,
        };

        ticketEvents.push(event);

        return event;
      },
    ),
    findMany: vi.fn(
      async ({ orderBy, where }: TicketEventFindManyArgs = {}) => {
        const results = ticketEvents
          .filter((event) => {
            if (where?.ticketId && event.ticketId !== where.ticketId) {
              return false;
            }

            if (where?.NOT?.type) {
              if (
                typeof where.NOT.type === 'object' &&
                where.NOT.type.in?.includes(event.type)
              ) {
                return false;
              }

              if (
                typeof where.NOT.type === 'string' &&
                event.type === where.NOT.type
              ) {
                return false;
              }
            }

            return true;
          })
          .map((event) => {
            const actor = event.actorId
              ? (users.find((user) => user.id === event.actorId) ?? null)
              : null;

            return {
              ...event,
              actor,
            };
          });

        if (orderBy?.createdAt) {
          results.sort((left, right) =>
            orderBy.createdAt === 'asc'
              ? left.createdAt.getTime() - right.createdAt.getTime()
              : right.createdAt.getTime() - left.createdAt.getTime(),
          );
        }

        return results;
      },
    ),
  };

  const attachmentModel = {
    create: vi.fn(async ({ data }: AttachmentCreateArgs) => {
      const ticket = tickets.find((entry) => entry.id === data.ticketId);
      const uploader = users.find((user) => user.id === data.uploadedById);

      if (!ticket) {
        throw new Error('Ticket not found in test store.');
      }

      if (!uploader) {
        throw new Error('Uploader not found in test store.');
      }

      const attachment: StoredAttachment = {
        createdAt: new Date(),
        filename: data.filename,
        id: randomUUID(),
        messageId: data.messageId,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        storedKey: data.storedKey,
        ticketId: data.ticketId,
        uploadedById: data.uploadedById,
      };

      attachments.push(attachment);

      return attachment;
    }),
    findFirst: vi.fn(
      async ({ include, where }: AttachmentFindFirstArgs = {}) => {
        const attachment =
          attachments.find((entry) => {
            if (where?.id && entry.id !== where.id) {
              return false;
            }

            if (where?.ticketId && entry.ticketId !== where.ticketId) {
              return false;
            }

            return true;
          }) ?? null;

        if (!attachment) {
          return null;
        }

        if (!include?.message) {
          return attachment;
        }

        return {
          ...attachment,
          message: attachment.messageId
            ? (ticketMessages.find(
                (message) => message.id === attachment.messageId,
              ) ?? null)
            : null,
        };
      },
    ),
    findMany: vi.fn(async ({ orderBy, where }: AttachmentFindManyArgs = {}) => {
      const results = attachments.filter((attachment) => {
        if (where?.id?.in && !where.id.in.includes(attachment.id)) {
          return false;
        }

        if (
          where?.messageId !== undefined &&
          attachment.messageId !== where.messageId
        ) {
          return false;
        }

        if (where?.ticketId && attachment.ticketId !== where.ticketId) {
          return false;
        }

        if (
          where?.uploadedById &&
          attachment.uploadedById !== where.uploadedById
        ) {
          return false;
        }

        return true;
      });

      if (orderBy?.createdAt) {
        results.sort((left, right) =>
          orderBy.createdAt === 'asc'
            ? left.createdAt.getTime() - right.createdAt.getTime()
            : right.createdAt.getTime() - left.createdAt.getTime(),
        );
      }

      return results;
    }),
    updateMany: vi.fn(async ({ data, where }: AttachmentUpdateManyArgs) => {
      let count = 0;

      for (const attachment of attachments) {
        if (where?.id?.in && !where.id.in.includes(attachment.id)) {
          continue;
        }

        if (
          where?.messageId !== undefined &&
          attachment.messageId !== where.messageId
        ) {
          continue;
        }

        if (where?.ticketId && attachment.ticketId !== where.ticketId) {
          continue;
        }

        if (
          where?.uploadedById &&
          attachment.uploadedById !== where.uploadedById
        ) {
          continue;
        }

        attachment.messageId = data.messageId;
        count += 1;
      }

      return {
        count,
      };
    }),
  };

  return {
    $transaction: vi.fn(
      async <T>(
        callback: (client: {
          attachment: typeof attachmentModel;
          category: typeof categoryModel;
          tag: typeof tagModel;
          team: typeof teamModel;
          teamMember: typeof teamMemberModel;
          ticket: typeof ticketModel;
          ticketEvent: typeof ticketEventModel;
          ticketMessage: typeof ticketMessageModel;
          ticketTag: typeof ticketTagModel;
          user: typeof userModel;
        }) => Promise<T>,
      ) =>
        callback({
          attachment: attachmentModel,
          category: categoryModel,
          tag: tagModel,
          team: teamModel,
          teamMember: teamMemberModel,
          ticket: ticketModel,
          ticketEvent: ticketEventModel,
          ticketMessage: ticketMessageModel,
          ticketTag: ticketTagModel,
          user: userModel,
        }),
    ),
    attachmentStore: attachments,
    attachment: attachmentModel,
    categoryStore: categories,
    roleStore: roles,
    tagStore: tags,
    teamMemberStore: teamMembers,
    teamStore: teams,
    ticketEventStore: ticketEvents,
    ticketMessageStore: ticketMessages,
    ticketStore: tickets,
    ticketTagStore: ticketTags,
    userStore: users,
    category: categoryModel,
    tag: tagModel,
    team: teamModel,
    teamMember: teamMemberModel,
    ticket: ticketModel,
    ticketEvent: ticketEventModel,
    ticketMessage: ticketMessageModel,
    ticketTag: ticketTagModel,
    user: userModel,
  };
};

describe('Tickets integration', () => {
  let app: INestApplication;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let originalEnv: NodeJS.ProcessEnv;
  let storageMock: {
    delete: ReturnType<typeof vi.fn>;
    getSignedUrl: ReturnType<typeof vi.fn>;
    upload: ReturnType<typeof vi.fn>;
  };
  let queueMock: {
    enqueueNotification: ReturnType<typeof vi.fn>;
  };
  let realtimeMock: {
    emitNotificationCreated: ReturnType<typeof vi.fn>;
    emitTicketUpdated: ReturnType<typeof vi.fn>;
    emitTicketMessageCreatedPublic: ReturnType<typeof vi.fn>;
    emitTicketMessageCreatedInternal: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    originalEnv = { ...process.env };
    process.env.API_HOST = '127.0.0.1';
    process.env.API_PORT = '4100';
    process.env.AUTH_COOKIE_NAME = 'access_token';
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@localhost:5432/customer_support?schema=public';
    process.env.JWT_ACCESS_TOKEN_TTL_SECONDS = '3600';
    process.env.JWT_SECRET = 'test-ticket-secret';
    process.env.MINIO_ACCESS_KEY = 'minioadmin';
    process.env.MINIO_BUCKET = 'customer-support';
    process.env.MINIO_ENDPOINT = 'localhost';
    process.env.MINIO_PORT = '9000';
    process.env.MINIO_SECRET_KEY = 'minioadmin';
    process.env.MINIO_USE_SSL = 'false';
    process.env.NODE_ENV = 'test';
    process.env.SWAGGER_PATH = 'api';
    process.env.WEB_APP_ORIGIN = 'http://localhost:3000';

    prismaMock = createPrismaMock();
    storageMock = {
      delete: vi.fn().mockResolvedValue(undefined),
      getSignedUrl: vi.fn().mockResolvedValue({
        expiresInSeconds: 300,
        url: 'http://localhost:9000/customer-support/signed-download-url',
      }),
      upload: vi.fn().mockResolvedValue({
        key: 'tickets/test/attachments/file.txt',
      }),
    };
    queueMock = {
      enqueueNotification: vi.fn().mockResolvedValue(undefined),
    };
    realtimeMock = {
      emitNotificationCreated: vi.fn(),
      emitTicketUpdated: vi.fn(),
      emitTicketMessageCreatedPublic: vi.fn(),
      emitTicketMessageCreatedInternal: vi.fn(),
    };

    const technicalTeam: StoredTeam = {
      createdAt: new Date('2026-04-20T10:00:00.000Z'),
      description: 'Primary queue for technical incidents.',
      id: randomUUID(),
      name: 'Technical Support',
    };
    prismaMock.teamStore.push(technicalTeam);

    const technicalCategory: StoredCategory = {
      color: '#2563eb',
      createdAt: new Date('2026-04-20T10:00:00.000Z'),
      description:
        'Errors, broken flows, and technical troubleshooting requests.',
      id: randomUUID(),
      name: 'Technical Issue',
    };
    prismaMock.categoryStore.push(technicalCategory);

    const billingCategory: StoredCategory = {
      color: '#16a34a',
      createdAt: new Date('2026-04-20T10:05:00.000Z'),
      description: 'Invoices, charges, and payment-related requests.',
      id: randomUUID(),
      name: 'Billing',
    };
    prismaMock.categoryStore.push(billingCategory);

    const billingTeam: StoredTeam = {
      createdAt: new Date('2026-04-20T10:10:00.000Z'),
      description: 'Queue for billing and payment issues.',
      id: randomUUID(),
      name: 'Billing',
    };
    prismaMock.teamStore.push(billingTeam);

    const accountAccessCategory: StoredCategory = {
      color: '#7c3aed',
      createdAt: new Date('2026-04-20T10:15:00.000Z'),
      description: 'Login, MFA, password reset, and account access problems.',
      id: randomUUID(),
      name: 'Account Access',
    };
    prismaMock.categoryStore.push(accountAccessCategory);

    const urgentTag: StoredTag = {
      color: '#dc2626',
      id: randomUUID(),
      name: 'urgent',
    };
    prismaMock.tagStore.push(urgentTag);

    const regressionTag: StoredTag = {
      color: '#f59e0b',
      id: randomUUID(),
      name: 'regression',
    };
    prismaMock.tagStore.push(regressionTag);

    for (const role of prismaMock.roleStore) {
      if (role.name === RoleName.CUSTOMER) {
        prismaMock.userStore.push({
          email: 'customer@demo.test',
          firstName: 'Casey',
          id: randomUUID(),
          lastName: 'Customer',
          passwordHash: await hash('Password1!', 12),
          role,
          roleId: role.id,
        });
        prismaMock.userStore.push({
          email: 'customer.two@demo.test',
          firstName: 'Jordan',
          id: randomUUID(),
          lastName: 'Customer',
          passwordHash: await hash('Password1!', 12),
          role,
          roleId: role.id,
        });
      }

      if (role.name === RoleName.AGENT) {
        const agent = {
          email: 'agent@demo.test',
          firstName: 'Avery',
          id: randomUUID(),
          lastName: 'Agent',
          passwordHash: await hash('Password1!', 12),
          role,
          roleId: role.id,
        };

        prismaMock.userStore.push(agent);
        prismaMock.teamMemberStore.push({
          createdAt: new Date('2026-04-20T10:00:00.000Z'),
          id: randomUUID(),
          teamId: technicalTeam.id,
          userId: agent.id,
        });
      }

      if (role.name === RoleName.MANAGER) {
        const manager = {
          email: 'manager@demo.test',
          firstName: 'Morgan',
          id: randomUUID(),
          lastName: 'Manager',
          passwordHash: await hash('Password1!', 12),
          role,
          roleId: role.id,
        };

        prismaMock.userStore.push(manager);
        prismaMock.teamMemberStore.push({
          createdAt: new Date('2026-04-20T10:00:00.000Z'),
          id: randomUUID(),
          teamId: technicalTeam.id,
          userId: manager.id,
        });
      }

      if (role.name === RoleName.ADMIN) {
        prismaMock.userStore.push({
          email: 'admin@demo.test',
          firstName: 'Addison',
          id: randomUUID(),
          lastName: 'Admin',
          passwordHash: await hash('Password1!', 12),
          role,
          roleId: role.id,
        });
      }
    }

    const agentRole = prismaMock.roleStore.find(
      (role) => role.name === RoleName.AGENT,
    )!;
    const managerRole = prismaMock.roleStore.find(
      (role) => role.name === RoleName.MANAGER,
    )!;

    const billingAgent: StoredUser = {
      email: 'agent.billing@demo.test',
      firstName: 'Bailey',
      id: randomUUID(),
      lastName: 'Agent',
      passwordHash: await hash('Password1!', 12),
      role: agentRole,
      roleId: agentRole.id,
    };
    prismaMock.userStore.push(billingAgent);
    prismaMock.teamMemberStore.push({
      createdAt: new Date('2026-04-20T10:00:00.000Z'),
      id: randomUUID(),
      teamId: billingTeam.id,
      userId: billingAgent.id,
    });

    const billingManager: StoredUser = {
      email: 'manager.billing@demo.test',
      firstName: 'Quinn',
      id: randomUUID(),
      lastName: 'Manager',
      passwordHash: await hash('Password1!', 12),
      role: managerRole,
      roleId: managerRole.id,
    };
    prismaMock.userStore.push(billingManager);
    prismaMock.teamMemberStore.push({
      createdAt: new Date('2026-04-20T10:00:00.000Z'),
      id: randomUUID(),
      teamId: billingTeam.id,
      userId: billingManager.id,
    });

    const firstCustomer = prismaMock.userStore.find(
      (user) => user.email === 'customer@demo.test',
    )!;
    const secondCustomer = prismaMock.userStore.find(
      (user) => user.email === 'customer.two@demo.test',
    )!;
    const agent = prismaMock.userStore.find(
      (user) => user.email === 'agent@demo.test',
    )!;
    const manager = prismaMock.userStore.find(
      (user) => user.email === 'manager@demo.test',
    )!;

    const ownTicket: StoredTicket = {
      assigneeId: null,
      categoryId: technicalCategory.id,
      createdAt: new Date('2026-04-20T11:00:00.000Z'),
      description: 'Customer-owned ticket for detail access.',
      firstResponseDueAt: null,
      id: randomUUID(),
      number: 1000,
      priority: TicketPriority.MEDIUM,
      requesterId: firstCustomer.id,
      resolutionDueAt: null,
      status: TicketStatus.OPEN,
      subject: 'Own ticket detail',
      teamId: null,
      updatedAt: new Date('2026-04-20T11:00:00.000Z'),
    };
    prismaMock.ticketStore.push(ownTicket);
    prismaMock.ticketTagStore.push({
      tagId: urgentTag.id,
      ticketId: ownTicket.id,
    });

    const otherCustomerTicket: StoredTicket = {
      assigneeId: null,
      categoryId: technicalCategory.id,
      createdAt: new Date('2026-04-20T12:00:00.000Z'),
      description: 'Invisible customer ticket.',
      firstResponseDueAt: null,
      id: randomUUID(),
      number: 1001,
      priority: TicketPriority.HIGH,
      requesterId: secondCustomer.id,
      resolutionDueAt: null,
      status: TicketStatus.OPEN,
      subject: 'Other customer ticket',
      teamId: null,
      updatedAt: new Date('2026-04-20T12:00:00.000Z'),
    };
    prismaMock.ticketStore.push(otherCustomerTicket);

    const teamOwnedTicket: StoredTicket = {
      assigneeId: null,
      categoryId: technicalCategory.id,
      createdAt: new Date('2026-04-20T13:00:00.000Z'),
      description: 'Team-owned queue ticket.',
      firstResponseDueAt: null,
      id: randomUUID(),
      number: 1002,
      priority: TicketPriority.HIGH,
      requesterId: secondCustomer.id,
      resolutionDueAt: null,
      status: TicketStatus.PENDING,
      subject: 'Team queue ticket',
      teamId: technicalTeam.id,
      updatedAt: new Date('2026-04-20T13:00:00.000Z'),
    };
    prismaMock.ticketStore.push(teamOwnedTicket);

    const assignedTicket: StoredTicket = {
      assigneeId: agent.id,
      categoryId: technicalCategory.id,
      createdAt: new Date('2026-04-20T14:00:00.000Z'),
      description: 'Assigned ticket for staff access.',
      firstResponseDueAt: null,
      id: randomUUID(),
      number: 1003,
      priority: TicketPriority.LOW,
      requesterId: secondCustomer.id,
      resolutionDueAt: null,
      status: TicketStatus.RESOLVED,
      subject: 'Assigned ticket',
      teamId: technicalTeam.id,
      updatedAt: new Date('2026-04-20T14:00:00.000Z'),
    };
    prismaMock.ticketStore.push(assignedTicket);

    const urgentTeamTicket: StoredTicket = {
      assigneeId: null,
      categoryId: technicalCategory.id,
      createdAt: new Date('2026-04-20T15:00:00.000Z'),
      description: 'Urgent technical queue ticket.',
      firstResponseDueAt: null,
      id: randomUUID(),
      number: 1004,
      priority: TicketPriority.URGENT,
      requesterId: firstCustomer.id,
      resolutionDueAt: null,
      status: TicketStatus.OPEN,
      subject: 'Urgent team ticket',
      teamId: technicalTeam.id,
      updatedAt: new Date('2026-04-20T15:00:00.000Z'),
    };
    prismaMock.ticketStore.push(urgentTeamTicket);

    const managerDirectTicket: StoredTicket = {
      assigneeId: manager.id,
      categoryId: billingCategory.id,
      createdAt: new Date('2026-04-20T16:00:00.000Z'),
      description: 'Directly assigned to the manager without team ownership.',
      firstResponseDueAt: null,
      id: randomUUID(),
      number: 1005,
      priority: TicketPriority.MEDIUM,
      requesterId: secondCustomer.id,
      resolutionDueAt: null,
      status: TicketStatus.OPEN,
      subject: 'Manager direct assignment',
      teamId: null,
      updatedAt: new Date('2026-04-20T16:00:00.000Z'),
    };
    prismaMock.ticketStore.push(managerDirectTicket);

    const billingTeamTicket: StoredTicket = {
      assigneeId: null,
      categoryId: billingCategory.id,
      createdAt: new Date('2026-04-20T17:00:00.000Z'),
      description:
        'Billing queue ticket that should stay outside technical staff visibility.',
      firstResponseDueAt: null,
      id: randomUUID(),
      number: 1006,
      priority: TicketPriority.LOW,
      requesterId: secondCustomer.id,
      resolutionDueAt: null,
      status: TicketStatus.OPEN,
      subject: 'Billing queue ticket',
      teamId: billingTeam.id,
      updatedAt: new Date('2026-04-20T17:00:00.000Z'),
    };
    prismaMock.ticketStore.push(billingTeamTicket);

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          cache: false,
          ignoreEnvFile: true,
          isGlobal: true,
          load: [apiConfiguration],
          validate: validateApiEnv,
        }),
        AuthModule,
        TicketsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock as unknown as PrismaService)
      .overrideProvider(StorageService)
      .useValue(storageMock)
      .overrideProvider(QueueService)
      .useValue(queueMock)
      .overrideProvider(RealtimeService)
      .useValue(realtimeMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe(validationPipeOptions));

    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }

    process.env = originalEnv;
  });

  it('allows an authenticated customer to create a ticket and writes a CREATED event', async () => {
    const agent = request.agent(app.getHttpServer());
    const category = prismaMock.categoryStore[0]!;
    const technicalTeam = prismaMock.teamStore.find(
      (team) => team.name === 'Technical Support',
    )!;
    const customer = prismaMock.userStore.find(
      (user) => user.email === 'customer@demo.test',
    )!;

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const response = await agent
      .post('/tickets')
      .send({
        categoryId: category.id,
        description:
          'Checkout returns a 500 error during payment confirmation.',
        priority: TicketPriority.HIGH,
        subject: 'Checkout failure blocks order placement',
      })
      .expect(201);

    expect(response.body).toEqual({
      id: expect.any(String),
      number: expect.any(Number),
      subject: 'Checkout failure blocks order placement',
      description: 'Checkout returns a 500 error during payment confirmation.',
      status: TicketStatus.OPEN,
      priority: TicketPriority.HIGH,
      requester: {
        id: customer.id,
        email: 'customer@demo.test',
        firstName: 'Casey',
        lastName: 'Customer',
      },
      assignee: null,
      team: {
        id: technicalTeam.id,
        name: technicalTeam.name,
        description: technicalTeam.description,
      },
      category: {
        id: category.id,
        name: category.name,
        description: category.description,
        color: category.color,
      },
      tags: [],
      firstResponseDueAt: null,
      resolutionDueAt: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    expect(
      prismaMock.ticketEventStore.some(
        (event) =>
          event.type === TicketEventType.CREATED &&
          event.actorId === customer.id &&
          event.ticketId === response.body.id,
      ),
    ).toBe(true);
  });

  it('auto-routes a customer-created ticket with the Billing category to the Billing team', async () => {
    const agent = request.agent(app.getHttpServer());
    const billingCategory = prismaMock.categoryStore.find(
      (entry) => entry.name === 'Billing',
    )!;
    const billingTeam = prismaMock.teamStore.find(
      (team) => team.name === 'Billing',
    )!;

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const response = await agent
      .post('/tickets')
      .send({
        categoryId: billingCategory.id,
        description: 'Invoice shows a duplicate subscription charge.',
        priority: TicketPriority.HIGH,
        subject: 'Duplicate charge on invoice',
      })
      .expect(201);

    expect(response.body.team).toEqual({
      id: billingTeam.id,
      name: billingTeam.name,
      description: billingTeam.description,
    });
    expect(response.body.assignee).toBeNull();

    const stored = prismaMock.ticketStore.find(
      (ticket) => ticket.id === response.body.id,
    );
    expect(stored?.teamId).toBe(billingTeam.id);
    expect(stored?.assigneeId).toBeNull();
  });

  it('auto-routes a customer-created ticket with the Account Access category to the Technical Support team', async () => {
    const agent = request.agent(app.getHttpServer());
    const accountAccessCategory = prismaMock.categoryStore.find(
      (entry) => entry.name === 'Account Access',
    )!;
    const technicalTeam = prismaMock.teamStore.find(
      (team) => team.name === 'Technical Support',
    )!;

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const response = await agent
      .post('/tickets')
      .send({
        categoryId: accountAccessCategory.id,
        description: 'Password reset loop blocks sign-in.',
        priority: TicketPriority.HIGH,
        subject: 'Cannot complete password reset',
      })
      .expect(201);

    expect(response.body.team).toEqual({
      id: technicalTeam.id,
      name: technicalTeam.name,
      description: technicalTeam.description,
    });
    expect(response.body.assignee).toBeNull();

    const stored = prismaMock.ticketStore.find(
      (ticket) => ticket.id === response.body.id,
    );
    expect(stored?.teamId).toBe(technicalTeam.id);
  });

  it('auto-routes an uncategorized customer-created ticket to the Technical Support team', async () => {
    const agent = request.agent(app.getHttpServer());
    const technicalTeam = prismaMock.teamStore.find(
      (team) => team.name === 'Technical Support',
    )!;

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const response = await agent
      .post('/tickets')
      .send({
        description: 'Generic issue without a category.',
        priority: TicketPriority.MEDIUM,
        subject: 'Uncategorized support request',
      })
      .expect(201);

    expect(response.body.team).toEqual({
      id: technicalTeam.id,
      name: technicalTeam.name,
      description: technicalTeam.description,
    });
    expect(response.body.category).toBeNull();
    expect(response.body.assignee).toBeNull();

    const stored = prismaMock.ticketStore.find(
      (ticket) => ticket.id === response.body.id,
    );
    expect(stored?.teamId).toBe(technicalTeam.id);
    expect(stored?.categoryId).toBeNull();
  });

  it('falls back to teamId=null when the resolved team does not exist in the workspace', async () => {
    const technicalTeamIndex = prismaMock.teamStore.findIndex(
      (team) => team.name === 'Technical Support',
    );
    expect(technicalTeamIndex).toBeGreaterThanOrEqual(0);
    prismaMock.teamStore.splice(technicalTeamIndex, 1);

    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const response = await agent
      .post('/tickets')
      .send({
        description: 'Ticket created when the default routing team is absent.',
        priority: TicketPriority.LOW,
        subject: 'Uncategorized ticket without a default team',
      })
      .expect(201);

    expect(response.body.team).toBeNull();
    expect(response.body.assignee).toBeNull();

    const stored = prismaMock.ticketStore.find(
      (ticket) => ticket.id === response.body.id,
    );
    expect(stored?.teamId).toBeNull();
  });

  it('makes a newly customer-created Technical Issue ticket visible to a Technical Support team manager', async () => {
    const customerAgent = request.agent(app.getHttpServer());
    const managerAgent = request.agent(app.getHttpServer());
    const technicalCategory = prismaMock.categoryStore.find(
      (entry) => entry.name === 'Technical Issue',
    )!;
    const technicalTeam = prismaMock.teamStore.find(
      (team) => team.name === 'Technical Support',
    )!;

    await customerAgent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const createResponse = await customerAgent
      .post('/tickets')
      .send({
        categoryId: technicalCategory.id,
        description: 'Storefront API returns a 500 for integration traffic.',
        priority: TicketPriority.HIGH,
        subject: 'Checkout API regression',
      })
      .expect(201);

    expect(createResponse.body.team?.id).toBe(technicalTeam.id);

    await managerAgent
      .post('/auth/login')
      .send({
        email: 'manager@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const detailResponse = await managerAgent
      .get(`/tickets/${createResponse.body.id}`)
      .expect(200);

    expect(detailResponse.body.id).toBe(createResponse.body.id);
    expect(detailResponse.body.team?.id).toBe(technicalTeam.id);
  });

  it('rejects invalid create payloads with validation errors', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    await agent
      .post('/tickets')
      .send({
        description: '',
        priority: 'INVALID',
        subject: '',
      })
      .expect(400);
  });

  it('returns 403 when a non-customer tries to create a ticket', async () => {
    const agent = request.agent(app.getHttpServer());
    const category = prismaMock.categoryStore[0]!;

    await agent
      .post('/auth/login')
      .send({
        email: 'agent@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    await agent
      .post('/tickets')
      .send({
        categoryId: category.id,
        description: 'Agents cannot create tickets in M2.',
        priority: TicketPriority.MEDIUM,
        subject: 'Should be rejected',
      })
      .expect(403);
  });

  it('returns read-only ticket categories for authenticated users', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const response = await agent.get('/tickets/categories').expect(200);

    const accountAccessCategory = prismaMock.categoryStore.find(
      (entry) => entry.name === 'Account Access',
    )!;

    expect(response.body).toEqual([
      {
        id: accountAccessCategory.id,
        name: 'Account Access',
        description: 'Login, MFA, password reset, and account access problems.',
        color: '#7c3aed',
      },
      {
        id: prismaMock.categoryStore[1]!.id,
        name: 'Billing',
        description: 'Invoices, charges, and payment-related requests.',
        color: '#16a34a',
      },
      {
        id: prismaMock.categoryStore[0]!.id,
        name: 'Technical Issue',
        description:
          'Errors, broken flows, and technical troubleshooting requests.',
        color: '#2563eb',
      },
    ]);
  });

  it('requires authentication for the read-only ticket category list', async () => {
    await request(app.getHttpServer()).get('/tickets/categories').expect(401);
  });

  it('returns ticket detail for a customer viewing their own ticket', async () => {
    const agent = request.agent(app.getHttpServer());
    const ownTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Own ticket detail',
    )!;

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const response = await agent.get(`/tickets/${ownTicket.id}`).expect(200);

    expect(response.body).toMatchObject({
      id: ownTicket.id,
      number: ownTicket.number,
      subject: ownTicket.subject,
      status: ownTicket.status,
      priority: ownTicket.priority,
      requester: {
        email: 'customer@demo.test',
      },
      tags: [
        {
          name: 'urgent',
        },
      ],
    });
  });

  it('returns 403 when a customer tries to view another customer ticket', async () => {
    const agent = request.agent(app.getHttpServer());
    const otherTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Other customer ticket',
    )!;

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    await agent.get(`/tickets/${otherTicket.id}`).expect(403);
  });

  it('allows a team agent to view an unassigned team-owned ticket', async () => {
    const agent = request.agent(app.getHttpServer());
    const teamTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Team queue ticket',
    )!;

    await agent
      .post('/auth/login')
      .send({
        email: 'agent@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const response = await agent.get(`/tickets/${teamTicket.id}`).expect(200);

    expect(response.body).toMatchObject({
      id: teamTicket.id,
      team: {
        name: 'Technical Support',
      },
      assignee: null,
    });
  });

  it('returns 404 when the ticket does not exist', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/login')
      .send({
        email: 'admin@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    await agent.get(`/tickets/${randomUUID()}`).expect(404);
  });

  it('returns only customer-owned tickets in the list for a customer', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const response = await agent.get('/tickets').expect(200);

    expect(
      response.body.items.map((ticket: { subject: string }) => ticket.subject),
    ).toEqual(['Urgent team ticket', 'Own ticket detail']);
    expect(response.body.meta).toMatchObject({
      page: 1,
      limit: 10,
      totalItems: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  });

  it('returns team-visible and directly assigned tickets for an agent without leaking teamless unassigned tickets', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/login')
      .send({
        email: 'agent@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const response = await agent
      .get('/tickets')
      .query({
        sortBy: 'number',
        sortOrder: 'asc',
      })
      .expect(200);

    expect(
      response.body.items.map((ticket: { subject: string }) => ticket.subject),
    ).toEqual(['Team queue ticket', 'Assigned ticket', 'Urgent team ticket']);
    expect(
      response.body.items.some(
        (ticket: { subject: string }) =>
          ticket.subject === 'Other customer ticket',
      ),
    ).toBe(false);
  });

  it('returns team tickets plus directly assigned tickets for a manager', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/login')
      .send({
        email: 'manager@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const response = await agent
      .get('/tickets')
      .query({
        sortBy: 'number',
        sortOrder: 'asc',
      })
      .expect(200);

    expect(
      response.body.items.map((ticket: { subject: string }) => ticket.subject),
    ).toEqual([
      'Team queue ticket',
      'Assigned ticket',
      'Urgent team ticket',
      'Manager direct assignment',
    ]);
  });

  it('applies filters without widening admin visibility', async () => {
    const agent = request.agent(app.getHttpServer());
    const billingCategory = prismaMock.categoryStore.find(
      (category) => category.name === 'Billing',
    )!;
    const billingTeam = prismaMock.teamStore.find(
      (team) => team.name === 'Billing',
    )!;

    await agent
      .post('/auth/login')
      .send({
        email: 'admin@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const response = await agent
      .get('/tickets')
      .query({
        categoryId: billingCategory.id,
        status: TicketStatus.OPEN,
        teamId: billingTeam.id,
      })
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      subject: 'Billing queue ticket',
      category: {
        name: 'Billing',
      },
      team: {
        name: 'Billing',
      },
    });
  });

  it('sorts by priority using the domain order LOW < MEDIUM < HIGH < URGENT', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/login')
      .send({
        email: 'admin@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const response = await agent
      .get('/tickets')
      .query({
        sortBy: 'priority',
        sortOrder: 'asc',
      })
      .expect(200);

    expect(
      response.body.items.map(
        (ticket: { priority: TicketPriority }) => ticket.priority,
      ),
    ).toEqual([
      TicketPriority.LOW,
      TicketPriority.LOW,
      TicketPriority.MEDIUM,
      TicketPriority.MEDIUM,
      TicketPriority.HIGH,
      TicketPriority.HIGH,
      TicketPriority.URGENT,
    ]);
  });

  it('returns stable pagination metadata for list queries', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/login')
      .send({
        email: 'admin@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const response = await agent
      .get('/tickets')
      .query({
        page: 2,
        limit: 2,
        sortBy: 'number',
        sortOrder: 'asc',
      })
      .expect(200);

    expect(
      response.body.items.map((ticket: { number: number }) => ticket.number),
    ).toEqual([1002, 1003]);
    expect(response.body.meta).toMatchObject({
      page: 2,
      limit: 2,
      totalItems: 7,
      totalPages: 4,
      hasNextPage: true,
      hasPreviousPage: true,
      sortBy: 'number',
      sortOrder: 'asc',
    });
  });

  it('allows a customer to edit subject and description on their own ticket', async () => {
    const agent = request.agent(app.getHttpServer());
    const ownTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Own ticket detail',
    )!;
    const initialEventCount = prismaMock.ticketEventStore.length;

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const response = await agent
      .patch(`/tickets/${ownTicket.id}`)
      .send({
        subject: 'Own ticket detail updated',
        description: 'Customer updated the description before support replied.',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: ownTicket.id,
      subject: 'Own ticket detail updated',
      description: 'Customer updated the description before support replied.',
      status: TicketStatus.OPEN,
    });
    expect(prismaMock.ticketEventStore).toHaveLength(initialEventCount);
  });

  it('allows a customer to close and then reopen their own ticket with the correct events', async () => {
    const agent = request.agent(app.getHttpServer());
    const ownTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Own ticket detail',
    )!;
    const customer = prismaMock.userStore.find(
      (user) => user.email === 'customer@demo.test',
    )!;

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const closeResponse = await agent
      .patch(`/tickets/${ownTicket.id}`)
      .send({
        status: TicketStatus.CLOSED,
      })
      .expect(200);

    expect(closeResponse.body.status).toBe(TicketStatus.CLOSED);
    expect(
      prismaMock.ticketEventStore.some(
        (event) =>
          event.ticketId === ownTicket.id &&
          event.actorId === customer.id &&
          event.type === TicketEventType.CLOSED_BY_CUSTOMER,
      ),
    ).toBe(true);

    const reopenResponse = await agent
      .patch(`/tickets/${ownTicket.id}`)
      .send({
        status: TicketStatus.OPEN,
      })
      .expect(200);

    expect(reopenResponse.body.status).toBe(TicketStatus.OPEN);
    expect(
      prismaMock.ticketEventStore.some(
        (event) =>
          event.ticketId === ownTicket.id &&
          event.actorId === customer.id &&
          event.type === TicketEventType.REOPENED_BY_CUSTOMER,
      ),
    ).toBe(true);
  });

  it('returns 403 when a customer tries to patch another customer ticket', async () => {
    const agent = request.agent(app.getHttpServer());
    const otherTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Other customer ticket',
    )!;

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    await agent
      .patch(`/tickets/${otherTicket.id}`)
      .send({
        subject: 'Should be forbidden',
      })
      .expect(403);
  });

  it('returns 403 when a non-customer tries to patch a ticket', async () => {
    const agent = request.agent(app.getHttpServer());
    const teamTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Team queue ticket',
    )!;

    await agent
      .post('/auth/login')
      .send({
        email: 'agent@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    await agent
      .patch(`/tickets/${teamTicket.id}`)
      .send({
        subject: 'Agent should not patch in M2',
      })
      .expect(403);
  });

  it('returns 400 for customer patch requests outside the narrow M2 status scope', async () => {
    const agent = request.agent(app.getHttpServer());
    const ownTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Own ticket detail',
    )!;

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    await agent
      .patch(`/tickets/${ownTicket.id}`)
      .send({
        status: TicketStatus.PENDING,
      })
      .expect(400);
  });

  it('returns 400 for unsupported patch fields and empty patch payloads', async () => {
    const agent = request.agent(app.getHttpServer());
    const ownTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Own ticket detail',
    )!;

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    await agent
      .patch(`/tickets/${ownTicket.id}`)
      .send({
        priority: TicketPriority.URGENT,
      })
      .expect(400);

    await agent.patch(`/tickets/${ownTicket.id}`).send({}).expect(400);
  });

  it('allows a customer to add a public reply to their own non-closed ticket and writes a REPLIED event', async () => {
    const agent = request.agent(app.getHttpServer());
    const ownTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Own ticket detail',
    )!;
    const customer = prismaMock.userStore.find(
      (user) => user.email === 'customer@demo.test',
    )!;

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const response = await agent
      .post(`/tickets/${ownTicket.id}/replies`)
      .send({
        body: '  I can still reproduce this on my account.  ',
      })
      .expect(201);

    expect(response.body).toEqual({
      id: expect.any(String),
      ticketId: ownTicket.id,
      author: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
      },
      body: 'I can still reproduce this on my account.',
      isInternal: false,
      attachments: [],
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(ownTicket.status).toBe(TicketStatus.OPEN);
    expect(
      prismaMock.ticketMessageStore.some(
        (message) =>
          message.id === response.body.id &&
          message.ticketId === ownTicket.id &&
          message.authorId === customer.id &&
          !message.isInternal,
      ),
    ).toBe(true);
    expect(
      prismaMock.ticketEventStore.some(
        (event) =>
          event.ticketId === ownTicket.id &&
          event.actorId === customer.id &&
          event.type === TicketEventType.REPLIED,
      ),
    ).toBe(true);
  });

  it('allows staff to add a public reply to a visible non-closed ticket', async () => {
    const agent = request.agent(app.getHttpServer());
    const teamTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Team queue ticket',
    )!;
    const staffUser = prismaMock.userStore.find(
      (user) => user.email === 'agent@demo.test',
    )!;

    await agent
      .post('/auth/login')
      .send({
        email: 'agent@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const response = await agent
      .post(`/tickets/${teamTicket.id}/replies`)
      .send({
        body: 'We are investigating this ticket now.',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      ticketId: teamTicket.id,
      author: {
        email: 'agent@demo.test',
      },
      body: 'We are investigating this ticket now.',
      isInternal: false,
    });
    expect(teamTicket.status).toBe(TicketStatus.PENDING);
    expect(
      prismaMock.ticketEventStore.some(
        (event) =>
          event.ticketId === teamTicket.id &&
          event.actorId === staffUser.id &&
          event.type === TicketEventType.REPLIED,
      ),
    ).toBe(true);
  });

  it('returns 403 when a customer tries to reply to another customer ticket', async () => {
    const agent = request.agent(app.getHttpServer());
    const otherTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Other customer ticket',
    )!;

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    await agent
      .post(`/tickets/${otherTicket.id}/replies`)
      .send({
        body: 'This should be rejected.',
      })
      .expect(403);

    expect(prismaMock.ticketMessageStore).toHaveLength(0);
  });

  it('returns 400 when anyone tries to public-reply to a closed ticket', async () => {
    const agent = request.agent(app.getHttpServer());
    const closedTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Assigned ticket',
    )!;
    closedTicket.status = TicketStatus.CLOSED;

    await agent
      .post('/auth/login')
      .send({
        email: 'agent@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    await agent
      .post(`/tickets/${closedTicket.id}/replies`)
      .send({
        body: 'This public reply should not be allowed on a closed ticket.',
      })
      .expect(400);

    expect(
      prismaMock.ticketMessageStore.some(
        (message) => message.ticketId === closedTicket.id,
      ),
    ).toBe(false);
    expect(closedTicket.status).toBe(TicketStatus.CLOSED);
  });

  it('allows staff to add an internal note to a visible closed ticket without changing status', async () => {
    const agent = request.agent(app.getHttpServer());
    const closedTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Assigned ticket',
    )!;
    closedTicket.status = TicketStatus.CLOSED;
    const staffUser = prismaMock.userStore.find(
      (user) => user.email === 'agent@demo.test',
    )!;

    await agent
      .post('/auth/login')
      .send({
        email: 'agent@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const response = await agent
      .post(`/tickets/${closedTicket.id}/internal-notes`)
      .send({
        body: 'Internal close-out note for support history.',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      ticketId: closedTicket.id,
      author: {
        email: 'agent@demo.test',
      },
      body: 'Internal close-out note for support history.',
      isInternal: true,
    });
    expect(closedTicket.status).toBe(TicketStatus.CLOSED);
    expect(
      prismaMock.ticketEventStore.some(
        (event) =>
          event.ticketId === closedTicket.id &&
          event.actorId === staffUser.id &&
          event.type === TicketEventType.NOTE_ADDED,
      ),
    ).toBe(true);
  });

  it('returns 403 when a customer tries to create an internal note', async () => {
    const agent = request.agent(app.getHttpServer());
    const ownTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Own ticket detail',
    )!;

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    await agent
      .post(`/tickets/${ownTicket.id}/internal-notes`)
      .send({
        body: 'Customers must not create internal notes.',
      })
      .expect(403);

    expect(prismaMock.ticketMessageStore).toHaveLength(0);
  });

  it('returns 403 when staff tries to create an internal note on a ticket outside visibility', async () => {
    const agent = request.agent(app.getHttpServer());
    const billingTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Billing queue ticket',
    )!;

    await agent
      .post('/auth/login')
      .send({
        email: 'agent@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    await agent
      .post(`/tickets/${billingTicket.id}/internal-notes`)
      .send({
        body: 'This note should not be allowed outside team visibility.',
      })
      .expect(403);

    expect(prismaMock.ticketMessageStore).toHaveLength(0);
  });

  it('validates reply attachmentIds without rejecting the optional field itself', async () => {
    const agent = request.agent(app.getHttpServer());
    const ownTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Own ticket detail',
    )!;
    const duplicateAttachmentId = randomUUID();

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    await agent
      .post(`/tickets/${ownTicket.id}/replies`)
      .send({
        body: '',
      })
      .expect(400);

    await agent
      .post(`/tickets/${ownTicket.id}/replies`)
      .send({
        body: 'Attachment IDs are intentionally deferred to a later BE-03 slice.',
        attachmentIds: ['not-a-uuid'],
      })
      .expect(400);

    await agent
      .post(`/tickets/${ownTicket.id}/replies`)
      .send({
        body: 'Duplicate attachment IDs should be rejected.',
        attachmentIds: [duplicateAttachmentId, duplicateAttachmentId],
      })
      .expect(400);
  });

  it('links uploaded attachments to a new public reply and returns safe attachment metadata', async () => {
    const agent = request.agent(app.getHttpServer());
    const ownTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Own ticket detail',
    )!;
    const customer = prismaMock.userStore.find(
      (user) => user.email === 'customer@demo.test',
    )!;
    const attachmentId = randomUUID();

    prismaMock.attachmentStore.push({
      createdAt: new Date('2026-04-21T12:00:00.000Z'),
      filename: 'customer screenshot.png',
      id: attachmentId,
      messageId: null,
      mimeType: 'image/png',
      sizeBytes: 4096,
      storedKey: `tickets/${ownTicket.id}/attachments/customer-screenshot.png`,
      ticketId: ownTicket.id,
      uploadedById: customer.id,
    });

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const response = await agent
      .post(`/tickets/${ownTicket.id}/replies`)
      .send({
        body: 'Screenshot attached for context.',
        attachmentIds: [attachmentId],
      })
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      ticketId: ownTicket.id,
      body: 'Screenshot attached for context.',
      isInternal: false,
      attachments: [
        {
          id: attachmentId,
          ticketId: ownTicket.id,
          messageId: response.body.id,
          uploadedById: customer.id,
          filename: 'customer screenshot.png',
          mimeType: 'image/png',
          sizeBytes: 4096,
          createdAt: '2026-04-21T12:00:00.000Z',
        },
      ],
    });
    expect(response.body.attachments[0].storedKey).toBeUndefined();
    expect(prismaMock.attachmentStore[0]!.messageId).toBe(response.body.id);
  });

  it('rejects a customer linking another user upload on the same ticket to a public reply', async () => {
    const agent = request.agent(app.getHttpServer());
    const ownTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Own ticket detail',
    )!;
    const staffUser = prismaMock.userStore.find(
      (user) => user.email === 'agent@demo.test',
    )!;
    const staffAttachmentId = randomUUID();

    prismaMock.attachmentStore.push({
      createdAt: new Date('2026-04-21T12:03:00.000Z'),
      filename: 'staff unattached upload.txt',
      id: staffAttachmentId,
      messageId: null,
      mimeType: 'text/plain',
      sizeBytes: 32,
      storedKey: `tickets/${ownTicket.id}/attachments/staff-unattached-upload.txt`,
      ticketId: ownTicket.id,
      uploadedById: staffUser.id,
    });

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    await agent
      .post(`/tickets/${ownTicket.id}/replies`)
      .send({
        body: 'Trying to link a staff upload by ID.',
        attachmentIds: [staffAttachmentId],
      })
      .expect(400);

    expect(prismaMock.ticketMessageStore).toHaveLength(0);
    expect(prismaMock.attachmentStore[0]!.messageId).toBeNull();
  });

  it('rejects cross-ticket and already-linked attachments when creating a message', async () => {
    const agent = request.agent(app.getHttpServer());
    const ownTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Own ticket detail',
    )!;
    const otherTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Other customer ticket',
    )!;
    const customer = prismaMock.userStore.find(
      (user) => user.email === 'customer@demo.test',
    )!;
    const crossTicketAttachmentId = randomUUID();
    const alreadyLinkedAttachmentId = randomUUID();

    prismaMock.attachmentStore.push(
      {
        createdAt: new Date('2026-04-21T12:05:00.000Z'),
        filename: 'other-ticket.txt',
        id: crossTicketAttachmentId,
        messageId: null,
        mimeType: 'text/plain',
        sizeBytes: 12,
        storedKey: `tickets/${otherTicket.id}/attachments/other-ticket.txt`,
        ticketId: otherTicket.id,
        uploadedById: customer.id,
      },
      {
        createdAt: new Date('2026-04-21T12:10:00.000Z'),
        filename: 'already-linked.txt',
        id: alreadyLinkedAttachmentId,
        messageId: randomUUID(),
        mimeType: 'text/plain',
        sizeBytes: 14,
        storedKey: `tickets/${ownTicket.id}/attachments/already-linked.txt`,
        ticketId: ownTicket.id,
        uploadedById: customer.id,
      },
    );

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    await agent
      .post(`/tickets/${ownTicket.id}/replies`)
      .send({
        body: 'Cross-ticket attachment must fail.',
        attachmentIds: [crossTicketAttachmentId],
      })
      .expect(400);

    await agent
      .post(`/tickets/${ownTicket.id}/replies`)
      .send({
        body: 'Already-linked attachment must fail.',
        attachmentIds: [alreadyLinkedAttachmentId],
      })
      .expect(400);

    expect(
      prismaMock.ticketMessageStore.some((message) =>
        [
          'Cross-ticket attachment must fail.',
          'Already-linked attachment must fail.',
        ].includes(message.body),
      ),
    ).toBe(false);
  });

  it('links attachments to internal notes without exposing them to customer timelines', async () => {
    const staffAgent = request.agent(app.getHttpServer());
    const customerAgent = request.agent(app.getHttpServer());
    const ownTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Own ticket detail',
    )!;
    ownTicket.teamId = prismaMock.teamStore.find(
      (team) => team.name === 'Technical Support',
    )!.id;
    const staffUser = prismaMock.userStore.find(
      (user) => user.email === 'agent@demo.test',
    )!;
    const publicAttachmentId = randomUUID();
    const internalAttachmentId = randomUUID();

    prismaMock.attachmentStore.push(
      {
        createdAt: new Date('2026-04-21T13:00:00.000Z'),
        filename: 'public transcript.txt',
        id: publicAttachmentId,
        messageId: null,
        mimeType: 'text/plain',
        sizeBytes: 24,
        storedKey: `tickets/${ownTicket.id}/attachments/public-transcript.txt`,
        ticketId: ownTicket.id,
        uploadedById: staffUser.id,
      },
      {
        createdAt: new Date('2026-04-21T13:05:00.000Z'),
        filename: 'internal diagnostics.txt',
        id: internalAttachmentId,
        messageId: null,
        mimeType: 'text/plain',
        sizeBytes: 32,
        storedKey: `tickets/${ownTicket.id}/attachments/internal-diagnostics.txt`,
        ticketId: ownTicket.id,
        uploadedById: staffUser.id,
      },
    );

    await staffAgent
      .post('/auth/login')
      .send({
        email: 'agent@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    await staffAgent
      .post(`/tickets/${ownTicket.id}/replies`)
      .send({
        body: 'Public reply with attachment.',
        attachmentIds: [publicAttachmentId],
      })
      .expect(201);

    await staffAgent
      .post(`/tickets/${ownTicket.id}/internal-notes`)
      .send({
        body: 'Internal note with attachment.',
        attachmentIds: [internalAttachmentId],
      })
      .expect(201);

    await customerAgent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const customerTimelineResponse = await customerAgent
      .get(`/tickets/${ownTicket.id}/timeline`)
      .expect(200);

    expect(
      customerTimelineResponse.body.items.some(
        (item: { body?: string }) =>
          item.body === 'Internal note with attachment.',
      ),
    ).toBe(false);
    expect(JSON.stringify(customerTimelineResponse.body)).toContain(
      'public transcript.txt',
    );
    expect(JSON.stringify(customerTimelineResponse.body)).not.toContain(
      'internal diagnostics.txt',
    );

    const staffTimelineResponse = await staffAgent
      .get(`/tickets/${ownTicket.id}/timeline`)
      .expect(200);

    expect(JSON.stringify(staffTimelineResponse.body)).toContain(
      'public transcript.txt',
    );
    expect(JSON.stringify(staffTimelineResponse.body)).toContain(
      'internal diagnostics.txt',
    );
  });

  it('returns a customer-visible timeline without internal notes or NOTE_ADDED events', async () => {
    const agent = request.agent(app.getHttpServer());
    const ownTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Own ticket detail',
    )!;
    const customer = prismaMock.userStore.find(
      (user) => user.email === 'customer@demo.test',
    )!;
    const staffUser = prismaMock.userStore.find(
      (user) => user.email === 'agent@demo.test',
    )!;

    prismaMock.ticketEventStore.push(
      {
        actorId: customer.id,
        createdAt: new Date('2026-04-21T10:00:00.000Z'),
        id: randomUUID(),
        metadata: null,
        ticketId: ownTicket.id,
        type: TicketEventType.CREATED,
      },
      {
        actorId: customer.id,
        createdAt: new Date('2026-04-21T10:20:00.000Z'),
        id: randomUUID(),
        metadata: null,
        ticketId: ownTicket.id,
        type: TicketEventType.REPLIED,
      },
      {
        actorId: staffUser.id,
        createdAt: new Date('2026-04-21T10:40:00.000Z'),
        id: randomUUID(),
        metadata: {
          source: 'internal-note',
        },
        ticketId: ownTicket.id,
        type: TicketEventType.NOTE_ADDED,
      },
    );
    prismaMock.ticketMessageStore.push(
      {
        authorId: customer.id,
        body: 'Public customer reply for timeline.',
        createdAt: new Date('2026-04-21T10:10:00.000Z'),
        id: randomUUID(),
        isInternal: false,
        ticketId: ownTicket.id,
        updatedAt: new Date('2026-04-21T10:10:00.000Z'),
      },
      {
        authorId: staffUser.id,
        body: 'Internal note that customers must never receive.',
        createdAt: new Date('2026-04-21T10:30:00.000Z'),
        id: randomUUID(),
        isInternal: true,
        ticketId: ownTicket.id,
        updatedAt: new Date('2026-04-21T10:30:00.000Z'),
      },
    );

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const response = await agent
      .get(`/tickets/${ownTicket.id}/timeline`)
      .expect(200);

    expect(response.body.ticketId).toBe(ownTicket.id);
    expect(
      response.body.items.map((item: { type: string }) => item.type),
    ).toEqual(['SYSTEM_EVENT', 'PUBLIC_REPLY', 'SYSTEM_EVENT']);
    expect(
      response.body.items.some(
        (item: { body?: string }) =>
          item.body === 'Internal note that customers must never receive.',
      ),
    ).toBe(false);
    expect(
      response.body.items.some(
        (item: { eventType?: TicketEventType }) =>
          item.eventType === TicketEventType.NOTE_ADDED,
      ),
    ).toBe(false);
  });

  it('returns a staff-visible timeline with internal notes and NOTE_ADDED events in chronological order', async () => {
    const agent = request.agent(app.getHttpServer());
    const teamTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Team queue ticket',
    )!;
    const customer = prismaMock.userStore.find(
      (user) => user.email === 'customer.two@demo.test',
    )!;
    const staffUser = prismaMock.userStore.find(
      (user) => user.email === 'agent@demo.test',
    )!;

    prismaMock.ticketEventStore.push(
      {
        actorId: customer.id,
        createdAt: new Date('2026-04-21T09:00:00.000Z'),
        id: randomUUID(),
        metadata: null,
        ticketId: teamTicket.id,
        type: TicketEventType.CREATED,
      },
      {
        actorId: staffUser.id,
        createdAt: new Date('2026-04-21T09:30:00.000Z'),
        id: randomUUID(),
        metadata: null,
        ticketId: teamTicket.id,
        type: TicketEventType.NOTE_ADDED,
      },
    );
    prismaMock.ticketMessageStore.push(
      {
        authorId: customer.id,
        body: 'Customer-visible reply.',
        createdAt: new Date('2026-04-21T09:10:00.000Z'),
        id: randomUUID(),
        isInternal: false,
        ticketId: teamTicket.id,
        updatedAt: new Date('2026-04-21T09:10:00.000Z'),
      },
      {
        authorId: staffUser.id,
        body: 'Staff-only investigation note.',
        createdAt: new Date('2026-04-21T09:20:00.000Z'),
        id: randomUUID(),
        isInternal: true,
        ticketId: teamTicket.id,
        updatedAt: new Date('2026-04-21T09:20:00.000Z'),
      },
    );

    await agent
      .post('/auth/login')
      .send({
        email: 'agent@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const response = await agent
      .get(`/tickets/${teamTicket.id}/timeline`)
      .expect(200);

    expect(
      response.body.items.map((item: { type: string }) => item.type),
    ).toEqual([
      'SYSTEM_EVENT',
      'PUBLIC_REPLY',
      'INTERNAL_NOTE',
      'SYSTEM_EVENT',
    ]);
    expect(response.body.items[2]).toMatchObject({
      type: 'INTERNAL_NOTE',
      body: 'Staff-only investigation note.',
      isInternal: true,
      author: {
        email: 'agent@demo.test',
      },
    });
    expect(response.body.items[3]).toMatchObject({
      type: 'SYSTEM_EVENT',
      eventType: TicketEventType.NOTE_ADDED,
      actor: {
        email: 'agent@demo.test',
      },
    });
    expect(
      response.body.items.some(
        (item: { downloadUrl?: string }) => item.downloadUrl !== undefined,
      ),
    ).toBe(false);
  });

  it('returns 403 when a customer requests another customer ticket timeline', async () => {
    const agent = request.agent(app.getHttpServer());
    const otherTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Other customer ticket',
    )!;

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    await agent.get(`/tickets/${otherTicket.id}/timeline`).expect(403);
  });

  it('returns 403 when staff requests a ticket timeline outside visibility', async () => {
    const agent = request.agent(app.getHttpServer());
    const billingTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Billing queue ticket',
    )!;

    await agent
      .post('/auth/login')
      .send({
        email: 'agent@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    await agent.get(`/tickets/${billingTicket.id}/timeline`).expect(403);
  });

  it('uploads an attachment for a visible ticket, stores metadata, and writes an ATTACHMENT_ADDED event', async () => {
    const agent = request.agent(app.getHttpServer());
    const ownTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Own ticket detail',
    )!;
    const customer = prismaMock.userStore.find(
      (user) => user.email === 'customer@demo.test',
    )!;

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const response = await agent
      .post(`/tickets/${ownTicket.id}/attachments`)
      .attach('file', Buffer.from('plain text attachment'), {
        contentType: 'text/plain',
        filename: 'error log.txt',
      })
      .expect(201);

    expect(response.body).toEqual({
      id: expect.any(String),
      ticketId: ownTicket.id,
      messageId: null,
      uploadedById: customer.id,
      filename: 'error log.txt',
      mimeType: 'text/plain',
      sizeBytes: Buffer.byteLength('plain text attachment'),
      createdAt: expect.any(String),
    });
    expect(response.body.storedKey).toBeUndefined();
    expect(storageMock.upload).toHaveBeenCalledWith({
      buffer: Buffer.from('plain text attachment'),
      key: expect.stringMatching(
        new RegExp(`^tickets/${ownTicket.id}/attachments/.+-error-log.txt$`),
      ),
      mimeType: 'text/plain',
    });
    expect(prismaMock.attachmentStore).toHaveLength(1);
    expect(prismaMock.attachmentStore[0]).toMatchObject({
      id: response.body.id,
      messageId: null,
      ticketId: ownTicket.id,
      uploadedById: customer.id,
    });
    expect(
      prismaMock.ticketEventStore.some(
        (event) =>
          event.ticketId === ownTicket.id &&
          event.actorId === customer.id &&
          event.type === TicketEventType.ATTACHMENT_ADDED &&
          event.metadata !== null,
      ),
    ).toBe(true);
  });

  it('cleans up storage and hides raw errors when attachment metadata persistence fails', async () => {
    const agent = request.agent(app.getHttpServer());
    const ownTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Own ticket detail',
    )!;

    prismaMock.attachment.create.mockRejectedValueOnce(
      new Error('raw prisma database detail should not be exposed'),
    );

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const response = await agent
      .post(`/tickets/${ownTicket.id}/attachments`)
      .attach('file', Buffer.from('metadata failure attachment'), {
        contentType: 'text/plain',
        filename: 'metadata failure.txt',
      })
      .expect(500);

    expect(response.body.message).toBe('Attachment metadata failed.');
    expect(JSON.stringify(response.body)).not.toContain('raw prisma');
    expect(storageMock.upload).toHaveBeenCalledWith({
      buffer: Buffer.from('metadata failure attachment'),
      key: expect.stringMatching(
        new RegExp(
          `^tickets/${ownTicket.id}/attachments/.+-metadata-failure.txt$`,
        ),
      ),
      mimeType: 'text/plain',
    });
    expect(storageMock.delete).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(
          `^tickets/${ownTicket.id}/attachments/.+-metadata-failure.txt$`,
        ),
      ),
    );
    expect(prismaMock.attachmentStore).toHaveLength(0);
    expect(prismaMock.ticketEventStore).not.toContainEqual(
      expect.objectContaining({
        type: TicketEventType.ATTACHMENT_ADDED,
      }),
    );
  });

  it('returns 403 and does not upload when a customer attaches to another customer ticket', async () => {
    const agent = request.agent(app.getHttpServer());
    const otherTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Other customer ticket',
    )!;

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    await agent
      .post(`/tickets/${otherTicket.id}/attachments`)
      .attach('file', Buffer.from('forbidden'), {
        contentType: 'text/plain',
        filename: 'forbidden.txt',
      })
      .expect(403);

    expect(storageMock.upload).not.toHaveBeenCalled();
    expect(prismaMock.attachmentStore).toHaveLength(0);
  });

  it('validates attachment uploads before storage writes', async () => {
    const agent = request.agent(app.getHttpServer());
    const ownTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Own ticket detail',
    )!;

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    await agent.post(`/tickets/${ownTicket.id}/attachments`).expect(400);

    await agent
      .post(`/tickets/${ownTicket.id}/attachments`)
      .attach('file', Buffer.alloc(0), {
        contentType: 'text/plain',
        filename: 'empty.txt',
      })
      .expect(400);

    await agent
      .post(`/tickets/${ownTicket.id}/attachments`)
      .attach('file', Buffer.from('unsafe script'), {
        contentType: 'application/javascript',
        filename: 'unsafe.js',
      })
      .expect(400);

    const tooLargeResponse = await agent
      .post(`/tickets/${ownTicket.id}/attachments`)
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), {
        contentType: 'text/plain',
        filename: 'too-large.txt',
      });

    expect([400, 413]).toContain(tooLargeResponse.status);
    expect(storageMock.upload).not.toHaveBeenCalled();
    expect(prismaMock.attachmentStore).toHaveLength(0);
  });

  it('allows a customer to get a signed download URL for a public-message attachment', async () => {
    const agent = request.agent(app.getHttpServer());
    const ownTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Own ticket detail',
    )!;
    const customer = prismaMock.userStore.find(
      (user) => user.email === 'customer@demo.test',
    )!;
    const publicMessageId = randomUUID();
    const publicAttachmentId = randomUUID();

    prismaMock.ticketMessageStore.push({
      authorId: customer.id,
      body: 'Public reply with customer-visible attachment.',
      createdAt: new Date('2026-04-21T10:55:00.000Z'),
      id: publicMessageId,
      isInternal: false,
      ticketId: ownTicket.id,
      updatedAt: new Date('2026-04-21T10:55:00.000Z'),
    });
    prismaMock.attachmentStore.push({
      createdAt: new Date('2026-04-21T11:00:00.000Z'),
      filename: 'visible.txt',
      id: publicAttachmentId,
      messageId: publicMessageId,
      mimeType: 'text/plain',
      sizeBytes: 12,
      storedKey: `tickets/${ownTicket.id}/attachments/visible.txt`,
      ticketId: ownTicket.id,
      uploadedById: customer.id,
    });

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const response = await agent
      .get(
        `/tickets/${ownTicket.id}/attachments/${publicAttachmentId}/download-url`,
      )
      .expect(200);

    expect(response.body).toEqual({
      expiresInSeconds: 300,
      url: 'http://localhost:9000/customer-support/signed-download-url',
    });
    expect(storageMock.getSignedUrl).toHaveBeenCalledWith(
      `tickets/${ownTicket.id}/attachments/visible.txt`,
    );
  });

  it('returns 403 when a customer requests an internal-note attachment download URL', async () => {
    const agent = request.agent(app.getHttpServer());
    const ownTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Own ticket detail',
    )!;
    const staffUser = prismaMock.userStore.find(
      (user) => user.email === 'agent@demo.test',
    )!;
    const internalMessageId = randomUUID();
    const internalAttachmentId = randomUUID();

    prismaMock.ticketMessageStore.push({
      authorId: staffUser.id,
      body: 'Staff-only attachment context.',
      createdAt: new Date('2026-04-21T11:05:00.000Z'),
      id: internalMessageId,
      isInternal: true,
      ticketId: ownTicket.id,
      updatedAt: new Date('2026-04-21T11:05:00.000Z'),
    });
    prismaMock.attachmentStore.push({
      createdAt: new Date('2026-04-21T11:10:00.000Z'),
      filename: 'internal.txt',
      id: internalAttachmentId,
      messageId: internalMessageId,
      mimeType: 'text/plain',
      sizeBytes: 16,
      storedKey: `tickets/${ownTicket.id}/attachments/internal.txt`,
      ticketId: ownTicket.id,
      uploadedById: staffUser.id,
    });

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    await agent
      .get(
        `/tickets/${ownTicket.id}/attachments/${internalAttachmentId}/download-url`,
      )
      .expect(403);
    expect(storageMock.getSignedUrl).not.toHaveBeenCalled();
  });

  it('allows staff to get a signed download URL for a visible internal-note attachment', async () => {
    const agent = request.agent(app.getHttpServer());
    const teamTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Team queue ticket',
    )!;
    const staffUser = prismaMock.userStore.find(
      (user) => user.email === 'agent@demo.test',
    )!;
    const internalMessageId = randomUUID();
    const internalAttachmentId = randomUUID();

    prismaMock.ticketMessageStore.push({
      authorId: staffUser.id,
      body: 'Staff-only diagnostics.',
      createdAt: new Date('2026-04-21T11:15:00.000Z'),
      id: internalMessageId,
      isInternal: true,
      ticketId: teamTicket.id,
      updatedAt: new Date('2026-04-21T11:15:00.000Z'),
    });
    prismaMock.attachmentStore.push({
      createdAt: new Date('2026-04-21T11:20:00.000Z'),
      filename: 'staff-diagnostics.txt',
      id: internalAttachmentId,
      messageId: internalMessageId,
      mimeType: 'text/plain',
      sizeBytes: 20,
      storedKey: `tickets/${teamTicket.id}/attachments/staff-diagnostics.txt`,
      ticketId: teamTicket.id,
      uploadedById: staffUser.id,
    });

    await agent
      .post('/auth/login')
      .send({
        email: 'agent@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    const response = await agent
      .get(
        `/tickets/${teamTicket.id}/attachments/${internalAttachmentId}/download-url`,
      )
      .expect(200);

    expect(response.body).toEqual({
      expiresInSeconds: 300,
      url: 'http://localhost:9000/customer-support/signed-download-url',
    });
    expect(storageMock.getSignedUrl).toHaveBeenCalledWith(
      `tickets/${teamTicket.id}/attachments/staff-diagnostics.txt`,
    );
  });

  it('returns 403 when a customer requests an unattached staff upload download URL', async () => {
    const agent = request.agent(app.getHttpServer());
    const ownTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Own ticket detail',
    )!;
    const staffUser = prismaMock.userStore.find(
      (user) => user.email === 'agent@demo.test',
    )!;
    const unattachedAttachmentId = randomUUID();

    prismaMock.attachmentStore.push({
      createdAt: new Date('2026-04-21T11:25:00.000Z'),
      filename: 'staff-upload.txt',
      id: unattachedAttachmentId,
      messageId: null,
      mimeType: 'text/plain',
      sizeBytes: 18,
      storedKey: `tickets/${ownTicket.id}/attachments/staff-upload.txt`,
      ticketId: ownTicket.id,
      uploadedById: staffUser.id,
    });

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    await agent
      .get(
        `/tickets/${ownTicket.id}/attachments/${unattachedAttachmentId}/download-url`,
      )
      .expect(403);
    expect(storageMock.getSignedUrl).not.toHaveBeenCalled();
  });

  it('denies a download URL when the attachment belongs to another ticket', async () => {
    const agent = request.agent(app.getHttpServer());
    const ownTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Own ticket detail',
    )!;
    const otherTicket = prismaMock.ticketStore.find(
      (ticket) => ticket.subject === 'Other customer ticket',
    )!;
    const otherCustomer = prismaMock.userStore.find(
      (user) => user.email === 'customer.two@demo.test',
    )!;
    const otherMessageId = randomUUID();
    const otherAttachmentId = randomUUID();

    prismaMock.ticketMessageStore.push({
      authorId: otherCustomer.id,
      body: 'Other customer public reply.',
      createdAt: new Date('2026-04-21T11:30:00.000Z'),
      id: otherMessageId,
      isInternal: false,
      ticketId: otherTicket.id,
      updatedAt: new Date('2026-04-21T11:30:00.000Z'),
    });
    prismaMock.attachmentStore.push({
      createdAt: new Date('2026-04-21T11:35:00.000Z'),
      filename: 'other.txt',
      id: otherAttachmentId,
      messageId: otherMessageId,
      mimeType: 'text/plain',
      sizeBytes: 10,
      storedKey: `tickets/${otherTicket.id}/attachments/other.txt`,
      ticketId: otherTicket.id,
      uploadedById: otherCustomer.id,
    });

    await agent
      .post('/auth/login')
      .send({
        email: 'customer@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    await agent
      .get(
        `/tickets/${ownTicket.id}/attachments/${otherAttachmentId}/download-url`,
      )
      .expect(404);

    await agent
      .get(
        `/tickets/${otherTicket.id}/attachments/${otherAttachmentId}/download-url`,
      )
      .expect(403);
    expect(storageMock.getSignedUrl).not.toHaveBeenCalled();
  });

  // BE-04 slice A — workflow REST endpoints

  it.each([
    { route: 'assign', body: { assigneeId: null } },
    { route: 'status', body: { status: TicketStatus.PENDING } },
    { route: 'priority', body: { priority: TicketPriority.HIGH } },
    { route: 'tags', body: { tagIds: [] } },
    { route: 'category', body: { categoryId: null } },
    { route: 'team', body: { teamId: '00000000-0000-4000-8000-000000000000' } },
  ])(
    'returns 403 when a customer tries to PATCH /tickets/:id/$route',
    async ({ route, body }) => {
      const ticket = prismaMock.ticketStore.find(
        (entry) => entry.subject === 'Own ticket detail',
      )!;
      const httpAgent = request.agent(app.getHttpServer());

      await httpAgent
        .post('/auth/login')
        .send({ email: 'customer@demo.test', password: 'Password1!' })
        .expect(200);

      await httpAgent
        .patch(`/tickets/${ticket.id}/${route}`)
        .send(body)
        .expect(403);

      expect(
        prismaMock.ticketEventStore.filter(
          (event) =>
            event.ticketId === ticket.id &&
            event.type !== TicketEventType.CREATED,
        ),
      ).toHaveLength(0);
    },
  );

  it('allows an agent to assign a team-member staff user and writes an ASSIGNED event', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Urgent team ticket',
    )!;
    const manager = prismaMock.userStore.find(
      (user) => user.email === 'manager@demo.test',
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'agent@demo.test', password: 'Password1!' })
      .expect(200);

    const response = await httpAgent
      .patch(`/tickets/${ticket.id}/assign`)
      .send({ assigneeId: manager.id })
      .expect(200);

    expect(response.body.assignee).toMatchObject({ id: manager.id });
    expect(
      prismaMock.ticketEventStore.find(
        (event) =>
          event.ticketId === ticket.id &&
          event.type === TicketEventType.ASSIGNED,
      ),
    ).toBeDefined();
  });

  it('allows a manager to assign a team-member staff user on a team-owned ticket', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Team queue ticket',
    )!;
    const agent = prismaMock.userStore.find(
      (user) => user.email === 'agent@demo.test',
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'manager@demo.test', password: 'Password1!' })
      .expect(200);

    const response = await httpAgent
      .patch(`/tickets/${ticket.id}/assign`)
      .send({ assigneeId: agent.id })
      .expect(200);

    expect(response.body.assignee).toMatchObject({ id: agent.id });
  });

  it('allows an admin to assign a staff user across teams', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Urgent team ticket',
    )!;
    const billingAgent = prismaMock.userStore.find(
      (user) => user.email === 'agent.billing@demo.test',
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'admin@demo.test', password: 'Password1!' })
      .expect(200);

    const response = await httpAgent
      .patch(`/tickets/${ticket.id}/assign`)
      .send({ assigneeId: billingAgent.id })
      .expect(200);

    expect(response.body.assignee).toMatchObject({ id: billingAgent.id });
  });

  it('rejects assigning a customer as the assignee with 400', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Urgent team ticket',
    )!;
    const customer = prismaMock.userStore.find(
      (user) => user.email === 'customer@demo.test',
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'agent@demo.test', password: 'Password1!' })
      .expect(200);

    await httpAgent
      .patch(`/tickets/${ticket.id}/assign`)
      .send({ assigneeId: customer.id })
      .expect(400);
  });

  it('rejects an agent assigning a staff user who is not on the ticket team with 400', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Urgent team ticket',
    )!;
    const billingAgent = prismaMock.userStore.find(
      (user) => user.email === 'agent.billing@demo.test',
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'agent@demo.test', password: 'Password1!' })
      .expect(200);

    await httpAgent
      .patch(`/tickets/${ticket.id}/assign`)
      .send({ assigneeId: billingAgent.id })
      .expect(400);
  });

  it('unassigns a ticket and writes a REASSIGNED event when assigneeId is null', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Assigned ticket',
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'admin@demo.test', password: 'Password1!' })
      .expect(200);

    const response = await httpAgent
      .patch(`/tickets/${ticket.id}/assign`)
      .send({ assigneeId: null })
      .expect(200);

    expect(response.body.assignee).toBeNull();
    expect(
      prismaMock.ticketEventStore.find(
        (event) =>
          event.ticketId === ticket.id &&
          event.type === TicketEventType.REASSIGNED,
      ),
    ).toBeDefined();
  });

  it.each([
    { from: TicketStatus.OPEN, to: TicketStatus.PENDING },
    { from: TicketStatus.OPEN, to: TicketStatus.RESOLVED },
    { from: TicketStatus.OPEN, to: TicketStatus.CLOSED },
    { from: TicketStatus.PENDING, to: TicketStatus.OPEN },
    { from: TicketStatus.PENDING, to: TicketStatus.RESOLVED },
    { from: TicketStatus.PENDING, to: TicketStatus.CLOSED },
    { from: TicketStatus.RESOLVED, to: TicketStatus.OPEN },
    { from: TicketStatus.RESOLVED, to: TicketStatus.CLOSED },
    { from: TicketStatus.CLOSED, to: TicketStatus.OPEN },
  ])(
    'allows staff to transition status from $from to $to and emits STATUS_CHANGED',
    async ({ from, to }) => {
      const ticket = prismaMock.ticketStore.find(
        (entry) => entry.subject === 'Urgent team ticket',
      )!;
      ticket.status = from;
      const httpAgent = request.agent(app.getHttpServer());

      await httpAgent
        .post('/auth/login')
        .send({ email: 'agent@demo.test', password: 'Password1!' })
        .expect(200);

      const response = await httpAgent
        .patch(`/tickets/${ticket.id}/status`)
        .send({ status: to })
        .expect(200);

      expect(response.body.status).toBe(to);
      const event = prismaMock.ticketEventStore.find(
        (entry) =>
          entry.ticketId === ticket.id &&
          entry.type === TicketEventType.STATUS_CHANGED,
      );
      expect(event).toBeDefined();
      expect(event!.metadata).toMatchObject({ fromStatus: from, toStatus: to });
    },
  );

  it.each([
    { from: TicketStatus.RESOLVED, to: TicketStatus.PENDING },
    { from: TicketStatus.CLOSED, to: TicketStatus.PENDING },
    { from: TicketStatus.CLOSED, to: TicketStatus.RESOLVED },
  ])(
    'returns 400 for the disallowed staff transition $from to $to',
    async ({ from, to }) => {
      const ticket = prismaMock.ticketStore.find(
        (entry) => entry.subject === 'Urgent team ticket',
      )!;
      ticket.status = from;
      const httpAgent = request.agent(app.getHttpServer());

      await httpAgent
        .post('/auth/login')
        .send({ email: 'agent@demo.test', password: 'Password1!' })
        .expect(200);

      await httpAgent
        .patch(`/tickets/${ticket.id}/status`)
        .send({ status: to })
        .expect(400);

      expect(
        prismaMock.ticketEventStore.find(
          (entry) =>
            entry.ticketId === ticket.id &&
            entry.type === TicketEventType.STATUS_CHANGED,
        ),
      ).toBeUndefined();
    },
  );

  it('updates ticket priority and emits PRIORITY_CHANGED with from/to metadata', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Urgent team ticket',
    )!;
    const fromPriority = ticket.priority;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'agent@demo.test', password: 'Password1!' })
      .expect(200);

    const response = await httpAgent
      .patch(`/tickets/${ticket.id}/priority`)
      .send({ priority: TicketPriority.LOW })
      .expect(200);

    expect(response.body.priority).toBe(TicketPriority.LOW);
    const event = prismaMock.ticketEventStore.find(
      (entry) =>
        entry.ticketId === ticket.id &&
        entry.type === TicketEventType.PRIORITY_CHANGED,
    );
    expect(event).toBeDefined();
    expect(event!.metadata).toMatchObject({
      fromPriority,
      toPriority: TicketPriority.LOW,
    });
  });

  it('replaces ticket tags as a full set and emits TAGGED with added and removed', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Urgent team ticket',
    )!;
    const urgentTag = prismaMock.tagStore.find((tag) => tag.name === 'urgent')!;
    const regressionTag = prismaMock.tagStore.find(
      (tag) => tag.name === 'regression',
    )!;
    prismaMock.ticketTagStore.push({
      tagId: urgentTag.id,
      ticketId: ticket.id,
    });
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'agent@demo.test', password: 'Password1!' })
      .expect(200);

    const response = await httpAgent
      .patch(`/tickets/${ticket.id}/tags`)
      .send({ tagIds: [regressionTag.id] })
      .expect(200);

    expect(response.body.tags.map((tag: { id: string }) => tag.id)).toEqual([
      regressionTag.id,
    ]);
    const event = prismaMock.ticketEventStore.find(
      (entry) =>
        entry.ticketId === ticket.id && entry.type === TicketEventType.TAGGED,
    );
    expect(event).toBeDefined();
    expect(event!.metadata).toMatchObject({
      added: [regressionTag.id],
      removed: [urgentTag.id],
    });
  });

  it('returns 400 when PATCH /tickets/:id/tags references an unknown tag ID', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Urgent team ticket',
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'agent@demo.test', password: 'Password1!' })
      .expect(200);

    await httpAgent
      .patch(`/tickets/${ticket.id}/tags`)
      .send({ tagIds: ['00000000-0000-4000-8000-000000000000'] })
      .expect(400);

    expect(
      prismaMock.ticketEventStore.find(
        (entry) =>
          entry.ticketId === ticket.id && entry.type === TicketEventType.TAGGED,
      ),
    ).toBeUndefined();
  });

  it('updates the ticket category, leaves teamId untouched, and emits CATEGORIZED', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Urgent team ticket',
    )!;
    const fromCategoryId = ticket.categoryId;
    const fromTeamId = ticket.teamId;
    const billingCategory = prismaMock.categoryStore.find(
      (category) => category.name === 'Billing',
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'agent@demo.test', password: 'Password1!' })
      .expect(200);

    const response = await httpAgent
      .patch(`/tickets/${ticket.id}/category`)
      .send({ categoryId: billingCategory.id })
      .expect(200);

    expect(response.body.category).toMatchObject({ id: billingCategory.id });
    expect(response.body.team?.id ?? null).toBe(fromTeamId);
    expect(ticket.teamId).toBe(fromTeamId);
    const event = prismaMock.ticketEventStore.find(
      (entry) =>
        entry.ticketId === ticket.id &&
        entry.type === TicketEventType.CATEGORIZED,
    );
    expect(event).toBeDefined();
    expect(event!.metadata).toMatchObject({
      fromCategoryId,
      toCategoryId: billingCategory.id,
    });
  });

  it('clears the ticket category when PATCH /tickets/:id/category receives null', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Urgent team ticket',
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'agent@demo.test', password: 'Password1!' })
      .expect(200);

    const response = await httpAgent
      .patch(`/tickets/${ticket.id}/category`)
      .send({ categoryId: null })
      .expect(200);

    expect(response.body.category).toBeNull();
  });

  it('allows a manager who belongs to the destination team to transfer the ticket', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Urgent team ticket',
    )!;
    const billingTeam = prismaMock.teamStore.find(
      (team) => team.name === 'Billing',
    )!;
    prismaMock.teamMemberStore.push({
      createdAt: new Date('2026-04-20T10:00:00.000Z'),
      id: randomUUID(),
      teamId: billingTeam.id,
      userId: prismaMock.userStore.find(
        (user) => user.email === 'manager@demo.test',
      )!.id,
    });
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'manager@demo.test', password: 'Password1!' })
      .expect(200);

    const response = await httpAgent
      .patch(`/tickets/${ticket.id}/team`)
      .send({ teamId: billingTeam.id })
      .expect(200);

    expect(response.body.team).toMatchObject({ id: billingTeam.id });
    expect(
      prismaMock.ticketEventStore.find(
        (entry) =>
          entry.ticketId === ticket.id &&
          entry.type === TicketEventType.TEAM_TRANSFERRED,
      ),
    ).toBeDefined();
  });

  it('allows an admin to transfer a ticket across teams', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Urgent team ticket',
    )!;
    const billingTeam = prismaMock.teamStore.find(
      (team) => team.name === 'Billing',
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'admin@demo.test', password: 'Password1!' })
      .expect(200);

    const response = await httpAgent
      .patch(`/tickets/${ticket.id}/team`)
      .send({ teamId: billingTeam.id })
      .expect(200);

    expect(response.body.team).toMatchObject({ id: billingTeam.id });
  });

  it('atomically clears an invalid assignee when transferring teams and emits both events', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Assigned ticket',
    )!;
    const fromAssigneeId = ticket.assigneeId;
    const billingTeam = prismaMock.teamStore.find(
      (team) => team.name === 'Billing',
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'admin@demo.test', password: 'Password1!' })
      .expect(200);

    const response = await httpAgent
      .patch(`/tickets/${ticket.id}/team`)
      .send({ teamId: billingTeam.id })
      .expect(200);

    expect(response.body.assignee).toBeNull();
    expect(ticket.assigneeId).toBeNull();
    const events = prismaMock.ticketEventStore.filter(
      (entry) => entry.ticketId === ticket.id,
    );
    const transferEvent = events.find(
      (entry) => entry.type === TicketEventType.TEAM_TRANSFERRED,
    );
    const reassignedEvent = events.find(
      (entry) => entry.type === TicketEventType.REASSIGNED,
    );
    expect(transferEvent).toBeDefined();
    expect(reassignedEvent).toBeDefined();
    expect(reassignedEvent!.metadata).toMatchObject({
      fromAssigneeId,
      toAssigneeId: null,
    });
  });

  it('returns 403 when an agent tries to transfer a ticket team', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Urgent team ticket',
    )!;
    const billingTeam = prismaMock.teamStore.find(
      (team) => team.name === 'Billing',
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'agent@demo.test', password: 'Password1!' })
      .expect(200);

    await httpAgent
      .patch(`/tickets/${ticket.id}/team`)
      .send({ teamId: billingTeam.id })
      .expect(403);
  });

  it('returns 403 when a manager tries to transfer to a team they do not belong to', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Urgent team ticket',
    )!;
    const billingTeam = prismaMock.teamStore.find(
      (team) => team.name === 'Billing',
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'manager@demo.test', password: 'Password1!' })
      .expect(200);

    await httpAgent
      .patch(`/tickets/${ticket.id}/team`)
      .send({ teamId: billingTeam.id })
      .expect(403);
  });

  it('returns the existing tag list from GET /tickets/tags ordered by name', async () => {
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'agent@demo.test', password: 'Password1!' })
      .expect(200);

    const response = await httpAgent.get('/tickets/tags').expect(200);

    const names = (response.body as Array<{ name: string }>).map(
      (tag) => tag.name,
    );
    expect(names).toEqual(['regression', 'urgent']);
  });

  it('returns team-scoped assignable users for an agent on a team ticket', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Urgent team ticket',
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'agent@demo.test', password: 'Password1!' })
      .expect(200);

    const response = await httpAgent
      .get(`/tickets/${ticket.id}/assignable-users`)
      .expect(200);

    const emails = (response.body as Array<{ email: string }>).map(
      (user) => user.email,
    );
    expect(emails).toContain('agent@demo.test');
    expect(emails).toContain('manager@demo.test');
    expect(emails).not.toContain('agent.billing@demo.test');
    expect(emails).not.toContain('manager.billing@demo.test');
    expect(emails).not.toContain('admin@demo.test');
    expect(emails).not.toContain('customer@demo.test');
  });

  it('returns cross-team assignable users for an admin', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Urgent team ticket',
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'admin@demo.test', password: 'Password1!' })
      .expect(200);

    const response = await httpAgent
      .get(`/tickets/${ticket.id}/assignable-users`)
      .expect(200);

    const emails = (response.body as Array<{ email: string }>).map(
      (user) => user.email,
    );
    expect(emails).toEqual(
      expect.arrayContaining([
        'agent@demo.test',
        'manager@demo.test',
        'admin@demo.test',
        'agent.billing@demo.test',
        'manager.billing@demo.test',
      ]),
    );
    expect(emails).not.toContain('customer@demo.test');
  });

  it('returns 403 when a customer requests assignable users', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Own ticket detail',
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'customer@demo.test', password: 'Password1!' })
      .expect(200);

    await httpAgent.get(`/tickets/${ticket.id}/assignable-users`).expect(403);
  });

  // BE-04 slice C — notification producers

  it('enqueues TICKET_REPLIED for requester and assignee, excluding a staff author', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Assigned ticket',
    )!;
    const requester = prismaMock.userStore.find(
      (user) => user.id === ticket.requesterId,
    )!;
    const assignee = prismaMock.userStore.find(
      (user) => user.id === ticket.assigneeId!,
    )!;
    ticket.status = TicketStatus.OPEN;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'agent@demo.test', password: 'Password1!' })
      .expect(200);

    await httpAgent
      .post(`/tickets/${ticket.id}/replies`)
      .send({ body: 'Working on it.' })
      .expect(201);

    expect(queueMock.enqueueNotification).toHaveBeenCalledTimes(1);
    const [payload, jobId] = queueMock.enqueueNotification.mock.calls[0]!;
    expect(payload).toMatchObject({
      type: NotificationType.TICKET_REPLIED,
      ticketId: ticket.id,
    });
    expect(payload.recipientUserIds).toEqual(
      expect.arrayContaining([requester.id]),
    );
    expect(payload.recipientUserIds).not.toContain(assignee.id);
    expect(typeof jobId).toBe('string');
  });

  it('does not enqueue the customer author when a customer replies to their own ticket', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Own ticket detail',
    )!;
    const customer = prismaMock.userStore.find(
      (user) => user.email === 'customer@demo.test',
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'customer@demo.test', password: 'Password1!' })
      .expect(200);

    await httpAgent
      .post(`/tickets/${ticket.id}/replies`)
      .send({ body: 'Any update?' })
      .expect(201);

    if (queueMock.enqueueNotification.mock.calls.length > 0) {
      const [payload] = queueMock.enqueueNotification.mock.calls[0]!;
      expect(payload.recipientUserIds).not.toContain(customer.id);
    }
  });

  it('enqueues NOTE_ADDED for assignee plus team members excluding customers and the author', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Assigned ticket',
    )!;
    const agent = prismaMock.userStore.find(
      (user) => user.email === 'agent@demo.test',
    )!;
    const manager = prismaMock.userStore.find(
      (user) => user.email === 'manager@demo.test',
    )!;
    const requester = prismaMock.userStore.find(
      (user) => user.id === ticket.requesterId,
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'agent@demo.test', password: 'Password1!' })
      .expect(200);

    await httpAgent
      .post(`/tickets/${ticket.id}/internal-notes`)
      .send({ body: 'Private context for the team.' })
      .expect(201);

    expect(queueMock.enqueueNotification).toHaveBeenCalledTimes(1);
    const [payload] = queueMock.enqueueNotification.mock.calls[0]!;
    expect(payload.type).toBe(NotificationType.NOTE_ADDED);
    expect(payload.recipientUserIds).toEqual(
      expect.arrayContaining([manager.id]),
    );
    expect(payload.recipientUserIds).not.toContain(agent.id);
    expect(payload.recipientUserIds).not.toContain(requester.id);
  });

  it('never enqueues a customer recipient for an internal note even with weird team membership', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Team queue ticket',
    )!;
    const technicalTeam = prismaMock.teamStore.find(
      (team) => team.name === 'Technical Support',
    )!;
    const customer = prismaMock.userStore.find(
      (user) => user.email === 'customer@demo.test',
    )!;
    prismaMock.teamMemberStore.push({
      createdAt: new Date('2026-04-20T10:00:00.000Z'),
      id: randomUUID(),
      teamId: technicalTeam.id,
      userId: customer.id,
    });
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'agent@demo.test', password: 'Password1!' })
      .expect(200);

    await httpAgent
      .post(`/tickets/${ticket.id}/internal-notes`)
      .send({ body: 'Sensitive staff note.' })
      .expect(201);

    if (queueMock.enqueueNotification.mock.calls.length > 0) {
      const [payload] = queueMock.enqueueNotification.mock.calls[0]!;
      expect(payload.recipientUserIds).not.toContain(customer.id);
    }
  });

  it('enqueues TICKET_ASSIGNED for the new assignee on assignment', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Urgent team ticket',
    )!;
    const manager = prismaMock.userStore.find(
      (user) => user.email === 'manager@demo.test',
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'agent@demo.test', password: 'Password1!' })
      .expect(200);

    await httpAgent
      .patch(`/tickets/${ticket.id}/assign`)
      .send({ assigneeId: manager.id })
      .expect(200);

    expect(queueMock.enqueueNotification).toHaveBeenCalledTimes(1);
    const [payload, jobId] = queueMock.enqueueNotification.mock.calls[0]!;
    expect(payload.type).toBe(NotificationType.TICKET_ASSIGNED);
    expect(payload.recipientUserIds).toEqual([manager.id]);
    expect(typeof jobId).toBe('string');
  });

  it('does not enqueue TICKET_ASSIGNED when unassigning a ticket', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Assigned ticket',
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'admin@demo.test', password: 'Password1!' })
      .expect(200);

    await httpAgent
      .patch(`/tickets/${ticket.id}/assign`)
      .send({ assigneeId: null })
      .expect(200);

    expect(queueMock.enqueueNotification).not.toHaveBeenCalled();
  });

  it('enqueues STATUS_CHANGED for requester and assignee excluding the staff actor', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Assigned ticket',
    )!;
    ticket.status = TicketStatus.OPEN;
    const requester = prismaMock.userStore.find(
      (user) => user.id === ticket.requesterId,
    )!;
    const assignee = prismaMock.userStore.find(
      (user) => user.id === ticket.assigneeId!,
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'agent@demo.test', password: 'Password1!' })
      .expect(200);

    await httpAgent
      .patch(`/tickets/${ticket.id}/status`)
      .send({ status: TicketStatus.RESOLVED })
      .expect(200);

    expect(queueMock.enqueueNotification).toHaveBeenCalledTimes(1);
    const [payload] = queueMock.enqueueNotification.mock.calls[0]!;
    expect(payload.type).toBe(NotificationType.STATUS_CHANGED);
    expect(payload.recipientUserIds).toEqual(
      expect.arrayContaining([requester.id]),
    );
    expect(payload.recipientUserIds).not.toContain(assignee.id);
  });

  it.each([
    {
      label: 'priority',
      route: 'priority',
      body: { priority: TicketPriority.LOW },
    },
    {
      label: 'category null',
      route: 'category',
      body: { categoryId: null },
    },
    {
      label: 'tags empty',
      route: 'tags',
      body: { tagIds: [] },
    },
  ])(
    'does not enqueue any notification when staff changes ticket $label',
    async ({ route, body }) => {
      const ticket = prismaMock.ticketStore.find(
        (entry) => entry.subject === 'Urgent team ticket',
      )!;
      const httpAgent = request.agent(app.getHttpServer());

      await httpAgent
        .post('/auth/login')
        .send({ email: 'agent@demo.test', password: 'Password1!' })
        .expect(200);

      await httpAgent
        .patch(`/tickets/${ticket.id}/${route}`)
        .send(body)
        .expect(200);

      expect(queueMock.enqueueNotification).not.toHaveBeenCalled();
    },
  );

  it('does not enqueue any notification when a manager transfers the ticket team', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Urgent team ticket',
    )!;
    const billingTeam = prismaMock.teamStore.find(
      (team) => team.name === 'Billing',
    )!;
    prismaMock.teamMemberStore.push({
      createdAt: new Date('2026-04-20T10:00:00.000Z'),
      id: randomUUID(),
      teamId: billingTeam.id,
      userId: prismaMock.userStore.find(
        (user) => user.email === 'manager@demo.test',
      )!.id,
    });
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'manager@demo.test', password: 'Password1!' })
      .expect(200);

    await httpAgent
      .patch(`/tickets/${ticket.id}/team`)
      .send({ teamId: billingTeam.id })
      .expect(200);

    expect(queueMock.enqueueNotification).not.toHaveBeenCalled();
  });

  it('still returns 200 and persists the TicketEvent when QueueService.enqueueNotification rejects', async () => {
    queueMock.enqueueNotification.mockRejectedValueOnce(
      new Error('Queue unavailable'),
    );
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Urgent team ticket',
    )!;
    const manager = prismaMock.userStore.find(
      (user) => user.email === 'manager@demo.test',
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'agent@demo.test', password: 'Password1!' })
      .expect(200);

    await httpAgent
      .patch(`/tickets/${ticket.id}/assign`)
      .send({ assigneeId: manager.id })
      .expect(200);

    expect(
      prismaMock.ticketEventStore.find(
        (event) =>
          event.ticketId === ticket.id &&
          event.type === TicketEventType.ASSIGNED,
      ),
    ).toBeDefined();
  });

  // BE-04 slice D — realtime emit producers

  it('emits ticket.message.created.public after a public reply commits', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Urgent team ticket',
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'agent@demo.test', password: 'Password1!' })
      .expect(200);

    await httpAgent
      .post(`/tickets/${ticket.id}/replies`)
      .send({ body: 'Public update.' })
      .expect(201);

    expect(realtimeMock.emitTicketMessageCreatedPublic).toHaveBeenCalledTimes(
      1,
    );
    expect(
      realtimeMock.emitTicketMessageCreatedInternal,
    ).not.toHaveBeenCalled();
    const [ticketId, payload] =
      realtimeMock.emitTicketMessageCreatedPublic.mock.calls[0]!;
    expect(ticketId).toBe(ticket.id);
    expect(payload).toMatchObject({ isInternal: false, ticketId: ticket.id });
  });

  it('emits ticket.message.created.internal only after an internal note', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Team queue ticket',
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'agent@demo.test', password: 'Password1!' })
      .expect(200);

    await httpAgent
      .post(`/tickets/${ticket.id}/internal-notes`)
      .send({ body: 'Staff-only context.' })
      .expect(201);

    expect(realtimeMock.emitTicketMessageCreatedInternal).toHaveBeenCalledTimes(
      1,
    );
    expect(realtimeMock.emitTicketMessageCreatedPublic).not.toHaveBeenCalled();
    const [ticketId, payload] =
      realtimeMock.emitTicketMessageCreatedInternal.mock.calls[0]!;
    expect(ticketId).toBe(ticket.id);
    expect(payload).toMatchObject({ isInternal: true, ticketId: ticket.id });
  });

  it('emits ticket.updated with a shallow projection after a workflow PATCH', async () => {
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Urgent team ticket',
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'agent@demo.test', password: 'Password1!' })
      .expect(200);

    await httpAgent
      .patch(`/tickets/${ticket.id}/status`)
      .send({ status: TicketStatus.RESOLVED })
      .expect(200);

    expect(realtimeMock.emitTicketUpdated).toHaveBeenCalledTimes(1);
    const [emittedTicketId, payload] =
      realtimeMock.emitTicketUpdated.mock.calls[0]!;
    expect(emittedTicketId).toBe(ticket.id);
    expect(payload).toMatchObject({
      id: ticket.id,
      status: TicketStatus.RESOLVED,
    });
    expect(payload).toHaveProperty('tagIds');
    expect(payload).toHaveProperty('updatedAt');
  });

  it('still returns 200 when RealtimeService.emitTicketUpdated throws', async () => {
    realtimeMock.emitTicketUpdated.mockImplementationOnce(() => {
      throw new Error('Realtime unavailable');
    });
    const ticket = prismaMock.ticketStore.find(
      (entry) => entry.subject === 'Urgent team ticket',
    )!;
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'agent@demo.test', password: 'Password1!' })
      .expect(200);

    await httpAgent
      .patch(`/tickets/${ticket.id}/priority`)
      .send({ priority: TicketPriority.LOW })
      .expect(200);

    expect(
      prismaMock.ticketEventStore.find(
        (event) =>
          event.ticketId === ticket.id &&
          event.type === TicketEventType.PRIORITY_CHANGED,
      ),
    ).toBeDefined();
  });

  // BE-04 team options endpoint

  it('requires authentication for GET /tickets/teams', async () => {
    await request(app.getHttpServer()).get('/tickets/teams').expect(401);
  });

  it('returns the existing teams from GET /tickets/teams with id, name, and description', async () => {
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'agent@demo.test', password: 'Password1!' })
      .expect(200);

    const response = await httpAgent.get('/tickets/teams').expect(200);

    const teams = response.body as Array<{
      description: string | null;
      id: string;
      name: string;
    }>;
    expect(teams.length).toBeGreaterThanOrEqual(2);
    const technicalSupport = teams.find(
      (team) => team.name === 'Technical Support',
    );
    expect(technicalSupport).toMatchObject({
      description: 'Primary queue for technical incidents.',
    });
    expect(technicalSupport!.id).toEqual(expect.any(String));
    expect(teams.every((team) => 'id' in team && 'description' in team)).toBe(
      true,
    );
  });

  it('sorts GET /tickets/teams alphabetically by name', async () => {
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'agent@demo.test', password: 'Password1!' })
      .expect(200);

    const response = await httpAgent.get('/tickets/teams').expect(200);

    const names = (response.body as Array<{ name: string }>).map(
      (team) => team.name,
    );
    expect(names).toEqual(['Billing', 'Technical Support']);
  });

  it('routes GET /tickets/teams to the static team handler, not the :id detail handler', async () => {
    const httpAgent = request.agent(app.getHttpServer());

    await httpAgent
      .post('/auth/login')
      .send({ email: 'admin@demo.test', password: 'Password1!' })
      .expect(200);

    const response = await httpAgent.get('/tickets/teams').expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    const body = response.body as unknown[];
    expect(body.length).toBeGreaterThan(0);
    const first = body[0] as { description?: unknown; subject?: unknown };
    expect(first).toHaveProperty('description');
    expect(first).not.toHaveProperty('subject');
  });
});
