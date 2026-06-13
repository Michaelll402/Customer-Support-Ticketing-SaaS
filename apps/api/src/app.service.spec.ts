import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from './common/database/prisma.service';
import type { QueueService } from './modules/queue/queue.service';
import { AppService } from './app.service';

const buildService = (options: {
  dbOk: boolean;
  queue: 'configured' | 'disabled';
}) => {
  const prisma = {
    $queryRaw: vi.fn(() =>
      options.dbOk
        ? Promise.resolve([{ '?column?': 1 }])
        : Promise.reject(new Error('connection refused at db.internal:5432')),
    ),
  } as unknown as PrismaService;

  const queueService = {
    getAvailability: vi.fn(() => options.queue),
  } as unknown as QueueService;

  return new AppService(prisma, queueService);
};

describe('AppService', () => {
  it('reports a static ok health payload', () => {
    const service = buildService({ dbOk: true, queue: 'configured' });

    const health = service.getHealth();

    expect(health.status).toBe('ok');
    expect(health.service).toBe('customer-support-api');
  });

  it('reports ready when the database responds and the queue is configured', async () => {
    const service = buildService({ dbOk: true, queue: 'configured' });

    const readiness = await service.getReadiness();

    expect(readiness.status).toBe('ready');
    expect(readiness.checks).toEqual({
      database: 'up',
      queue: 'configured',
    });
  });

  it('reports not_ready with database down and leaks no raw error when the probe fails', async () => {
    const service = buildService({ dbOk: false, queue: 'disabled' });

    const readiness = await service.getReadiness();

    expect(readiness.status).toBe('not_ready');
    expect(readiness.checks.database).toBe('down');
    expect(readiness.checks.queue).toBe('disabled');
    // No raw infrastructure error string is surfaced anywhere in the payload.
    expect(JSON.stringify(readiness)).not.toContain('db.internal');
  });
});
