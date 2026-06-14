import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';

import {
  SLA_QUEUE_NAME,
  SLA_SCAN_INTERVAL_MS,
  SLA_SCAN_JOB_NAME,
} from './sla.constants';

/**
 * Registers the repeatable SLA scan job once on boot. BullMQ deduplicates
 * repeatable jobs by name + repeat options, so re-adding on every restart is
 * idempotent and does not stack duplicate schedules.
 */
@Injectable()
export class SlaScheduler implements OnModuleInit {
  private readonly logger = new Logger(SlaScheduler.name);

  constructor(@InjectQueue(SLA_QUEUE_NAME) private readonly slaQueue: Queue) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.slaQueue.add(
        SLA_SCAN_JOB_NAME,
        {},
        { repeat: { every: SLA_SCAN_INTERVAL_MS } },
      );
      this.logger.log({
        event: 'sla.scan_scheduled',
        everyMs: SLA_SCAN_INTERVAL_MS,
      });
    } catch (error) {
      // A Redis outage at boot must not stop the API from serving REST traffic.
      this.logger.error({
        event: 'sla.scan_schedule_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
