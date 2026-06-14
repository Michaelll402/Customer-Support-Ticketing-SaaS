import {
  PrismaClient,
  RoleName,
  SlaPlanAppliesTo,
  TicketEventType,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';
import { hash } from 'bcryptjs';

import { seedDemoOrganization } from './seed-organization';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Password1!';
const SALT_ROUNDS = 12;

const demoUsers = [
  {
    email: 'customer@demo.test',
    firstName: 'Casey',
    lastName: 'Customer',
    role: RoleName.CUSTOMER,
  },
  {
    email: 'customer.two@demo.test',
    firstName: 'Jordan',
    lastName: 'Customer',
    role: RoleName.CUSTOMER,
  },
  {
    email: 'agent@demo.test',
    firstName: 'Avery',
    lastName: 'Agent',
    role: RoleName.AGENT,
  },
  {
    email: 'manager@demo.test',
    firstName: 'Morgan',
    lastName: 'Manager',
    role: RoleName.MANAGER,
  },
  {
    email: 'admin@demo.test',
    firstName: 'Addison',
    lastName: 'Admin',
    role: RoleName.ADMIN,
  },
] as const;

const demoTeams = [
  {
    name: 'Technical Support',
    description:
      'Primary queue for platform issues, bugs, and account access problems.',
  },
  {
    name: 'Billing',
    description: 'Handles invoices, plan questions, and payment issues.',
  },
] as const;

const demoTeamMemberships = [
  {
    userEmail: 'agent@demo.test',
    teamName: 'Technical Support',
  },
  {
    userEmail: 'manager@demo.test',
    teamName: 'Technical Support',
  },
] as const;

const demoCategories = [
  {
    color: '#2563eb',
    description:
      'Errors, broken flows, and technical troubleshooting requests.',
    name: 'Technical Issue',
  },
  {
    color: '#ca8a04',
    description: 'Invoices, refunds, payment failures, and billing questions.',
    name: 'Billing',
  },
  {
    color: '#7c3aed',
    description: 'Login, MFA, password reset, and account access problems.',
    name: 'Account Access',
  },
] as const;

const demoTags = [
  {
    color: '#dc2626',
    name: 'urgent',
  },
  {
    color: '#0284c7',
    name: 'vip',
  },
  {
    color: '#16a34a',
    name: 'bug',
  },
] as const;

const demoTickets = [
  {
    assigneeEmail: null,
    categoryName: 'Account Access',
    description:
      'The reset link loops back to the sign-in screen after submission, so the customer cannot complete the password reset flow.',
    eventHistory: [
      {
        actorEmail: 'customer@demo.test',
        metadata: undefined,
        type: TicketEventType.CREATED,
      },
    ],
    priority: TicketPriority.HIGH,
    requesterEmail: 'customer@demo.test',
    status: TicketStatus.OPEN,
    subject: '[DEMO] Password reset loop blocks access to the portal',
    tagNames: ['urgent'],
    teamName: null,
  },
  {
    assigneeEmail: null,
    categoryName: 'Billing',
    description:
      'The invoice shows a duplicate subscription charge for the same billing cycle and needs a billing-team review.',
    eventHistory: [
      {
        actorEmail: 'customer.two@demo.test',
        metadata: undefined,
        type: TicketEventType.CREATED,
      },
    ],
    priority: TicketPriority.URGENT,
    requesterEmail: 'customer.two@demo.test',
    status: TicketStatus.OPEN,
    subject: '[DEMO] Duplicate subscription charge on April invoice',
    tagNames: ['vip'],
    teamName: 'Billing',
  },
  {
    assigneeEmail: 'agent@demo.test',
    categoryName: 'Technical Issue',
    description:
      'The storefront API returns a 500 response during checkout for one integration path. Initial triage is already in progress.',
    eventHistory: [
      {
        actorEmail: 'customer@demo.test',
        metadata: undefined,
        type: TicketEventType.CREATED,
      },
    ],
    priority: TicketPriority.HIGH,
    requesterEmail: 'customer@demo.test',
    status: TicketStatus.PENDING,
    subject: '[DEMO] Checkout API returns 500 for integration traffic',
    tagNames: ['bug', 'urgent'],
    teamName: 'Technical Support',
  },
  {
    assigneeEmail: null,
    categoryName: 'Technical Issue',
    description:
      'Uploading a receipt image from the mobile browser crashes the page before submission, but no file attachments are stored yet in Milestone 2.',
    eventHistory: [
      {
        actorEmail: 'customer.two@demo.test',
        metadata: undefined,
        type: TicketEventType.CREATED,
      },
    ],
    priority: TicketPriority.MEDIUM,
    requesterEmail: 'customer.two@demo.test',
    status: TicketStatus.OPEN,
    subject: '[DEMO] Mobile receipt upload crashes before submit',
    tagNames: ['bug'],
    teamName: 'Technical Support',
  },
  {
    assigneeEmail: 'agent@demo.test',
    categoryName: 'Technical Issue',
    description:
      'A reporting export failed after a browser update. The issue was resolved after agent investigation and the ticket was marked resolved.',
    eventHistory: [
      {
        actorEmail: 'customer@demo.test',
        metadata: undefined,
        type: TicketEventType.CREATED,
      },
      {
        actorEmail: 'agent@demo.test',
        metadata: { from: TicketStatus.OPEN, to: TicketStatus.RESOLVED },
        type: TicketEventType.STATUS_CHANGED,
      },
    ],
    priority: TicketPriority.LOW,
    requesterEmail: 'customer@demo.test',
    status: TicketStatus.RESOLVED,
    subject: '[DEMO] Export job recovered after browser compatibility issue',
    tagNames: ['bug'],
    teamName: 'Technical Support',
  },
  {
    assigneeEmail: 'agent@demo.test',
    categoryName: 'Account Access',
    description:
      'The customer confirmed the access problem was resolved and then closed the ticket from their side.',
    eventHistory: [
      {
        actorEmail: 'customer.two@demo.test',
        metadata: undefined,
        type: TicketEventType.CREATED,
      },
      {
        actorEmail: 'customer.two@demo.test',
        metadata: { from: TicketStatus.RESOLVED, to: TicketStatus.CLOSED },
        type: TicketEventType.CLOSED_BY_CUSTOMER,
      },
    ],
    priority: TicketPriority.MEDIUM,
    requesterEmail: 'customer.two@demo.test',
    status: TicketStatus.CLOSED,
    subject: '[DEMO] Customer confirmed account access issue is closed',
    tagNames: ['vip'],
    teamName: 'Technical Support',
  },
] as const;

const seed = async () => {
  for (const roleName of Object.values(RoleName)) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }

  const passwordHash = await hash(DEMO_PASSWORD, SALT_ROUNDS);

  for (const demoUser of demoUsers) {
    await prisma.user.upsert({
      where: { email: demoUser.email },
      update: {
        firstName: demoUser.firstName,
        lastName: demoUser.lastName,
        passwordHash,
        role: {
          connect: {
            name: demoUser.role,
          },
        },
      },
      create: {
        email: demoUser.email,
        firstName: demoUser.firstName,
        lastName: demoUser.lastName,
        passwordHash,
        role: {
          connect: {
            name: demoUser.role,
          },
        },
      },
    });
  }

  for (const demoTeam of demoTeams) {
    await prisma.team.upsert({
      where: { name: demoTeam.name },
      update: {
        description: demoTeam.description,
      },
      create: demoTeam,
    });
  }

  // Realistic demo organization: one manager over three teams, three agents per
  // team. Idempotent; reuses the existing TeamMember model.
  await seedDemoOrganization(prisma, passwordHash);

  for (const demoCategory of demoCategories) {
    await prisma.category.upsert({
      where: { name: demoCategory.name },
      update: {
        color: demoCategory.color,
        description: demoCategory.description,
      },
      create: demoCategory,
    });
  }

  for (const demoTag of demoTags) {
    await prisma.tag.upsert({
      where: { name: demoTag.name },
      update: {
        color: demoTag.color,
      },
      create: demoTag,
    });
  }

  // Default workspace SLA plan. ALL tickets are covered by a 1-hour first
  // response target and a 24-hour resolution target (in minutes). The SLA
  // engine (a later M5 slice) computes due dates from this plan; existing
  // tickets are intentionally NOT given due dates here.
  await prisma.slaPlan.upsert({
    where: { name: 'Standard' },
    update: {
      appliesTo: SlaPlanAppliesTo.ALL,
      firstResponseMinutes: 60,
      isActive: true,
      resolutionMinutes: 1440,
    },
    create: {
      appliesTo: SlaPlanAppliesTo.ALL,
      firstResponseMinutes: 60,
      isActive: true,
      name: 'Standard',
      resolutionMinutes: 1440,
    },
  });

  const users = await prisma.user.findMany({
    where: {
      email: {
        in: demoUsers.map((user) => user.email),
      },
    },
  });
  const teams = await prisma.team.findMany({
    where: {
      name: {
        in: demoTeams.map((team) => team.name),
      },
    },
  });
  const categories = await prisma.category.findMany({
    where: {
      name: {
        in: demoCategories.map((category) => category.name),
      },
    },
  });
  const tags = await prisma.tag.findMany({
    where: {
      name: {
        in: demoTags.map((tag) => tag.name),
      },
    },
  });

  const userByEmail = new Map(users.map((user) => [user.email, user]));
  const teamByName = new Map(teams.map((team) => [team.name, team]));
  const categoryByName = new Map(
    categories.map((category) => [category.name, category]),
  );
  const tagByName = new Map(tags.map((tag) => [tag.name, tag]));

  for (const membership of demoTeamMemberships) {
    const user = userByEmail.get(membership.userEmail);
    const team = teamByName.get(membership.teamName);

    if (!user || !team) {
      throw new Error(
        `Missing team membership dependency for ${membership.userEmail}.`,
      );
    }

    await prisma.teamMember.upsert({
      where: {
        userId_teamId: {
          teamId: team.id,
          userId: user.id,
        },
      },
      update: {},
      create: {
        teamId: team.id,
        userId: user.id,
      },
    });
  }

  for (const demoTicket of demoTickets) {
    const requester = userByEmail.get(demoTicket.requesterEmail);
    const assignee = demoTicket.assigneeEmail
      ? userByEmail.get(demoTicket.assigneeEmail)
      : null;
    const category = categoryByName.get(demoTicket.categoryName);
    const team = demoTicket.teamName
      ? teamByName.get(demoTicket.teamName)
      : null;

    if (!requester || !category) {
      throw new Error(
        `Missing ticket dependency for subject "${demoTicket.subject}".`,
      );
    }

    const existingTicket = await prisma.ticket.findFirst({
      where: {
        requesterId: requester.id,
        subject: demoTicket.subject,
      },
    });

    const ticketData = {
      assigneeId: assignee?.id ?? null,
      categoryId: category.id,
      description: demoTicket.description,
      firstResponseDueAt: null,
      priority: demoTicket.priority,
      requesterId: requester.id,
      resolutionDueAt: null,
      status: demoTicket.status,
      subject: demoTicket.subject,
      teamId: team?.id ?? null,
    };

    const ticket = existingTicket
      ? await prisma.ticket.update({
          where: { id: existingTicket.id },
          data: ticketData,
        })
      : await prisma.ticket.create({
          data: ticketData,
        });

    await prisma.ticketTag.deleteMany({
      where: {
        ticketId: ticket.id,
      },
    });

    if (demoTicket.tagNames.length > 0) {
      await prisma.ticketTag.createMany({
        data: demoTicket.tagNames.map((tagName) => {
          const tag = tagByName.get(tagName);

          if (!tag) {
            throw new Error(`Missing tag dependency "${tagName}".`);
          }

          return {
            tagId: tag.id,
            ticketId: ticket.id,
          };
        }),
        skipDuplicates: true,
      });
    }

    for (const event of demoTicket.eventHistory) {
      const actor = event.actorEmail ? userByEmail.get(event.actorEmail) : null;
      const existingEvent = await prisma.ticketEvent.findFirst({
        where: {
          ticketId: ticket.id,
          type: event.type,
        },
      });

      if (existingEvent) {
        await prisma.ticketEvent.update({
          where: { id: existingEvent.id },
          data: {
            actorId: actor?.id ?? null,
            metadata: event.metadata ?? undefined,
          },
        });
        continue;
      }

      await prisma.ticketEvent.create({
        data: {
          actorId: actor?.id ?? null,
          metadata: event.metadata ?? undefined,
          ticketId: ticket.id,
          type: event.type,
        },
      });
    }
  }

  console.log(
    'Seed completed: auth users, the demo organization (1 manager, 3 teams, 9 agents), teams, categories, tags, demo tickets, and the default SLA plan are in place.',
  );
};

seed()
  .catch((error) => {
    console.error('Milestone 2 seed failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
