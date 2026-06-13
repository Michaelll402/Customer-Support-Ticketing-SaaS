import { Inject, Injectable } from '@nestjs/common';

import type { HealthStatus } from '@customer-support/types';

import { PrismaService } from './common/database/prisma.service';
import { QueueService } from './modules/queue/queue.service';

export interface ReadinessStatus {
  status: 'ready' | 'not_ready';
  checks: {
    database: 'up' | 'down';
    queue: 'configured' | 'disabled';
  };
  timestamp: string;
}

@Injectable()
export class AppService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QueueService) private readonly queueService: QueueService,
  ) {}

  getHealth(): HealthStatus {
    return {
      service: 'customer-support-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness(): Promise<ReadinessStatus> {
    const database = await this.checkDatabase();

    return {
      status: database === 'up' ? 'ready' : 'not_ready',
      checks: {
        database,
        queue: this.queueService.getAvailability(),
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<'up' | 'down'> {
    try {
      // Lightweight connectivity probe. The raw error is intentionally
      // swallowed so the readiness response never leaks infrastructure details.
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }
}
