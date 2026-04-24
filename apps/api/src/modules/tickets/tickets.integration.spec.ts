import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
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
        actorId: string | null;
        metadata?: Prisma.JsonValue;
        type: TicketEventType;
      };
    };
    status?: TicketStatus;
    subject?: string;
  };
} & TicketIncludeArgs;

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
  let nextTicketNumber = 1000;

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

  const ticketModel = {
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
          teamId: null,
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
    findMany: vi.fn(async ({ where }: FindManyArgs) =>
      tickets
        .filter((ticket) => ticketMatchesWhere(ticket, where))
        .map((ticket) => attachTicketRelations(ticket)),
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

      ticket.updatedAt = now;

      if (data.events?.create) {
        ticketEvents.push({
          actorId: data.events.create.actorId,
          createdAt: now,
          id: randomUUID(),
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

  return {
    categoryStore: categories,
    roleStore: roles,
    tagStore: tags,
    teamMemberStore: teamMembers,
    teamStore: teams,
    ticketEventStore: ticketEvents,
    ticketStore: tickets,
    ticketTagStore: ticketTags,
    userStore: users,
    category: categoryModel,
    ticket: ticketModel,
    user: userModel,
  };
};

describe('Tickets integration', () => {
  let app: INestApplication;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    process.env.API_HOST = '127.0.0.1';
    process.env.API_PORT = '4100';
    process.env.AUTH_COOKIE_NAME = 'access_token';
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@localhost:5432/customer_support?schema=public';
    process.env.JWT_ACCESS_TOKEN_TTL_SECONDS = '3600';
    process.env.JWT_SECRET = 'test-ticket-secret';
    process.env.NODE_ENV = 'test';
    process.env.SWAGGER_PATH = 'api';
    process.env.WEB_APP_ORIGIN = 'http://localhost:3000';

    prismaMock = createPrismaMock();

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

    const urgentTag: StoredTag = {
      color: '#dc2626',
      id: randomUUID(),
      name: 'urgent',
    };
    prismaMock.tagStore.push(urgentTag);

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
      team: null,
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

    expect(response.body).toEqual([
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
});
