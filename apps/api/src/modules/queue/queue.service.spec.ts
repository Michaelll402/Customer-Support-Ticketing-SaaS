import 'reflect-metadata';

import { NotificationType } from '@prisma/client';
import type { Queue } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NOTIFICATIONS_JOB_NAME,
  type NotificationJobPayload,
} from './queue.constants';
import { QueueService } from './queue.service';

const samplePayload: NotificationJobPayload = {
  message: 'A new public reply was added to ticket #42.',
  recipientUserIds: ['00000000-0000-4000-8000-000000000001'],
  ticketId: '00000000-0000-4000-8000-000000000002',
  type: NotificationType.TICKET_REPLIED,
};

describe('QueueService', () => {
  let queueAdd: ReturnType<typeof vi.fn>;
  let queue: Queue<NotificationJobPayload>;
  let service: QueueService;

  beforeEach(() => {
    queueAdd = vi.fn().mockResolvedValue(undefined);
    queue = { add: queueAdd } as unknown as Queue<NotificationJobPayload>;
    service = new QueueService(queue);
  });

  it('calls queue.add with the notifications.create job name and payload', async () => {
    await service.enqueueNotification(samplePayload);

    expect(queueAdd).toHaveBeenCalledTimes(1);
    expect(queueAdd).toHaveBeenCalledWith(
      NOTIFICATIONS_JOB_NAME,
      samplePayload,
      undefined,
    );
  });

  it('forwards the provided jobId to queue.add for idempotency', async () => {
    await service.enqueueNotification(samplePayload, 'event-uuid');

    expect(queueAdd).toHaveBeenCalledWith(
      NOTIFICATIONS_JOB_NAME,
      samplePayload,
      {
        jobId: 'event-uuid',
      },
    );
  });

  it('catches queue.add errors and does not rethrow to callers', async () => {
    queueAdd.mockRejectedValueOnce(new Error('Redis connection refused'));

    await expect(
      service.enqueueNotification(samplePayload, 'event-uuid'),
    ).resolves.toBeUndefined();
  });

  it('logs and skips enqueue when the queue dependency is unavailable', async () => {
    const noQueueService = new QueueService();

    await expect(
      noQueueService.enqueueNotification(samplePayload),
    ).resolves.toBeUndefined();
  });
});
