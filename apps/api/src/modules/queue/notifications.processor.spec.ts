import 'reflect-metadata';

import { NotificationType } from '@prisma/client';
import type { Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificationsService } from '../notifications/notifications.service';
import { NotificationsProcessor } from './notifications.processor';
import {
  NOTIFICATIONS_JOB_NAME,
  type NotificationJobPayload,
} from './queue.constants';

const buildJob = (
  data: Partial<NotificationJobPayload> | unknown,
  overrides: Partial<Pick<Job<NotificationJobPayload>, 'id' | 'name'>> = {},
): Job<NotificationJobPayload> =>
  ({
    data,
    id: overrides.id ?? 'job-1',
    name: overrides.name ?? NOTIFICATIONS_JOB_NAME,
  }) as unknown as Job<NotificationJobPayload>;

describe('NotificationsProcessor', () => {
  let createForRecipients: ReturnType<typeof vi.fn>;
  let processor: NotificationsProcessor;

  beforeEach(() => {
    createForRecipients = vi.fn().mockResolvedValue(2);
    const notificationsService = {
      createForRecipients,
    } as unknown as NotificationsService;
    processor = new NotificationsProcessor(notificationsService);
  });

  it('invokes NotificationsService.createForRecipients with the job payload', async () => {
    const payload: NotificationJobPayload = {
      message: 'A new public reply was added to ticket #1.',
      recipientUserIds: [
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
      ],
      ticketId: '00000000-0000-4000-8000-000000000003',
      type: NotificationType.TICKET_REPLIED,
    };

    await processor.process(buildJob(payload));

    expect(createForRecipients).toHaveBeenCalledWith({
      message: payload.message,
      recipientUserIds: payload.recipientUserIds,
      ticketId: payload.ticketId,
      type: payload.type,
    });
  });

  it('uses null ticketId when the payload omits it', async () => {
    const payload = {
      message: 'A new notification.',
      recipientUserIds: ['00000000-0000-4000-8000-000000000001'],
      type: NotificationType.TICKET_ASSIGNED,
    } as NotificationJobPayload;

    await processor.process(buildJob(payload));

    expect(createForRecipients).toHaveBeenCalledWith(
      expect.objectContaining({ ticketId: null }),
    );
  });

  it('skips malformed payloads without throwing or calling the service', async () => {
    await expect(
      processor.process(buildJob(undefined as unknown)),
    ).resolves.toBeUndefined();
    await expect(
      processor.process(
        buildJob({ recipientUserIds: ['x'], message: 'm' } as unknown),
      ),
    ).resolves.toBeUndefined();
    await expect(
      processor.process(
        buildJob({
          type: NotificationType.TICKET_REPLIED,
          message: 'm',
        } as unknown),
      ),
    ).resolves.toBeUndefined();

    expect(createForRecipients).not.toHaveBeenCalled();
  });

  it('propagates service failures so BullMQ can apply its retry policy', async () => {
    createForRecipients.mockRejectedValueOnce(new Error('DB unavailable'));

    await expect(
      processor.process(
        buildJob({
          message: 'A new notification.',
          recipientUserIds: ['00000000-0000-4000-8000-000000000001'],
          ticketId: null,
          type: NotificationType.TICKET_ASSIGNED,
        }),
      ),
    ).rejects.toThrow('DB unavailable');
  });
});
