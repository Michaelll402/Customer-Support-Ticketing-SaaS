import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, Optional } from '@nestjs/common';
import type { Queue } from 'bullmq';

import {
  NOTIFICATIONS_JOB_NAME,
  NOTIFICATIONS_QUEUE_NAME,
  type NotificationJobPayload,
} from './queue.constants';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @Optional()
    @InjectQueue(NOTIFICATIONS_QUEUE_NAME)
    private readonly notificationsQueue?: Queue<NotificationJobPayload>,
  ) {
    // BullMQ re-emits ioredis connection errors on the Queue instance. Without
    // a listener, an 'error' event on this EventEmitter would throw and crash
    // the API process when Redis is unavailable. Logging keeps the process and
    // all REST/WebSocket traffic alive while the queue degrades gracefully.
    if (typeof this.notificationsQueue?.on === 'function') {
      this.notificationsQueue.on('error', (error: Error) => {
        this.logger.error({
          event: 'notification.queue_error',
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  async enqueueNotification(
    payload: NotificationJobPayload,
    jobId?: string,
  ): Promise<void> {
    if (!this.notificationsQueue) {
      this.logger.warn({
        event: 'notification.enqueue_skipped',
        reason: 'queue_unavailable',
        notificationType: payload.type,
      });
      return;
    }

    try {
      await this.notificationsQueue.add(
        NOTIFICATIONS_JOB_NAME,
        payload,
        jobId ? { jobId } : undefined,
      );
    } catch (error) {
      this.logger.error({
        event: 'notification.enqueue_failed',
        error: error instanceof Error ? error.message : String(error),
        notificationType: payload.type,
      });
    }
  }
}
