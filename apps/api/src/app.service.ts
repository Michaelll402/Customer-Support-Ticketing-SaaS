import { Injectable } from '@nestjs/common';

import type { HealthStatus } from '@customer-support/types';

@Injectable()
export class AppService {
  getHealth(): HealthStatus {
    return {
      service: 'customer-support-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
