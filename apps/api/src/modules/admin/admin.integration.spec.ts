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
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { validationPipeOptions } from '../../common/validation/validation.pipe-options';
import { PrismaService } from '../../common/database/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminAuditService } from './admin-audit.service';
import { AdminModule } from './admin.module';
import { AdminUsersService } from './admin-users.service';

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const role = req.headers['x-test-role'];
    if (!role) {
      throw new UnauthorizedException();
    }
    req.user = {
      sub: req.headers['x-test-sub'] ?? 'admin-1',
      role,
      email: 'admin@demo.test',
      tokenVersion: 0,
    };
    return true;
  }
}

type StubFn = (...args: unknown[]) => Promise<unknown>;
const ok = (value: unknown) => vi.fn<StubFn>(async () => value);

const usersStub = {
  listUsers: ok({ items: [], meta: {}, activeAdminCount: 1 }),
  createUser: ok({ id: 'u1' }),
  getUser: ok({ id: 'u1' }),
  updateProfile: ok({ id: 'u1' }),
  changeRole: ok({ id: 'u1' }),
  setStatus: ok({ id: 'u1' }),
  updateTeams: ok({ id: 'u1' }),
  revokeSessions: ok({ id: 'u1' }),
};
const auditStub = { listAuditLogs: ok({ items: [], meta: {} }) };

const ID = 'a1111111-1111-4111-8111-111111111111';

describe('Admin RBAC integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AdminModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(AdminUsersService)
      .useValue(usersStub)
      .overrideProvider(AdminAuditService)
      .useValue(auditStub)
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

  const get = (path: string, role?: string) => {
    const req = request(app.getHttpServer()).get(path);
    return role
      ? req.set('x-test-role', role).set('x-test-sub', 'admin-1')
      : req;
  };

  const readEndpoints = ['/admin/users', `/admin/users/${ID}`, '/admin/audit'];

  describe.each(readEndpoints)('GET %s', (path) => {
    it.each([
      ['CUSTOMER', 403],
      ['AGENT', 403],
      ['MANAGER', 403],
      ['ADMIN', 200],
    ])('%s → %i', async (role, status) => {
      await get(path, role).expect(status);
    });

    it('401 without a session', async () => {
      await get(path).expect(401);
    });
  });

  describe('mutations require ADMIN', () => {
    it('AGENT is forbidden from creating a user (403)', async () => {
      await request(app.getHttpServer())
        .post('/admin/users')
        .set('x-test-role', 'AGENT')
        .send({})
        .expect(403);
    });

    it('ADMIN can create a user (201)', async () => {
      await request(app.getHttpServer())
        .post('/admin/users')
        .set('x-test-role', 'ADMIN')
        .send({
          email: 'new@demo.test',
          firstName: 'New',
          lastName: 'Person',
          password: 'Password1!',
          role: 'AGENT',
        })
        .expect(201);
      expect(usersStub.createUser).toHaveBeenCalled();
    });

    it('ADMIN can change a role and the actor is the authenticated admin', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/users/${ID}/role`)
        .set('x-test-role', 'ADMIN')
        .set('x-test-sub', 'admin-7')
        .send({ role: 'MANAGER' })
        .expect(200);
      const [viewer] = usersStub.changeRole.mock.calls.at(-1)!;
      expect(viewer).toMatchObject({ sub: 'admin-7', role: 'ADMIN' });
    });

    it('ADMIN can set status and revoke sessions', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/users/${ID}/status`)
        .set('x-test-role', 'ADMIN')
        .send({ isActive: false })
        .expect(200);
      await request(app.getHttpServer())
        .post(`/admin/users/${ID}/revoke-sessions`)
        .set('x-test-role', 'ADMIN')
        .expect(200);
    });

    it('MANAGER is forbidden from reviewing the audit log', async () => {
      await get('/admin/audit', 'MANAGER').expect(403);
    });

    it('rejects an invalid create payload from an admin with 400', async () => {
      await request(app.getHttpServer())
        .post('/admin/users')
        .set('x-test-role', 'ADMIN')
        .send({ email: 'not-an-email', firstName: '', password: '123' })
        .expect(400);
    });
  });
});
