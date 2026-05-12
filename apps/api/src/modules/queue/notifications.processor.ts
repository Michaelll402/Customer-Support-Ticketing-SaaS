import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { NotificationsService } from '../notifications/notifications.service';
import {
  NOTIFICATIONS_QUEUE_NAME,
  type NotificationJobPayload,
} from './queue.constants';

@Processor(NOTIFICATIONS_QUEUE_NAME)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobPayload>): Promise<void> {
    const payload = job.data;

    if (
      !payload ||
      typeof payload.type !== 'string' ||
      !Array.isArray(payload.recipientUserIds) ||
      typeof payload.message !== 'string'
    ) {
      this.logger.warn({
        event: 'notification.job_payload_invalid',
        jobId: job.id,
        jobName: job.name,
      });
      return;
    }

    try {
      const created = await this.notificationsService.createForRecipients({
        message: payload.message,
        recipientUserIds: payload.recipientUserIds,
        ticketId: payload.ticketId ?? null,
        type: payload.type,
      });

      this.logger.debug({
        event: 'notification.job_processed',
        createdCount: created,
        jobId: job.id,
        notificationType: payload.type,
      });
    } catch (error) {
      this.logger.error({
        event: 'notification.job_failed',
        error: error instanceof Error ? error.message : String(error),
        jobId: job.id,
        notificationType: payload.type,
      });
      throw error;
    }
  }
}
