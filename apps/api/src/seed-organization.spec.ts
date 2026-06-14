import { RoleName, type PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import {
  orgManager,
  orgTeams,
  seedDemoOrganization,
} from '../prisma/seed-organization';

interface StoredUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleName: RoleName;
}

interface StoredTeam {
  id: string;
  name: string;
  description: string | null;
}

interface StoredMembership {
  id: string;
  userId: string;
  teamId: string;
}

interface RoleConnect {
  role?: { connect: { name: RoleName } };
}

interface UserUpsertArgs {
  where: { email: string };
  update: { firstName?: string; lastName?: string } & RoleConnect;
  create: {
    email: string;
    firstName: string;
    lastName: string;
  } & RoleConnect;
}

interface TeamUpsertArgs {
  where: { name: string };
  update: { description?: string };
  create: { name: string; description?: string };
}

interface TeamMemberUpsertArgs {
  where: { userId_teamId: { userId: string; teamId: string } };
  create: { userId: string; teamId: string };
}

const createSeedMock = () => {
  const users: StoredUser[] = [];
  const teams: StoredTeam[] = [];
  const teamMembers: StoredMembership[] = [];
  let counter = 0;
  const nextId = () => `id-${(counter += 1)}`;

  const userModel = {
    upsert: vi.fn(async ({ where, update, create }: UserUpsertArgs) => {
      const existing = users.find((user) => user.email === where.email);

      if (existing) {
        if (update.firstName !== undefined)
          existing.firstName = update.firstName;
        if (update.lastName !== undefined) existing.lastName = update.lastName;
        if (update.role) existing.roleName = update.role.connect.name;
        return { ...existing };
      }

      const created: StoredUser = {
        id: nextId(),
        email: create.email,
        firstName: create.firstName,
        lastName: create.lastName,
        roleName: create.role!.connect.name,
      };
      users.push(created);
      return { ...created };
    }),
  };

  const teamModel = {
    upsert: vi.fn(async ({ where, update, create }: TeamUpsertArgs) => {
      const existing = teams.find((team) => team.name === where.name);

      if (existing) {
        if (update.description !== undefined) {
          existing.description = update.description;
        }
        return { ...existing };
      }

      const created: StoredTeam = {
        id: nextId(),
        name: create.name,
        description: create.description ?? null,
      };
      teams.push(created);
      return { ...created };
    }),
  };

  const teamMemberModel = {
    upsert: vi.fn(async ({ where, create }: TeamMemberUpsertArgs) => {
      const { userId, teamId } = where.userId_teamId;
      const existing = teamMembers.find(
        (member) => member.userId === userId && member.teamId === teamId,
      );

      if (existing) {
        return { ...existing };
      }

      const created: StoredMembership = {
        id: nextId(),
        userId: create.userId,
        teamId: create.teamId,
      };
      teamMembers.push(created);
      return { ...created };
    }),
  };

  const prisma = {
    user: userModel,
    team: teamModel,
    teamMember: teamMemberModel,
  } as unknown as PrismaClient;

  return { prisma, users, teams, teamMembers };
};

describe('seedDemoOrganization', () => {
  it('creates one manager over three teams with three agents each', async () => {
    const mock = createSeedMock();

    await seedDemoOrganization(mock.prisma, 'hashed-password');

    const orgUsers = mock.users.filter((user) =>
      user.email.endsWith('@support.local'),
    );
    const managers = orgUsers.filter(
      (user) => user.roleName === RoleName.MANAGER,
    );
    const agents = orgUsers.filter((user) => user.roleName === RoleName.AGENT);

    expect(managers).toHaveLength(1);
    expect(agents).toHaveLength(9);
    expect(managers[0]!.email).toBe(orgManager.email);

    const teamNames = mock.teams.map((team) => team.name).sort();
    expect(teamNames).toEqual([
      'Account & Access',
      'Billing & Payments',
      'Technical Support',
    ]);

    const manager = managers[0]!;
    const managerMemberships = mock.teamMembers.filter(
      (member) => member.userId === manager.id,
    );
    expect(managerMemberships).toHaveLength(3);

    // Each team has exactly the manager plus its three agents.
    for (const orgTeam of orgTeams) {
      const team = mock.teams.find((entry) => entry.name === orgTeam.name)!;
      const memberUserIds = mock.teamMembers
        .filter((member) => member.teamId === team.id)
        .map((member) => member.userId);

      expect(memberUserIds).toContain(manager.id);
      expect(memberUserIds).toHaveLength(4);

      const teamAgentEmails = new Set(
        orgTeam.agents.map((agent) => agent.email),
      );
      const seededTeamAgents = agents.filter((agent) =>
        teamAgentEmails.has(agent.email),
      );
      expect(seededTeamAgents).toHaveLength(3);
      for (const agent of seededTeamAgents) {
        expect(memberUserIds).toContain(agent.id);
      }
    }
  });

  it('is idempotent: repeated runs do not duplicate users, teams, or memberships', async () => {
    const mock = createSeedMock();

    await seedDemoOrganization(mock.prisma, 'hashed-password');
    await seedDemoOrganization(mock.prisma, 'hashed-password');
    await seedDemoOrganization(mock.prisma, 'hashed-password');

    expect(
      mock.users.filter((user) => user.email.endsWith('@support.local')),
    ).toHaveLength(10);
    expect(mock.teams).toHaveLength(3);
    // 3 manager memberships + 9 agent memberships.
    expect(mock.teamMembers).toHaveLength(12);
  });

  it('reuses a pre-existing team by name instead of duplicating it', async () => {
    const mock = createSeedMock();
    // Simulate the base seed having already created "Technical Support".
    mock.teams.push({
      id: 'pre-existing-technical-support',
      name: 'Technical Support',
      description: 'Existing description.',
    });

    await seedDemoOrganization(mock.prisma, 'hashed-password');

    expect(mock.teams).toHaveLength(3);
    const technical = mock.teams.find(
      (team) => team.name === 'Technical Support',
    )!;
    expect(technical.id).toBe('pre-existing-technical-support');
  });

  it('assigns each agent to exactly one team', async () => {
    const mock = createSeedMock();

    await seedDemoOrganization(mock.prisma, 'hashed-password');

    const agents = mock.users.filter(
      (user) => user.roleName === RoleName.AGENT,
    );
    expect(agents).toHaveLength(9);
    for (const agent of agents) {
      const memberships = mock.teamMembers.filter(
        (member) => member.userId === agent.id,
      );
      expect(memberships).toHaveLength(1);
    }
  });
});
