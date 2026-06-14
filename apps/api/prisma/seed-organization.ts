import type { PrismaClient} from '@prisma/client';
import { RoleName } from '@prisma/client';

// Realistic demo organization (Slice 2.5): one manager who oversees three teams,
// each staffed by three agents. These accounts use the @support.local domain so
// they never collide with the minimal @demo.test accounts, which are left
// untouched. Membership reuses the existing TeamMember model — the manager is a
// MANAGER-role member of all three teams, which is exactly how ticket visibility
// scopes a manager to teams. Single-assignee semantics are unchanged. The shared
// demo password is never written to logs.
//
// This module is intentionally free of any top-level side effect (no auto-run,
// no PrismaClient instantiation) so it can be imported and unit-tested without a
// database connection.

export const orgManager = {
  email: 'manager@support.local',
  firstName: 'Riley',
  lastName: 'Sterling',
} as const;

export interface OrgAgent {
  email: string;
  firstName: string;
  lastName: string;
}

export interface OrgTeam {
  name: string;
  description: string;
  agents: ReadonlyArray<OrgAgent>;
}

export const orgTeams: ReadonlyArray<OrgTeam> = [
  {
    name: 'Billing & Payments',
    description:
      'Invoices, refunds, payment failures, and subscription billing questions.',
    agents: [
      {
        email: 'billing.agent1@support.local',
        firstName: 'Blair',
        lastName: 'Bishop',
      },
      {
        email: 'billing.agent2@support.local',
        firstName: 'Bennett',
        lastName: 'Boyd',
      },
      {
        email: 'billing.agent3@support.local',
        firstName: 'Brielle',
        lastName: 'Barrett',
      },
    ],
  },
  {
    name: 'Technical Support',
    description:
      'Platform issues, bugs, outages, integrations, and technical troubleshooting.',
    agents: [
      {
        email: 'technical.agent1@support.local',
        firstName: 'Tessa',
        lastName: 'Tran',
      },
      {
        email: 'technical.agent2@support.local',
        firstName: 'Toby',
        lastName: 'Tate',
      },
      {
        email: 'technical.agent3@support.local',
        firstName: 'Trista',
        lastName: 'Turner',
      },
    ],
  },
  {
    name: 'Account & Access',
    description: 'Login, MFA, password reset, and account access problems.',
    agents: [
      {
        email: 'access.agent1@support.local',
        firstName: 'Aria',
        lastName: 'Acosta',
      },
      {
        email: 'access.agent2@support.local',
        firstName: 'Andre',
        lastName: 'Abbott',
      },
      {
        email: 'access.agent3@support.local',
        firstName: 'Alana',
        lastName: 'Ash',
      },
    ],
  },
];

/**
 * Idempotently seeds the realistic demo organization (one manager + three teams
 * + three agents each) and their memberships. Parameterized over the Prisma
 * client so it can be unit-tested without a database. Re-running it never
 * creates duplicate users, teams, or memberships because every write is an
 * upsert keyed by a unique field (user.email, team.name, teamMember.userId_teamId).
 *
 * Roles must already exist (the main seed upserts them first). The caller passes
 * a precomputed password hash so this function stays free of bcrypt in tests.
 */
export const seedDemoOrganization = async (
  prisma: PrismaClient,
  passwordHash: string,
): Promise<void> => {
  const manager = await prisma.user.upsert({
    where: { email: orgManager.email },
    update: {
      firstName: orgManager.firstName,
      lastName: orgManager.lastName,
      passwordHash,
      role: { connect: { name: RoleName.MANAGER } },
    },
    create: {
      email: orgManager.email,
      firstName: orgManager.firstName,
      lastName: orgManager.lastName,
      passwordHash,
      role: { connect: { name: RoleName.MANAGER } },
    },
  });

  for (const orgTeam of orgTeams) {
    const team = await prisma.team.upsert({
      where: { name: orgTeam.name },
      update: { description: orgTeam.description },
      create: { name: orgTeam.name, description: orgTeam.description },
    });

    // The manager oversees every team in the organization.
    await prisma.teamMember.upsert({
      where: { userId_teamId: { teamId: team.id, userId: manager.id } },
      update: {},
      create: { teamId: team.id, userId: manager.id },
    });

    for (const orgAgent of orgTeam.agents) {
      const agent = await prisma.user.upsert({
        where: { email: orgAgent.email },
        update: {
          firstName: orgAgent.firstName,
          lastName: orgAgent.lastName,
          passwordHash,
          role: { connect: { name: RoleName.AGENT } },
        },
        create: {
          email: orgAgent.email,
          firstName: orgAgent.firstName,
          lastName: orgAgent.lastName,
          passwordHash,
          role: { connect: { name: RoleName.AGENT } },
        },
      });

      // Each agent belongs to exactly one team. Ticket assignment still targets
      // a single assignee; team membership does not change that.
      await prisma.teamMember.upsert({
        where: { userId_teamId: { teamId: team.id, userId: agent.id } },
        update: {},
        create: { teamId: team.id, userId: agent.id },
      });
    }
  }
};
