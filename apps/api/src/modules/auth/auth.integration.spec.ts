import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { RoleName } from '@prisma/client';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../../common/database/prisma.service';
import { apiConfiguration } from '../../common/config/api.configuration';
import { validateApiEnv } from '../../common/config/env.validation';
import { validationPipeOptions } from '../../common/validation/validation.pipe-options';
import { AuthModule } from './auth.module';
import { Roles } from './decorators/roles.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

import {
  Controller,
  Get,
  UseGuards,
  type INestApplication,
} from '@nestjs/common';

@Controller('test-auth')
class TestAuthController {
  @Get('manager-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.MANAGER)
  managerOnly() {
    return { ok: true };
  }
}

interface StoredRole {
  id: string;
  name: RoleName;
}

interface StoredUser {
  email: string;
  firstName: string;
  id: string;
  isActive?: boolean;
  lastName: string;
  passwordHash: string;
  role: StoredRole;
  roleId: string;
  tokenVersion?: number;
}

const withUserDefaults = (user: StoredUser) => ({
  isActive: true,
  tokenVersion: 0,
  ...user,
});

interface MockUserCreateArgs {
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
}

interface MockUserFindUniqueArgs {
  where: {
    email?: string;
    id?: string;
  };
}

const createPrismaMock = () => {
  const roles = Object.values(RoleName).map((name, index) => ({
    id: `role-${index + 1}`,
    name,
  }));
  const users: StoredUser[] = [];

  return {
    roleStore: roles,
    userStore: users,
    user: {
      create: vi.fn(async ({ data }: MockUserCreateArgs) => {
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
          isActive: true,
          lastName: data.lastName,
          passwordHash: data.passwordHash,
          role,
          roleId: role.id,
          tokenVersion: 0,
        };

        users.push(user);

        return withUserDefaults(user);
      }),
      findUnique: vi.fn(async ({ where }: MockUserFindUniqueArgs) => {
        const found =
          (where.email
            ? users.find((user) => user.email === where.email)
            : where.id
              ? users.find((user) => user.id === where.id)
              : undefined) ?? null;

        return found ? withUserDefaults(found) : null;
      }),
    },
  };
};

describe('Auth integration', () => {
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
    process.env.JWT_SECRET = 'test-auth-secret';
    process.env.NODE_ENV = 'test';
    process.env.SWAGGER_PATH = 'api';
    process.env.WEB_APP_ORIGIN = 'http://localhost:3000';

    prismaMock = createPrismaMock();

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
      ],
      controllers: [TestAuthController],
      providers: [RolesGuard],
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

  it('registers a customer, sets the auth cookie, and returns the user payload', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'customer@example.test',
        firstName: 'Casey',
        lastName: 'Customer',
        password: 'Password1!',
      })
      .expect(201);

    expect(response.body).toEqual({
      user: {
        email: 'customer@example.test',
        firstName: 'Casey',
        id: expect.any(String),
        lastName: 'Customer',
        role: RoleName.CUSTOMER,
      },
    });
    expect(response.headers['set-cookie']?.[0]).toContain('access_token=');
  });

  it('rejects invalid register payloads with validation errors', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'not-an-email',
        firstName: '',
        lastName: '',
        password: 'short',
      })
      .expect(400);
  });

  it('logs in an existing user and returns /auth/me from the cookie-backed session', async () => {
    const agent = request.agent(app.getHttpServer());
    const agentRole =
      prismaMock.roleStore.find((role) => role.name === RoleName.AGENT) ?? null;

    if (!agentRole) {
      throw new Error('Agent role missing from test store.');
    }

    prismaMock.userStore.push({
      email: 'agent@demo.test',
      firstName: 'Avery',
      id: randomUUID(),
      lastName: 'Agent',
      passwordHash: await hash('Password1!', 12),
      role: agentRole,
      roleId: agentRole.id,
    });

    const loginResponse = await agent
      .post('/auth/login')
      .send({
        email: 'agent@demo.test',
        password: 'Password1!',
      })
      .expect(200);

    expect(loginResponse.body.user.role).toBe(RoleName.AGENT);

    const currentUserResponse = await agent.get('/auth/me').expect(200);

    expect(currentUserResponse.body).toEqual({
      email: 'agent@demo.test',
      firstName: 'Avery',
      id: expect.any(String),
      lastName: 'Agent',
      role: RoleName.AGENT,
    });
  });

  it('rejects invalid access token cookies on /auth/me', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', ['access_token=not-a-valid-token'])
      .expect(401);
  });

  it('clears the auth cookie on logout and invalidates the cookie-backed session', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/register')
      .send({
        email: 'logout@example.test',
        firstName: 'Log',
        lastName: 'Out',
        password: 'Password1!',
      })
      .expect(201);

    const logoutResponse = await agent.post('/auth/logout').expect(204);

    expect(logoutResponse.headers['set-cookie']?.[0]).toContain(
      'access_token=;',
    );

    await agent.get('/auth/me').expect(401);
  });

  it('returns 403 when an authenticated user lacks the required role', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/register')
      .send({
        email: 'customer@example.test',
        firstName: 'Casey',
        lastName: 'Customer',
        password: 'Password1!',
      })
      .expect(201);

    await agent.get('/test-auth/manager-only').expect(403);
  });

  const seedAgent = async (email: string): Promise<StoredUser> => {
    const agentRole = prismaMock.roleStore.find(
      (role) => role.name === RoleName.AGENT,
    );

    if (!agentRole) {
      throw new Error('Agent role missing from test store.');
    }

    const storedUser: StoredUser = {
      email,
      firstName: 'Avery',
      id: randomUUID(),
      lastName: 'Agent',
      passwordHash: await hash('Password1!', 12),
      role: agentRole,
      roleId: agentRole.id,
    };

    prismaMock.userStore.push(storedUser);

    return storedUser;
  };

  it('rejects a valid token whose user no longer exists', async () => {
    const agent = request.agent(app.getHttpServer());
    const storedUser = await seedAgent('ghost@demo.test');

    await agent
      .post('/auth/login')
      .send({ email: 'ghost@demo.test', password: 'Password1!' })
      .expect(200);
    await agent.get('/auth/me').expect(200);

    const index = prismaMock.userStore.indexOf(storedUser);
    prismaMock.userStore.splice(index, 1);

    await agent.get('/auth/me').expect(401);
  });

  it('returns 401 when a deactivated user attempts to log in', async () => {
    const storedUser = await seedAgent('inactive-login@demo.test');
    storedUser.isActive = false;

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'inactive-login@demo.test', password: 'Password1!' })
      .expect(401);

    expect(response.body.message).toBe('Invalid email or password.');
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('rejects an authenticated request once the user is deactivated', async () => {
    const agent = request.agent(app.getHttpServer());
    const storedUser = await seedAgent('deactivate@demo.test');

    await agent
      .post('/auth/login')
      .send({ email: 'deactivate@demo.test', password: 'Password1!' })
      .expect(200);
    await agent.get('/auth/me').expect(200);

    storedUser.isActive = false;

    await agent.get('/auth/me').expect(401);
  });

  it('rejects a token whose tokenVersion is stale', async () => {
    const agent = request.agent(app.getHttpServer());
    const storedUser = await seedAgent('revoke@demo.test');

    await agent
      .post('/auth/login')
      .send({ email: 'revoke@demo.test', password: 'Password1!' })
      .expect(200);
    await agent.get('/auth/me').expect(200);

    storedUser.tokenVersion = 1;

    await agent.get('/auth/me').expect(401);
  });

  it('authorizes against the fresh database role, not the stale token role', async () => {
    const agent = request.agent(app.getHttpServer());
    const customerRole = prismaMock.roleStore.find(
      (role) => role.name === RoleName.CUSTOMER,
    )!;
    const managerRole = prismaMock.roleStore.find(
      (role) => role.name === RoleName.MANAGER,
    )!;
    const storedUser: StoredUser = {
      email: 'promote@demo.test',
      firstName: 'Pat',
      id: randomUUID(),
      lastName: 'Customer',
      passwordHash: await hash('Password1!', 12),
      role: customerRole,
      roleId: customerRole.id,
    };
    prismaMock.userStore.push(storedUser);

    await agent
      .post('/auth/login')
      .send({ email: 'promote@demo.test', password: 'Password1!' })
      .expect(200);

    // The token was issued with the CUSTOMER role.
    await agent.get('/test-auth/manager-only').expect(403);

    // Promote the user in the database without re-issuing the token.
    storedUser.role = managerRole;
    storedUser.roleId = managerRole.id;

    // The same cookie now authorizes as MANAGER because validate() reads the
    // fresh database role.
    await agent.get('/test-auth/manager-only').expect(200);
  });
});
