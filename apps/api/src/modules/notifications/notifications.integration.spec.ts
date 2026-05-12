import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { NotificationType, RoleName } from '@prisma/client';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiConfiguration } from '../../common/config/api.configuration';
import { validateApiEnv } from '../../common/config/env.validation';
import { validationPipeOptions } from '../../common/validation/validation.pipe-options';
import { PrismaService } from '../../common/database/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from './notifications.module';
import { NotificationsService } from './notifications.service';

import type { INestApplication } from '@nestjs/common';

interface StoredRole {
  id: string;
  name: RoleName;
}

interface StoredUser {
  email: string;
  firstName: string;
  id: string;
  lastName: string;
  passwordHash: string;
  role: StoredRole;
  roleId: string;
}

interface StoredNotification {
  createdAt: Date;
  id: string;
  isRead: boolean;
  message: string;
  ticketId: string | null;
  type: NotificationType;
  userId: string;
}

type NotificationWhere = {
  id?: string;
  userId?: string;
  isRead?: boolean;
};

type NotificationFindManyArgs = {
  where?: NotificationWhere;
  orderBy?: {
    createdAt?: 'asc' | 'desc';
  };
  skip?: number;
  take?: number;
};

type NotificationCountArgs = {
  where?: NotificationWhere;
};

type NotificationFindFirstArgs = {
  where?: NotificationWhere;
};

type NotificationUpdateArgs = {
  where: {
    id: string;
  };
  data: {
    isRead?: boolean;
  };
};

type NotificationUpdateManyArgs = {
  where?: NotificationWhere;
  data: {
    isRead?: boolean;
  };
};

type NotificationCreateManyArgs = {
  data: Array<{
    message: string;
    ticketId: string | null;
    type: NotificationType;
    userId: string;
  }>;
};

const matchNotification = (
  notification: StoredNotification,
  where: NotificationWhere | undefined,
) => {
  if (!where) return true;
  if (where.id !== undefined && notification.id !== where.id) return false;
  if (where.userId !== undefined && notification.userId !== where.userId) {
    return false;
  }
  if (where.isRead !== undefined && notification.isRead !== where.isRead) {
    return false;
  }
  return true;
};

const createPrismaMock = () => {
  const roles: StoredRole[] = Object.values(RoleName).map((name, index) => ({
    id: `role-${index + 1}`,
    name,
  }));
  const users: StoredUser[] = [];
  const notifications: StoredNotification[] = [];

  const notificationModel = {
    findMany: vi.fn(
      async ({ where, orderBy, skip, take }: NotificationFindManyArgs = {}) => {
        const filtered = notifications.filter((notification) =>
          matchNotification(notification, where),
        );
        const sorted = [...filtered].sort((left, right) => {
          if (orderBy?.createdAt === 'desc') {
            return right.createdAt.getTime() - left.createdAt.getTime();
          }
          if (orderBy?.createdAt === 'asc') {
            return left.createdAt.getTime() - right.createdAt.getTime();
          }
          return 0;
        });
        return sorted.slice(
          skip ?? 0,
          take === undefined ? undefined : (skip ?? 0) + take,
        );
      },
    ),
    count: vi.fn(
      async ({ where }: NotificationCountArgs = {}) =>
        notifications.filter((notification) =>
          matchNotification(notification, where),
        ).length,
    ),
    findFirst: vi.fn(
      async ({ where }: NotificationFindFirstArgs = {}) =>
        notifications.find((notification) =>
          matchNotification(notification, where),
        ) ?? null,
    ),
    update: vi.fn(async ({ where, data }: NotificationUpdateArgs) => {
      const target = notifications.find(
        (notification) => notification.id === where.id,
      );

      if (!target) {
        throw new Error('Notification not found in test store.');
      }

      if (data.isRead !== undefined) {
        target.isRead = data.isRead;
      }

      return target;
    }),
    updateMany: vi.fn(async ({ where, data }: NotificationUpdateManyArgs) => {
      let count = 0;
      for (const notification of notifications) {
        if (!matchNotification(notification, where)) continue;
        if (data.isRead !== undefined) {
          notification.isRead = data.isRead;
        }
        count += 1;
      }
      return { count };
    }),
    createMany: vi.fn(async ({ data }: NotificationCreateManyArgs) => {
      for (const entry of data) {
        notifications.push({
          createdAt: new Date(),
          id: randomUUID(),
          isRead: false,
          message: entry.message,
          ticketId: entry.ticketId,
          type: entry.type,
          userId: entry.userId,
        });
      }
      return { count: data.length };
    }),
  };

  const userModel = {
    create: vi.fn(
      async ({
        data,
      }: {
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
      }) => {
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
          lastName: data.lastName,
          passwordHash: data.passwordHash,
          role,
          roleId: role.id,
        };

        users.push(user);

        return user;
      },
    ),
    findUnique: vi.fn(
      async ({
        where,
      }: {
        where: {
          email?: string;
          id?: string;
        };
      }) => {
        if (where.email) {
          return users.find((user) => user.email === where.email) ?? null;
        }

        if (where.id) {
          return users.find((user) => user.id === where.id) ?? null;
        }

        return null;
      },
    ),
  };

  return {
    notificationStore: notifications,
    roleStore: roles,
    userStore: users,
    notification: notificationModel,
    user: userModel,
  };
};

describe('Notifications integration', () => {
  let app: INestApplication;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let originalEnv: NodeJS.ProcessEnv;
  let primaryUserId: string;
  let secondaryUserId: string;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    process.env.API_HOST = '127.0.0.1';
    process.env.API_PORT = '4200';
    process.env.AUTH_COOKIE_NAME = 'access_token';
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@localhost:5432/customer_support?schema=public';
    process.env.JWT_ACCESS_TOKEN_TTL_SECONDS = '3600';
    process.env.JWT_SECRET = 'test-notifications-secret';
    process.env.MINIO_ACCESS_KEY = 'minioadmin';
    process.env.MINIO_BUCKET = 'customer-support';
    process.env.MINIO_ENDPOINT = 'localhost';
    process.env.MINIO_PORT = '9000';
    process.env.MINIO_SECRET_KEY = 'minioadmin';
    process.env.MINIO_USE_SSL = 'false';
    process.env.NODE_ENV = 'test';
    process.env.SWAGGER_PATH = 'api';
    process.env.WEB_APP_ORIGIN = 'http://localhost:3000';

    prismaMock = createPrismaMock();

    const customerRole = prismaMock.roleStore.find(
      (role) => role.name === RoleName.CUSTOMER,
    )!;
    const passwordHash = await hash('Password1!', 12);

    const primaryUser: StoredUser = {
      email: 'primary@demo.test',
      firstName: 'Pat',
      id: randomUUID(),
      lastName: 'Primary',
      passwordHash,
      role: customerRole,
      roleId: customerRole.id,
    };
    prismaMock.userStore.push(primaryUser);
    primaryUserId = primaryUser.id;

    const secondaryUser: StoredUser = {
      email: 'secondary@demo.test',
      firstName: 'Sam',
      id: randomUUID(),
      lastName: 'Secondary',
      passwordHash,
      role: customerRole,
      roleId: customerRole.id,
    };
    prismaMock.userStore.push(secondaryUser);
    secondaryUserId = secondaryUser.id;

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
        NotificationsModule,
      ],
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

  const pushNotification = (
    overrides: Partial<StoredNotification> & Pick<StoredNotification, 'userId'>,
  ): StoredNotification => {
    const notification: StoredNotification = {
      createdAt: overrides.createdAt ?? new Date(),
      id: overrides.id ?? randomUUID(),
      isRead: overrides.isRead ?? false,
      message: overrides.message ?? 'You have a new notification.',
      ticketId: overrides.ticketId ?? null,
      type: overrides.type ?? NotificationType.TICKET_REPLIED,
      userId: overrides.userId,
    };
    prismaMock.notificationStore.push(notification);
    return notification;
  };

  const loginAsPrimary = async () => {
    const httpAgent = request.agent(app.getHttpServer());
    await httpAgent
      .post('/auth/login')
      .send({ email: 'primary@demo.test', password: 'Password1!' })
      .expect(200);
    return httpAgent;
  };

  it('requires authentication for GET /notifications', async () => {
    await request(app.getHttpServer()).get('/notifications').expect(401);
  });

  it('returns only the authenticated user notifications', async () => {
    pushNotification({
      userId: primaryUserId,
      message: 'Primary notification',
    });
    pushNotification({
      userId: secondaryUserId,
      message: 'Secondary notification',
    });

    const httpAgent = await loginAsPrimary();
    const response = await httpAgent.get('/notifications').expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      message: 'Primary notification',
    });
    expect(response.body.total).toBe(1);
  });

  it('does not leak another user notifications via pagination', async () => {
    pushNotification({ userId: secondaryUserId });
    pushNotification({ userId: secondaryUserId });
    pushNotification({ userId: primaryUserId });

    const httpAgent = await loginAsPrimary();
    const response = await httpAgent
      .get('/notifications')
      .query({ limit: 100 })
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    const userIds = (response.body.items as Array<{ id: string }>).map(
      (item) => item.id,
    );
    const foreignIds = prismaMock.notificationStore
      .filter((notification) => notification.userId === secondaryUserId)
      .map((notification) => notification.id);
    for (const foreignId of foreignIds) {
      expect(userIds).not.toContain(foreignId);
    }
  });

  it('returns stable pagination metadata for GET /notifications', async () => {
    for (let index = 0; index < 5; index += 1) {
      pushNotification({
        userId: primaryUserId,
        message: `Notification ${index}`,
        createdAt: new Date(2026, 4, 1, 10, index),
      });
    }

    const httpAgent = await loginAsPrimary();
    const response = await httpAgent
      .get('/notifications')
      .query({ page: 2, limit: 2 })
      .expect(200);

    expect(response.body).toMatchObject({
      total: 5,
      page: 2,
      limit: 2,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
    expect(response.body.items).toHaveLength(2);
  });

  it('filters to unread notifications when unreadOnly=true', async () => {
    pushNotification({ userId: primaryUserId, isRead: true });
    pushNotification({ userId: primaryUserId, isRead: false });
    pushNotification({ userId: primaryUserId, isRead: false });

    const httpAgent = await loginAsPrimary();
    const response = await httpAgent
      .get('/notifications')
      .query({ unreadOnly: 'true' })
      .expect(200);

    expect(response.body.items).toHaveLength(2);
    for (const item of response.body.items as Array<{ isRead: boolean }>) {
      expect(item.isRead).toBe(false);
    }
    expect(response.body.total).toBe(2);
  });

  it('returns the global unread count regardless of unreadOnly or pagination', async () => {
    for (let index = 0; index < 4; index += 1) {
      pushNotification({ userId: primaryUserId, isRead: false });
    }
    pushNotification({ userId: primaryUserId, isRead: true });
    pushNotification({ userId: secondaryUserId, isRead: false });

    const httpAgent = await loginAsPrimary();

    const unreadOnly = await httpAgent
      .get('/notifications')
      .query({ unreadOnly: 'true', limit: 1 })
      .expect(200);
    expect(unreadOnly.body.items).toHaveLength(1);
    expect(unreadOnly.body.total).toBe(4);
    expect(unreadOnly.body.unreadCount).toBe(4);

    const all = await httpAgent
      .get('/notifications')
      .query({ limit: 1 })
      .expect(200);
    expect(all.body.items).toHaveLength(1);
    expect(all.body.total).toBe(5);
    expect(all.body.unreadCount).toBe(4);
  });

  it('sorts notifications newest first by createdAt', async () => {
    const older = pushNotification({
      userId: primaryUserId,
      message: 'Older',
      createdAt: new Date('2026-04-01T10:00:00.000Z'),
    });
    const middle = pushNotification({
      userId: primaryUserId,
      message: 'Middle',
      createdAt: new Date('2026-04-02T10:00:00.000Z'),
    });
    const newest = pushNotification({
      userId: primaryUserId,
      message: 'Newest',
      createdAt: new Date('2026-04-03T10:00:00.000Z'),
    });

    const httpAgent = await loginAsPrimary();
    const response = await httpAgent.get('/notifications').expect(200);

    expect(
      (response.body.items as Array<{ id: string }>).map((item) => item.id),
    ).toEqual([newest.id, middle.id, older.id]);
  });

  it('marks a user notification as read via PATCH /notifications/:id/read', async () => {
    const notification = pushNotification({
      userId: primaryUserId,
      isRead: false,
    });

    const httpAgent = await loginAsPrimary();
    const response = await httpAgent
      .patch(`/notifications/${notification.id}/read`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: notification.id,
      isRead: true,
    });
    expect(notification.isRead).toBe(true);
  });

  it('is idempotent for an already-read notification', async () => {
    const notification = pushNotification({
      userId: primaryUserId,
      isRead: true,
    });

    const httpAgent = await loginAsPrimary();
    const response = await httpAgent
      .patch(`/notifications/${notification.id}/read`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: notification.id,
      isRead: true,
    });
    expect(prismaMock.notification.update).not.toHaveBeenCalled();
  });

  it('returns 404 when marking another user notification as read', async () => {
    const foreign = pushNotification({
      userId: secondaryUserId,
      isRead: false,
    });

    const httpAgent = await loginAsPrimary();
    await httpAgent.patch(`/notifications/${foreign.id}/read`).expect(404);

    expect(foreign.isRead).toBe(false);
  });

  it('returns 404 when marking a notification that does not exist', async () => {
    const httpAgent = await loginAsPrimary();
    await httpAgent
      .patch('/notifications/00000000-0000-4000-8000-000000000000/read')
      .expect(404);
  });

  it('marks all current-user notifications as read via PATCH /notifications/read-all', async () => {
    pushNotification({ userId: primaryUserId, isRead: false });
    pushNotification({ userId: primaryUserId, isRead: false });
    pushNotification({ userId: primaryUserId, isRead: true });

    const httpAgent = await loginAsPrimary();
    const response = await httpAgent
      .patch('/notifications/read-all')
      .expect(200);

    expect(response.body).toMatchObject({ updatedCount: 2 });
    const remaining = prismaMock.notificationStore.filter(
      (notification) =>
        notification.userId === primaryUserId && !notification.isRead,
    );
    expect(remaining).toHaveLength(0);
  });

  it('does not affect another user notifications when calling read-all', async () => {
    const primaryOne = pushNotification({
      userId: primaryUserId,
      isRead: false,
    });
    const secondaryOne = pushNotification({
      userId: secondaryUserId,
      isRead: false,
    });
    const secondaryTwo = pushNotification({
      userId: secondaryUserId,
      isRead: false,
    });

    const httpAgent = await loginAsPrimary();
    const response = await httpAgent
      .patch('/notifications/read-all')
      .expect(200);

    expect(response.body).toMatchObject({ updatedCount: 1 });
    expect(primaryOne.isRead).toBe(true);
    expect(secondaryOne.isRead).toBe(false);
    expect(secondaryTwo.isRead).toBe(false);
  });

  it('deduplicates recipient IDs in NotificationsService.createForRecipients', async () => {
    const service = app.get(NotificationsService);
    const count = await service.createForRecipients({
      message: 'Hello',
      recipientUserIds: [primaryUserId, primaryUserId, secondaryUserId],
      type: NotificationType.TICKET_REPLIED,
    });

    expect(count).toBe(2);
    expect(prismaMock.notificationStore).toHaveLength(2);
    const userIds = prismaMock.notificationStore.map((entry) => entry.userId);
    expect(userIds.sort()).toEqual([primaryUserId, secondaryUserId].sort());
  });

  it('creates zero notifications when the recipient list is empty', async () => {
    const service = app.get(NotificationsService);

    expect(
      await service.createForRecipients({
        message: 'Hello',
        recipientUserIds: [],
        type: NotificationType.TICKET_REPLIED,
      }),
    ).toBe(0);

    expect(
      await service.createForRecipients({
        message: 'Hello',
        recipientUserIds: ['', ''],
        type: NotificationType.TICKET_REPLIED,
      }),
    ).toBe(0);

    expect(prismaMock.notificationStore).toHaveLength(0);
    expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
  });

  it('uses notification.update only when the row is currently unread', async () => {
    const unread = pushNotification({
      userId: primaryUserId,
      isRead: false,
    });

    const httpAgent = await loginAsPrimary();
    await httpAgent.patch(`/notifications/${unread.id}/read`).expect(200);

    expect(prismaMock.notification.update).toHaveBeenCalledTimes(1);
  });
});
