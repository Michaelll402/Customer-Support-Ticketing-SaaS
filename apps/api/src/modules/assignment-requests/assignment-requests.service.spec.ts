import { randomUUID } from 'node:crypto';

import {
  AssignmentRequestStatus,
  AssignmentRequestType,
  NotificationType,
  RoleName,
  TicketEventType,
  TicketStatus,
} from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service';
import type { PrismaService } from '../../common/database/prisma.service';
import type { QueueService } from '../queue/queue.service';
import type { RealtimeService } from '../realtime/realtime.service';
import { AssignmentRequestsService } from './assignment-requests.service';

interface StoredUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  role: { name: RoleName };
}

interface StoredTicket {
  id: string;
  number: number;
  subject: string;
  status: TicketStatus;
  teamId: string | null;
  assigneeId: string | null;
  deletedAt: Date | null;
}

interface StoredMembership {
  userId: string;
  teamId: string;
}

interface StoredRequest {
  id: string;
  ticketId: string;
  requestedById: string;
  requestedAssigneeId: string | null;
  type: AssignmentRequestType;
  reason: string;
  status: AssignmentRequestStatus;
  reviewedById: string | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const createWorld = () => {
  const users: StoredUser[] = [];
  const tickets: StoredTicket[] = [];
  const memberships: StoredMembership[] = [];
  const requests: StoredRequest[] = [];
  const ticketEvents: Array<{ ticketId: string; type: TicketEventType }> = [];

  const summary = (user: StoredUser | undefined | null) =>
    user
      ? {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        }
      : null;

  const attach = (request: StoredRequest) => {
    const ticket = tickets.find((entry) => entry.id === request.ticketId)!;
    return {
      ...request,
      requestedBy: summary(users.find((u) => u.id === request.requestedById)),
      requestedAssignee: summary(
        users.find((u) => u.id === request.requestedAssigneeId),
      ),
      reviewedBy: summary(users.find((u) => u.id === request.reviewedById)),
      ticket: {
        id: ticket.id,
        number: ticket.number,
        subject: ticket.subject,
        status: ticket.status,
        teamId: ticket.teamId,
        assigneeId: ticket.assigneeId,
        deletedAt: ticket.deletedAt,
        assignee: summary(users.find((u) => u.id === ticket.assigneeId)),
      },
    };
  };

  type RequestWhere = {
    id?: string;
    ticketId?: string;
    requestedById?: string;
    status?: AssignmentRequestStatus;
    ticket?: {
      deletedAt?: Date | null;
      team?: { members?: { some?: { userId?: string } } };
    };
  };

  const matches = (request: StoredRequest, where: RequestWhere): boolean => {
    if (where.id && request.id !== where.id) return false;
    if (where.ticketId && request.ticketId !== where.ticketId) return false;
    if (where.requestedById && request.requestedById !== where.requestedById) {
      return false;
    }
    if (where.status && request.status !== where.status) return false;
    if (where.ticket) {
      const ticket = tickets.find((entry) => entry.id === request.ticketId);
      if (!ticket) return false;
      if (where.ticket.deletedAt === null && ticket.deletedAt !== null) {
        return false;
      }
      const memberUserId = where.ticket.team?.members?.some?.userId;
      if (memberUserId) {
        if (!ticket.teamId) return false;
        const isMember = memberships.some(
          (m) => m.teamId === ticket.teamId && m.userId === memberUserId,
        );
        if (!isMember) return false;
      }
    }
    return true;
  };

  const prisma = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const user = users.find((entry) => entry.id === where.id);
        return user ? { ...user } : null;
      }),
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: {
            isActive?: boolean;
            role?: { name?: RoleName };
            teamMemberships?: { some?: { teamId?: string } };
          };
        }) => {
          const teamId = where.teamMemberships?.some?.teamId;
          return users
            .filter((user) => {
              if (
                where.isActive !== undefined &&
                user.isActive !== where.isActive
              ) {
                return false;
              }
              if (where.role?.name && user.role.name !== where.role.name) {
                return false;
              }
              if (
                teamId &&
                !memberships.some(
                  (m) => m.teamId === teamId && m.userId === user.id,
                )
              ) {
                return false;
              }
              return true;
            })
            .map((user) => ({ id: user.id }));
        },
      ),
    },
    teamMember: {
      findFirst: vi.fn(
        async ({ where }: { where: { userId: string; teamId: string } }) =>
          memberships.find(
            (m) => m.userId === where.userId && m.teamId === where.teamId,
          ) ?? null,
      ),
    },
    ticket: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const ticket = tickets.find((entry) => entry.id === where.id);
        return ticket ? { ...ticket, tags: [] } : null;
      }),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: {
            assigneeId?: string | null;
            events?: { create: { type: TicketEventType } };
          };
        }) => {
          const ticket = tickets.find((entry) => entry.id === where.id)!;
          if (data.assigneeId !== undefined) {
            ticket.assigneeId = data.assigneeId;
          }
          if (data.events?.create) {
            ticketEvents.push({
              ticketId: ticket.id,
              type: data.events.create.type,
            });
          }
          return { ...ticket };
        },
      ),
    },
    assignmentRequest: {
      findFirst: vi.fn(async ({ where }: { where: RequestWhere }) => {
        const found = requests.find((request) => matches(request, where));
        return found ? attach(found) : null;
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const found = requests.find((request) => request.id === where.id);
        return found ? attach(found) : null;
      }),
      findMany: vi.fn(
        async ({
          where,
          orderBy,
        }: {
          where: RequestWhere;
          orderBy?: { createdAt?: 'asc' | 'desc' };
        }) => {
          const filtered = requests
            .filter((request) => matches(request, where))
            .sort((left, right) =>
              orderBy?.createdAt === 'desc'
                ? right.createdAt.getTime() - left.createdAt.getTime()
                : left.createdAt.getTime() - right.createdAt.getTime(),
            );
          return filtered.map((request) => attach(request));
        },
      ),
      create: vi.fn(
        async ({
          data,
        }: {
          data: {
            ticketId: string;
            requestedById: string;
            requestedAssigneeId: string | null;
            type: AssignmentRequestType;
            reason: string;
          };
        }) => {
          const now = new Date();
          const request: StoredRequest = {
            id: randomUUID(),
            ticketId: data.ticketId,
            requestedById: data.requestedById,
            requestedAssigneeId: data.requestedAssigneeId,
            type: data.type,
            reason: data.reason,
            status: AssignmentRequestStatus.PENDING,
            reviewedById: null,
            reviewNote: null,
            reviewedAt: null,
            createdAt: now,
            updatedAt: now,
          };
          requests.push(request);
          return attach(request);
        },
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: {
            status?: AssignmentRequestStatus;
            reviewedById?: string | null;
            reviewedAt?: Date | null;
            reviewNote?: string | null;
          };
        }) => {
          const request = requests.find((entry) => entry.id === where.id)!;
          if (data.status !== undefined) request.status = data.status;
          if (data.reviewedById !== undefined) {
            request.reviewedById = data.reviewedById;
          }
          if (data.reviewedAt !== undefined)
            request.reviewedAt = data.reviewedAt;
          if (data.reviewNote !== undefined)
            request.reviewNote = data.reviewNote;
          request.updatedAt = new Date();
          return attach(request);
        },
      ),
    },
    $transaction: vi.fn(
      async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> =>
        callback(prisma),
    ),
  };

  const queue = { enqueueNotification: vi.fn().mockResolvedValue(undefined) };
  const realtime = { emitTicketUpdated: vi.fn() };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };

  const service = new AssignmentRequestsService(
    prisma as unknown as PrismaService,
    queue as unknown as QueueService,
    realtime as unknown as RealtimeService,
    audit as unknown as AuditService,
  );

  const addUser = (role: RoleName, overrides: Partial<StoredUser> = {}) => {
    const id = overrides.id ?? randomUUID();
    const user: StoredUser = {
      id,
      firstName: overrides.firstName ?? 'First',
      lastName: overrides.lastName ?? 'Last',
      email: overrides.email ?? `${id}@demo.test`,
      isActive: overrides.isActive ?? true,
      role: { name: role },
    };
    users.push(user);
    return user;
  };

  const addMembership = (userId: string, teamId: string) => {
    memberships.push({ userId, teamId });
  };

  const addTicket = (overrides: Partial<StoredTicket> = {}): StoredTicket => {
    const ticket: StoredTicket = {
      id: overrides.id ?? randomUUID(),
      number: overrides.number ?? 1000,
      subject: overrides.subject ?? 'Demo ticket',
      status: overrides.status ?? TicketStatus.OPEN,
      teamId: overrides.teamId ?? null,
      assigneeId: overrides.assigneeId ?? null,
      deletedAt: overrides.deletedAt ?? null,
    };
    tickets.push(ticket);
    return ticket;
  };

  return {
    service,
    prisma,
    queue,
    realtime,
    audit,
    stores: { users, tickets, memberships, requests, ticketEvents },
    addUser,
    addMembership,
    addTicket,
  };
};

const TEAM_ID = 'team-tech';
const OTHER_TEAM_ID = 'team-billing';

const seedStandard = () => {
  const world = createWorld();
  const manager = world.addUser(RoleName.MANAGER, {
    email: 'manager@demo.test',
  });
  const agentA = world.addUser(RoleName.AGENT, { email: 'a1@demo.test' });
  const agentB = world.addUser(RoleName.AGENT, { email: 'a2@demo.test' });
  const admin = world.addUser(RoleName.ADMIN, { email: 'admin@demo.test' });
  const outsider = world.addUser(RoleName.AGENT, { email: 'b1@demo.test' });

  world.addMembership(manager.id, TEAM_ID);
  world.addMembership(agentA.id, TEAM_ID);
  world.addMembership(agentB.id, TEAM_ID);
  world.addMembership(outsider.id, OTHER_TEAM_ID);

  const ticket = world.addTicket({
    number: 1001,
    teamId: TEAM_ID,
    assigneeId: agentA.id,
  });

  return { world, manager, agentA, agentB, admin, outsider, ticket };
};

const actor = (user: { id: string; role: { name: RoleName } }) => ({
  sub: user.id,
  role: user.role.name,
});

const reasonText = 'Please reassign this ticket; it needs other expertise.';

describe('AssignmentRequestsService.createForTicket', () => {
  it('creates a pending REASSIGN_USER request without changing the assignee', async () => {
    const { world, agentA, agentB, ticket } = seedStandard();

    const dto = await world.service.createForTicket(ticket.id, actor(agentA), {
      type: AssignmentRequestType.REASSIGN_USER,
      requestedAssigneeId: agentB.id,
      reason: reasonText,
    });

    expect(dto.status).toBe(AssignmentRequestStatus.PENDING);
    expect(dto.requestedAssignee?.id).toBe(agentB.id);
    // Ticket assignee is unchanged.
    expect(
      world.stores.tickets.find((t) => t.id === ticket.id)!.assigneeId,
    ).toBe(agentA.id);
    expect(world.audit.record).toHaveBeenCalledTimes(1);
    expect(world.realtime.emitTicketUpdated).toHaveBeenCalledTimes(1);
  });

  it('creates a RETURN_TO_QUEUE request', async () => {
    const { world, agentA, ticket } = seedStandard();

    const dto = await world.service.createForTicket(ticket.id, actor(agentA), {
      type: AssignmentRequestType.RETURN_TO_QUEUE,
      reason: reasonText,
    });

    expect(dto.type).toBe(AssignmentRequestType.RETURN_TO_QUEUE);
    expect(dto.requestedAssignee).toBeNull();
  });

  it('notifies team managers (only) on creation', async () => {
    const { world, manager, agentA, agentB, ticket } = seedStandard();

    await world.service.createForTicket(ticket.id, actor(agentA), {
      type: AssignmentRequestType.REASSIGN_USER,
      requestedAssigneeId: agentB.id,
      reason: reasonText,
    });

    expect(world.queue.enqueueNotification).toHaveBeenCalledTimes(1);
    const [payload] = world.queue.enqueueNotification.mock.calls[0]!;
    expect(payload.type).toBe(NotificationType.ASSIGNMENT_REQUEST_CREATED);
    expect(payload.recipientUserIds).toEqual([manager.id]);
  });

  it('rejects a manager using the request flow with 403', async () => {
    const { world, manager, agentB, ticket } = seedStandard();

    await expect(
      world.service.createForTicket(ticket.id, actor(manager), {
        type: AssignmentRequestType.REASSIGN_USER,
        requestedAssigneeId: agentB.id,
        reason: reasonText,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects a non-assignee agent with 403', async () => {
    const { world, agentB, ticket } = seedStandard();

    await expect(
      world.service.createForTicket(ticket.id, actor(agentB), {
        type: AssignmentRequestType.RETURN_TO_QUEUE,
        reason: reasonText,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects a request on a trashed ticket with 404', async () => {
    const { world, agentA, ticket } = seedStandard();
    world.stores.tickets.find((t) => t.id === ticket.id)!.deletedAt =
      new Date();

    await expect(
      world.service.createForTicket(ticket.id, actor(agentA), {
        type: AssignmentRequestType.RETURN_TO_QUEUE,
        reason: reasonText,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('rejects REASSIGN_USER to a user outside the ticket team with 400', async () => {
    const { world, agentA, outsider, ticket } = seedStandard();

    await expect(
      world.service.createForTicket(ticket.id, actor(agentA), {
        type: AssignmentRequestType.REASSIGN_USER,
        requestedAssigneeId: outsider.id,
        reason: reasonText,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects REASSIGN_USER to an inactive user with 400', async () => {
    const { world, agentA, agentB, ticket } = seedStandard();
    world.stores.users.find((u) => u.id === agentB.id)!.isActive = false;

    await expect(
      world.service.createForTicket(ticket.id, actor(agentA), {
        type: AssignmentRequestType.REASSIGN_USER,
        requestedAssigneeId: agentB.id,
        reason: reasonText,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects REASSIGN_USER to the current assignee with 400', async () => {
    const { world, agentA, ticket } = seedStandard();

    await expect(
      world.service.createForTicket(ticket.id, actor(agentA), {
        type: AssignmentRequestType.REASSIGN_USER,
        requestedAssigneeId: agentA.id,
        reason: reasonText,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a second pending request from the same agent with 409', async () => {
    const { world, agentA, agentB, ticket } = seedStandard();

    await world.service.createForTicket(ticket.id, actor(agentA), {
      type: AssignmentRequestType.REASSIGN_USER,
      requestedAssigneeId: agentB.id,
      reason: reasonText,
    });

    await expect(
      world.service.createForTicket(ticket.id, actor(agentA), {
        type: AssignmentRequestType.RETURN_TO_QUEUE,
        reason: reasonText,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('AssignmentRequestsService.cancelForTicket', () => {
  const createPending = async () => {
    const seeded = seedStandard();
    const dto = await seeded.world.service.createForTicket(
      seeded.ticket.id,
      actor(seeded.agentA),
      {
        type: AssignmentRequestType.REASSIGN_USER,
        requestedAssigneeId: seeded.agentB.id,
        reason: reasonText,
      },
    );
    return { ...seeded, requestId: dto.id };
  };

  it('lets the requester cancel their own pending request', async () => {
    const { world, agentA, ticket, requestId } = await createPending();

    const dto = await world.service.cancelForTicket(
      ticket.id,
      requestId,
      actor(agentA),
    );

    expect(dto.status).toBe(AssignmentRequestStatus.CANCELLED);
  });

  it('forbids cancelling someone else’s request (403)', async () => {
    const { world, agentB, ticket, requestId } = await createPending();

    await expect(
      world.service.cancelForTicket(ticket.id, requestId, actor(agentB)),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects cancelling an already-reviewed request with 409', async () => {
    const { world, admin, agentA, ticket, requestId } = await createPending();
    await world.service.reject(requestId, actor(admin), 'Keep it for now.');

    await expect(
      world.service.cancelForTicket(ticket.id, requestId, actor(agentA)),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('rejects a ticket/request mismatch with 404', async () => {
    const { world, agentA, requestId } = await createPending();

    await expect(
      world.service.cancelForTicket('not-the-ticket', requestId, actor(agentA)),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('AssignmentRequestsService review', () => {
  const createPending = async (
    type: AssignmentRequestType = AssignmentRequestType.REASSIGN_USER,
  ) => {
    const seeded = seedStandard();
    const dto = await seeded.world.service.createForTicket(
      seeded.ticket.id,
      actor(seeded.agentA),
      type === AssignmentRequestType.REASSIGN_USER
        ? {
            type,
            requestedAssigneeId: seeded.agentB.id,
            reason: reasonText,
          }
        : { type, reason: reasonText },
    );
    seeded.world.queue.enqueueNotification.mockClear();
    seeded.world.realtime.emitTicketUpdated.mockClear();
    seeded.world.audit.record.mockClear();
    return { ...seeded, requestId: dto.id };
  };

  it('approves a same-team reassignment and replaces the single assignee', async () => {
    const { world, manager, agentB, ticket, requestId } = await createPending();

    const dto = await world.service.approve(
      requestId,
      actor(manager),
      'Sounds good.',
    );

    expect(dto.status).toBe(AssignmentRequestStatus.APPROVED);
    const stored = world.stores.tickets.find((t) => t.id === ticket.id)!;
    expect(stored.assigneeId).toBe(agentB.id);
    expect(
      world.stores.ticketEvents.filter(
        (event) =>
          event.ticketId === ticket.id &&
          event.type === TicketEventType.REASSIGNED,
      ),
    ).toHaveLength(1);
  });

  it('approves a return-to-queue request, keeping the team and clearing the assignee', async () => {
    const { world, manager, ticket, requestId } = await createPending(
      AssignmentRequestType.RETURN_TO_QUEUE,
    );

    await world.service.approve(requestId, actor(manager), undefined);

    const stored = world.stores.tickets.find((t) => t.id === ticket.id)!;
    expect(stored.assigneeId).toBeNull();
    expect(stored.teamId).toBe(TEAM_ID);
  });

  it('notifies the requester and the new assignee on approval', async () => {
    const { world, manager, agentA, agentB, requestId } = await createPending();

    await world.service.approve(requestId, actor(manager), undefined);

    const calls = world.queue.enqueueNotification.mock.calls;
    const recipientSets = calls.map((call) => call[0].recipientUserIds);
    expect(recipientSets).toContainEqual([agentA.id]);
    expect(recipientSets).toContainEqual([agentB.id]);
  });

  it('lets an admin approve globally', async () => {
    const { world, admin, agentB, ticket, requestId } = await createPending();

    await world.service.approve(requestId, actor(admin), undefined);

    expect(
      world.stores.tickets.find((t) => t.id === ticket.id)!.assigneeId,
    ).toBe(agentB.id);
  });

  it('forbids a manager who does not manage the ticket team (403)', async () => {
    const { world, requestId } = await createPending();
    const foreignManager = world.addUser(RoleName.MANAGER, {
      email: 'foreign@demo.test',
    });
    world.addMembership(foreignManager.id, OTHER_TEAM_ID);

    await expect(
      world.service.approve(requestId, actor(foreignManager), undefined),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('returns 409 when the ticket owner changed since the request', async () => {
    const { world, manager, admin, ticket, requestId } = await createPending();
    // Someone else takes over the ticket before the manager reviews.
    world.stores.tickets.find((t) => t.id === ticket.id)!.assigneeId = admin.id;

    await expect(
      world.service.approve(requestId, actor(manager), undefined),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('returns 409 when the requested assignee is no longer on the team', async () => {
    const { world, manager, agentB, requestId } = await createPending();
    // Remove the requested assignee from the team.
    const index = world.stores.memberships.findIndex(
      (m) => m.userId === agentB.id && m.teamId === TEAM_ID,
    );
    world.stores.memberships.splice(index, 1);

    await expect(
      world.service.approve(requestId, actor(manager), undefined),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('returns 409 when approving a request on a trashed ticket', async () => {
    const { world, manager, ticket, requestId } = await createPending();
    world.stores.tickets.find((t) => t.id === ticket.id)!.deletedAt =
      new Date();

    await expect(
      world.service.approve(requestId, actor(manager), undefined),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('rejects a request without changing the assignee and notifies the requester only', async () => {
    const { world, manager, agentA, ticket, requestId } = await createPending();

    const dto = await world.service.reject(
      requestId,
      actor(manager),
      'Please keep this one.',
    );

    expect(dto.status).toBe(AssignmentRequestStatus.REJECTED);
    expect(dto.reviewNote).toBe('Please keep this one.');
    expect(
      world.stores.tickets.find((t) => t.id === ticket.id)!.assigneeId,
    ).toBe(agentA.id);
    const calls = world.queue.enqueueNotification.mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0]![0].recipientUserIds).toEqual([agentA.id]);
    expect(calls[0]![0].type).toBe(
      NotificationType.ASSIGNMENT_REQUEST_REJECTED,
    );
  });

  it('returns 409 when reviewing a non-pending request', async () => {
    const { world, manager, requestId } = await createPending();
    await world.service.approve(requestId, actor(manager), undefined);

    await expect(
      world.service.reject(requestId, actor(manager), 'Too late.'),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('AssignmentRequestsService scoping', () => {
  let seeded: ReturnType<typeof seedStandard>;

  beforeEach(async () => {
    seeded = seedStandard();
    await seeded.world.service.createForTicket(
      seeded.ticket.id,
      actor(seeded.agentA),
      {
        type: AssignmentRequestType.REASSIGN_USER,
        requestedAssigneeId: seeded.agentB.id,
        reason: reasonText,
      },
    );
  });

  it('lists pending requests for the managing manager', async () => {
    const list = await seeded.world.service.listForReviewer(
      actor(seeded.manager),
      {},
    );
    expect(list).toHaveLength(1);
  });

  it('hides team requests from a manager of a different team', async () => {
    const foreignManager = seeded.world.addUser(RoleName.MANAGER, {
      email: 'foreign@demo.test',
    });
    seeded.world.addMembership(foreignManager.id, OTHER_TEAM_ID);

    const list = await seeded.world.service.listForReviewer(
      actor(foreignManager),
      {},
    );
    expect(list).toHaveLength(0);
  });

  it('lists all pending requests for an admin', async () => {
    const list = await seeded.world.service.listForReviewer(
      actor(seeded.admin),
      {},
    );
    expect(list).toHaveLength(1);
  });

  it('returns only the requesting agent’s own requests for a ticket', async () => {
    const ownList = await seeded.world.service.listForTicket(
      seeded.ticket.id,
      actor(seeded.agentA),
    );
    expect(ownList).toHaveLength(1);

    const otherAgentList = await seeded.world.service.listForTicket(
      seeded.ticket.id,
      actor(seeded.agentB),
    );
    expect(otherAgentList).toHaveLength(0);
  });

  it('excludes requests on trashed tickets from the review queue', async () => {
    seeded.world.stores.tickets.find(
      (t) => t.id === seeded.ticket.id,
    )!.deletedAt = new Date();

    const list = await seeded.world.service.listForReviewer(
      actor(seeded.admin),
      {},
    );
    expect(list).toHaveLength(0);
  });
});
