import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../common/database/prisma.service';
import { AuditService } from './audit.service';

const buildService = () => {
  const create = vi.fn().mockResolvedValue({ id: 'audit-1' });
  const prisma = {
    auditLog: { create },
  } as unknown as PrismaService;

  return { service: new AuditService(prisma), create };
};

describe('AuditService', () => {
  it('records an audit entry with an actor and metadata', async () => {
    const { service, create } = buildService();

    await service.record({
      actorId: 'user-1',
      action: 'admin.user.role_changed',
      targetType: 'User',
      targetId: 'user-2',
      metadata: { after: 'MANAGER', before: 'AGENT' },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        actorId: 'user-1',
        action: 'admin.user.role_changed',
        targetType: 'User',
        targetId: 'user-2',
        metadata: { after: 'MANAGER', before: 'AGENT' },
      },
    });
  });

  it('defaults a missing actor to null and omits absent metadata', async () => {
    const { service, create } = buildService();

    await service.record({
      action: 'system.sla.recalculated',
      targetType: 'Ticket',
      targetId: 'ticket-1',
    });

    // Exact match proves the actor falls back to null and that no `metadata`
    // key is written when none is supplied.
    expect(create).toHaveBeenCalledWith({
      data: {
        actorId: null,
        action: 'system.sla.recalculated',
        targetType: 'Ticket',
        targetId: 'ticket-1',
      },
    });
  });
});
