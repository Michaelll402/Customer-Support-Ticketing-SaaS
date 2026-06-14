import 'reflect-metadata';

import {
  UnauthorizedException,
  ValidationPipe,
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { validationPipeOptions } from '../../common/validation/validation.pipe-options';
import { PrismaService } from '../../common/database/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsModule } from './reports.module';
import { ReportsService } from './reports.service';

// Injects request.user from test headers so the real RolesGuard can enforce
// @Roles without the full JWT/login plumbing (auth is covered elsewhere).
class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const role = req.headers['x-test-role'];
    if (!role) {
      throw new UnauthorizedException();
    }
    req.user = {
      sub: req.headers['x-test-sub'] ?? 'user-1',
      role,
      email: 'staff@demo.test',
      tokenVersion: 0,
    };
    return true;
  }
}

type StubFn = (...args: unknown[]) => Promise<{ report: string }>;

const reportsServiceStub = {
  getOverview: vi.fn<StubFn>(async () => ({ report: 'overview' })),
  getQueue: vi.fn<StubFn>(async () => ({ report: 'queue' })),
  getAgentMetrics: vi.fn<StubFn>(async () => ({ report: 'agent-metrics' })),
  getMe: vi.fn<StubFn>(async () => ({ report: 'me' })),
  getAssignmentRequests: vi.fn<StubFn>(async () => ({
    report: 'assignment-requests',
  })),
};

describe('Reports RBAC integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ReportsModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(ReportsService)
      .useValue(reportsServiceStub)
      .overrideGuard(JwtAuthGuard)
      .useValue(new TestAuthGuard())
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe(validationPipeOptions));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const reviewerEndpoints = [
    '/reports/overview',
    '/reports/queue',
    '/reports/agent-metrics',
    '/reports/assignment-requests',
  ];

  describe.each(reviewerEndpoints)('%s (manager/admin only)', (path) => {
    it.each([
      ['CUSTOMER', 403],
      ['AGENT', 403],
      ['MANAGER', 200],
      ['ADMIN', 200],
    ])('%s → %i', async (role, status) => {
      await request(app.getHttpServer())
        .get(path)
        .set('x-test-role', role)
        .set('x-test-sub', 'user-1')
        .expect(status);
    });

    it('requires authentication (401 without a session)', async () => {
      await request(app.getHttpServer()).get(path).expect(401);
    });
  });

  describe('/reports/me', () => {
    it.each([
      ['CUSTOMER', 403],
      ['AGENT', 200],
      ['MANAGER', 200],
      ['ADMIN', 200],
    ])('%s → %i', async (role, status) => {
      await request(app.getHttpServer())
        .get('/reports/me')
        .set('x-test-role', role)
        .set('x-test-sub', 'user-1')
        .expect(status);
    });

    it('uses the authenticated user as the source of truth', async () => {
      await request(app.getHttpServer())
        .get('/reports/me')
        .set('x-test-role', 'AGENT')
        .set('x-test-sub', 'agent-7')
        .expect(200);

      expect(reportsServiceStub.getMe).toHaveBeenCalledTimes(1);
      const [viewer] = reportsServiceStub.getMe.mock.calls[0]!;
      expect(viewer).toMatchObject({ sub: 'agent-7', role: 'AGENT' });
    });

    it('rejects a userId query override with 400', async () => {
      await request(app.getHttpServer())
        .get('/reports/me?userId=someone-else')
        .set('x-test-role', 'AGENT')
        .set('x-test-sub', 'agent-7')
        .expect(400);
      expect(reportsServiceStub.getMe).not.toHaveBeenCalled();
    });
  });

  describe('window query validation', () => {
    it('rejects windowDays above the maximum (365)', async () => {
      await request(app.getHttpServer())
        .get('/reports/overview?windowDays=400')
        .set('x-test-role', 'ADMIN')
        .expect(400);
    });

    it('rejects windowDays below the minimum (1)', async () => {
      await request(app.getHttpServer())
        .get('/reports/overview?windowDays=0')
        .set('x-test-role', 'ADMIN')
        .expect(400);
    });

    it('accepts a valid windowDays and forwards it to the service', async () => {
      await request(app.getHttpServer())
        .get('/reports/overview?windowDays=7')
        .set('x-test-role', 'ADMIN')
        .expect(200);
      const [, windowDays] = reportsServiceStub.getOverview.mock.calls[0]!;
      expect(windowDays).toBe(7);
    });
  });
});
