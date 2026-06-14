import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { SLA_QUEUE_NAME } from './sla.constants';
import { SlaService } from './sla.service';

/**
 * Thin BullMQ adapter that runs the SLA scan on each repeatable tick. The
 * scan logic lives in SlaService so it can be unit-tested without BullMQ.
 */
@Processor(SLA_QUEUE_NAME)
export class SlaScanProcessor extends WorkerHost {
  private readonly logger = new Logger(SlaScanProcessor.name);

  constructor(@Inject(SlaService) private readonly slaService: SlaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    try {
      await this.slaService.runScan();
    } catch (error) {
      this.logger.error({
        event: 'sla.scan_failed',
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  @OnWorkerEvent('error')
  onWorkerError(error: Error): void {
    // Surface (don't crash on) Redis connection errors, mirroring the
    // notifications worker resilience added in M4.5.
    this.logger.error({
      event: 'sla.worker_error',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  @OnWorkerEvent('failed')
  onJobFailed(job: Job | undefined, error: Error): void {
    this.logger.warn({
      event: 'sla.scan_job_failed',
      jobId: job?.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
