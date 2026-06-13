import 'reflect-metadata';

import {
  Controller,
  Get,
  UseGuards,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { afterEach, beforeEach, describe, it } from 'vitest';

// A throttled probe route that mirrors how the auth routes are guarded. The
// real /auth/login and /auth/register carry the same ThrottlerGuard + @Throttle,
// but their throttler is skipped under NODE_ENV=test (so the login-heavy
// integration suites are not rate limited); this module configures its own
// throttler without that skip so the mechanism is genuinely exercised here.
@Controller('throttle-probe')
class ThrottleProbeController {
  @Get()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  ping() {
    return { ok: true };
  }
}

describe('Auth rate limiting (ThrottlerGuard)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ ttl: 60_000, limit: 2 }],
        }),
      ],
      controllers: [ThrottleProbeController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('allows requests up to the limit and rejects further ones with 429', async () => {
    const server = app.getHttpServer();

    await request(server).get('/throttle-probe').expect(200);
    await request(server).get('/throttle-probe').expect(200);
    await request(server).get('/throttle-probe').expect(429);
  });
});
