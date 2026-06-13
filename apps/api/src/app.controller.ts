import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { HealthStatus } from '@customer-support/types';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AppService, type ReadinessStatus } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth(): HealthStatus {
    return this.appService.getHealth();
  }

  @Get('health/ready')
  async getReadiness(
    @Res({ passthrough: true }) response: Response,
  ): Promise<ReadinessStatus> {
    const readiness = await this.appService.getReadiness();

    response.status(
      readiness.status === 'ready'
        ? HttpStatus.OK
        : HttpStatus.SERVICE_UNAVAILABLE,
    );

    return readiness;
  }
}
