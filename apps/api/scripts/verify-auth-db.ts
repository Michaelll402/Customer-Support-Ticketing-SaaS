import 'reflect-metadata';

import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, RoleName } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { validationPipeOptions } from '../src/common/validation/validation.pipe-options';

const loadLocalApiEnv = () => {
  const envPath = resolve(__dirname, '..', '.env');

  if (!existsSync(envPath)) {
    return;
  }

  process.loadEnvFile(envPath);
};

const applyDefaultEnv = () => {
  process.env.NODE_ENV ??= 'test';
  process.env.API_HOST ??= '127.0.0.1';
  process.env.API_PORT ??= '4100';
  process.env.AUTH_COOKIE_NAME ??= 'access_token';
  process.env.JWT_ACCESS_TOKEN_TTL_SECONDS ??= '3600';
  process.env.JWT_SECRET ??= 'local-auth-db-verification-secret';
  process.env.SWAGGER_PATH ??= 'api';
  process.env.WEB_APP_ORIGIN ??= 'http://localhost:3000';
};

const ensureDatabaseUrl = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is required for verify:auth:db. Point it at a real PostgreSQL database before running this verification.',
    );
  }
};

const ensureRoles = async (prisma: PrismaClient) => {
  for (const roleName of Object.values(RoleName)) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }
};

const verifyAuthFlow = async () => {
  loadLocalApiEnv();
  applyDefaultEnv();
  ensureDatabaseUrl();

  const prisma = new PrismaClient();
  const email = `auth-db-${randomUUID()}@example.test`;
  let app: INestApplication | undefined;

  try {
    await ensureRoles(prisma);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe(validationPipeOptions));

    await app.init();

    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/register')
      .send({
        email,
        firstName: 'Database',
        lastName: 'Verifier',
        password: 'Password1!',
      })
      .expect(201);

    await agent.get('/auth/me').expect(200);
    await agent.post('/auth/logout').expect(204);
    await agent.get('/auth/me').expect(401);

    await agent
      .post('/auth/login')
      .send({
        email,
        password: 'Password1!',
      })
      .expect(200);

    await agent.get('/auth/me').expect(200);

    console.log('Real DB-backed auth verification passed.');
  } finally {
    await prisma.user.deleteMany({
      where: { email },
    });
    await app?.close();
    await prisma.$disconnect();
  }
};

verifyAuthFlow().catch((error) => {
  console.error('Real DB-backed auth verification failed.');
  console.error(error);
  process.exitCode = 1;
});
