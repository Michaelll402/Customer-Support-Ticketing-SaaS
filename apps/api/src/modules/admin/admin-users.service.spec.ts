import { RoleName } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../common/database/prisma.service';
import type { PasswordService } from '../auth/password.service';
import type { AuditService } from '../audit/audit.service';
import { AdminUsersService } from './admin-users.service';

interface CountArgs {
  where?: unknown;
}
interface UserWriteArgs {
  where?: { id?: string; email?: string };
  data?: Record<string, unknown>;
}

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-1',
  email: 'avery@demo.test',
  firstName: 'Avery',
  lastName: 'Agent',
  isActive: true,
  passwordHash: 'SECRET-HASH',
  tokenVersion: 0,
  createdAt: new Date('2026-06-14T10:00:00.000Z'),
  updatedAt: new Date('2026-06-14T10:00:00.000Z'),
  role: { name: RoleName.AGENT },
  teamMemberships: [],
  ...overrides,
});

const createWorld = () => {
  const prisma = {
    user: {
      findUnique: vi.fn<
        (args: { where: { id?: string; email?: string } }) => Promise<unknown>
      >(async () => null),
      findMany: vi.fn<(args: unknown) => Promise<unknown[]>>(async () => []),
      count: vi.fn<(args: CountArgs) => Promise<number>>(async () => 0),
      create: vi.fn<(args: UserWriteArgs) => Promise<unknown>>(async () =>
        makeUser(),
      ),
      update: vi.fn<(args: UserWriteArgs) => Promise<unknown>>(async () =>
        makeUser(),
      ),
    },
    team: { count: vi.fn<(args: CountArgs) => Promise<number>>(async () => 0) },
    teamMember: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      createMany: vi.fn(async () => ({ count: 0 })),
    },
    $transaction: vi.fn<(ops: unknown[]) => Promise<unknown[]>>(async (ops) =>
      Promise.all(ops as Promise<unknown>[]),
    ),
  };
  const passwordService = {
    hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
  };
  const auditService = { record: vi.fn(async () => undefined) };

  const service = new AdminUsersService(
    prisma as unknown as PrismaService,
    passwordService as unknown as PasswordService,
    auditService as unknown as AuditService,
  );

  return { service, prisma, passwordService, auditService };
};

const actor = { sub: 'admin-1', role: RoleName.ADMIN };

describe('AdminUsersService.createUser', () => {
  it('hashes the password, creates the user, and audits — exposing no secrets', async () => {
    const world = createWorld();
    world.prisma.user.findUnique.mockResolvedValue(null); // email free
    world.prisma.user.create.mockResolvedValue(
      makeUser({ email: 'new@demo.test', role: { name: RoleName.MANAGER } }),
    );

    const dto = await world.service.createUser(actor, {
      email: 'new@demo.test',
      firstName: 'New',
      lastName: 'Person',
      password: 'Password1!',
      role: RoleName.MANAGER,
    });

    const createArgs = world.prisma.user.create.mock.calls[0]![0];
    expect(createArgs.data!.passwordHash).toBe('hashed:Password1!');
    expect(world.auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.user.created',
        targetType: 'User',
      }),
    );
    expect(dto).not.toHaveProperty('passwordHash');
    expect(dto).not.toHaveProperty('tokenVersion');
    expect(dto.role).toBe(RoleName.MANAGER);
  });

  it('rejects a duplicate email with 409', async () => {
    const world = createWorld();
    world.prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      world.service.createUser(actor, {
        email: 'taken@demo.test',
        firstName: 'A',
        lastName: 'B',
        password: 'Password1!',
        role: RoleName.AGENT,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('rejects unknown team ids with 400', async () => {
    const world = createWorld();
    world.prisma.user.findUnique.mockResolvedValue(null);
    world.prisma.team.count.mockResolvedValue(1); // only 1 of 2 found

    await expect(
      world.service.createUser(actor, {
        email: 'new@demo.test',
        firstName: 'A',
        lastName: 'B',
        password: 'Password1!',
        role: RoleName.AGENT,
        teamIds: ['t1', 't2'],
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('AdminUsersService.changeRole', () => {
  it('changes role and revokes sessions (tokenVersion increment) with audit', async () => {
    const world = createWorld();
    world.prisma.user.findUnique.mockResolvedValue(
      makeUser({ role: { name: RoleName.AGENT } }),
    );
    world.prisma.user.update.mockResolvedValue(
      makeUser({ role: { name: RoleName.MANAGER } }),
    );

    const dto = await world.service.changeRole(actor, 'user-1', {
      role: RoleName.MANAGER,
    });

    const updateData = world.prisma.user.update.mock.calls[0]![0].data!;
    expect(updateData.tokenVersion).toEqual({ increment: 1 });
    expect(updateData.role).toEqual({ connect: { name: RoleName.MANAGER } });
    expect(world.auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.user.role_changed',
        metadata: { from: RoleName.AGENT, to: RoleName.MANAGER },
      }),
    );
    expect(dto.role).toBe(RoleName.MANAGER);
  });

  it('blocks demoting the last active admin with 409', async () => {
    const world = createWorld();
    world.prisma.user.findUnique.mockResolvedValue(
      makeUser({ role: { name: RoleName.ADMIN }, isActive: true }),
    );
    world.prisma.user.count.mockResolvedValue(1); // only one active admin

    await expect(
      world.service.changeRole(actor, 'user-1', { role: RoleName.AGENT }),
    ).rejects.toMatchObject({ status: 409 });
    expect(world.prisma.user.update).not.toHaveBeenCalled();
  });

  it('allows demoting an admin when other admins remain', async () => {
    const world = createWorld();
    world.prisma.user.findUnique.mockResolvedValue(
      makeUser({ role: { name: RoleName.ADMIN }, isActive: true }),
    );
    world.prisma.user.count.mockResolvedValue(2);
    world.prisma.user.update.mockResolvedValue(
      makeUser({ role: { name: RoleName.MANAGER } }),
    );

    await world.service.changeRole(actor, 'user-1', { role: RoleName.MANAGER });
    expect(world.prisma.user.update).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when the role is unchanged', async () => {
    const world = createWorld();
    world.prisma.user.findUnique.mockResolvedValue(
      makeUser({ role: { name: RoleName.AGENT } }),
    );
    await world.service.changeRole(actor, 'user-1', { role: RoleName.AGENT });
    expect(world.prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('AdminUsersService.setStatus', () => {
  it('deactivates and revokes sessions', async () => {
    const world = createWorld();
    world.prisma.user.findUnique.mockResolvedValue(
      makeUser({
        id: 'user-2',
        isActive: true,
        role: { name: RoleName.AGENT },
      }),
    );
    world.prisma.user.update.mockResolvedValue(
      makeUser({ id: 'user-2', isActive: false }),
    );

    await world.service.setStatus(actor, 'user-2', { isActive: false });
    const data = world.prisma.user.update.mock.calls[0]![0].data!;
    expect(data.isActive).toBe(false);
    expect(data.tokenVersion).toEqual({ increment: 1 });
    expect(world.auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.user.deactivated' }),
    );
  });

  it('activates without bumping tokenVersion', async () => {
    const world = createWorld();
    world.prisma.user.findUnique.mockResolvedValue(
      makeUser({ id: 'user-2', isActive: false }),
    );
    world.prisma.user.update.mockResolvedValue(
      makeUser({ id: 'user-2', isActive: true }),
    );

    await world.service.setStatus(actor, 'user-2', { isActive: true });
    const data = world.prisma.user.update.mock.calls[0]![0].data!;
    expect(data.isActive).toBe(true);
    expect(data.tokenVersion).toBeUndefined();
    expect(world.auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.user.activated' }),
    );
  });

  it('blocks self-deactivation with 400', async () => {
    const world = createWorld();
    world.prisma.user.findUnique.mockResolvedValue(
      makeUser({
        id: 'admin-1',
        isActive: true,
        role: { name: RoleName.ADMIN },
      }),
    );
    await expect(
      world.service.setStatus(actor, 'admin-1', { isActive: false }),
    ).rejects.toMatchObject({ status: 400 });
    expect(world.prisma.user.update).not.toHaveBeenCalled();
  });

  it('blocks deactivating the last active admin with 409', async () => {
    const world = createWorld();
    world.prisma.user.findUnique.mockResolvedValue(
      makeUser({
        id: 'user-9',
        isActive: true,
        role: { name: RoleName.ADMIN },
      }),
    );
    world.prisma.user.count.mockResolvedValue(1);
    await expect(
      world.service.setStatus(actor, 'user-9', { isActive: false }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('AdminUsersService.revokeSessions & updateTeams', () => {
  it('revokes sessions by bumping tokenVersion and audits', async () => {
    const world = createWorld();
    world.prisma.user.findUnique.mockResolvedValue(makeUser());
    world.prisma.user.update.mockResolvedValue(makeUser({ tokenVersion: 1 }));

    await world.service.revokeSessions(actor, 'user-1');
    expect(world.prisma.user.update.mock.calls[0]![0].data).toEqual({
      tokenVersion: { increment: 1 },
    });
    expect(world.auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.user.sessions_revoked' }),
    );
  });

  it('replaces team memberships in a transaction', async () => {
    const world = createWorld();
    world.prisma.user.findUnique.mockResolvedValue(makeUser());
    world.prisma.team.count.mockResolvedValue(2);

    await world.service.updateTeams(actor, 'user-1', { teamIds: ['t1', 't2'] });
    expect(world.prisma.teamMember.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(world.prisma.teamMember.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'user-1', teamId: 't1' },
        { userId: 'user-1', teamId: 't2' },
      ],
    });
  });
});

describe('AdminUsersService.listUsers & getUser', () => {
  it('builds a case-insensitive search and includes the active-admin count', async () => {
    const world = createWorld();
    world.prisma.user.count.mockImplementation(async ({ where }: CountArgs) => {
      const text = JSON.stringify(where ?? {});
      return text.includes('ADMIN') && text.includes('isActive') ? 3 : 1;
    });
    world.prisma.user.findMany.mockResolvedValue([makeUser()]);

    const result = await world.service.listUsers({
      page: 1,
      limit: 20,
      search: 'avery',
    });

    expect(result.items).toHaveLength(1);
    expect(result.activeAdminCount).toBe(3);
    const where = world.prisma.user.findMany.mock.calls[0]![0] as {
      where: { OR?: unknown };
    };
    expect(where.where.OR).toEqual([
      { firstName: { contains: 'avery', mode: 'insensitive' } },
      { lastName: { contains: 'avery', mode: 'insensitive' } },
      { email: { contains: 'avery', mode: 'insensitive' } },
    ]);
  });

  it('returns 404 for an unknown user', async () => {
    const world = createWorld();
    world.prisma.user.findUnique.mockResolvedValue(null);
    await expect(world.service.getUser('missing')).rejects.toMatchObject({
      status: 404,
    });
  });
});
