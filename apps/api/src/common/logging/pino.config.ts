import { randomUUID } from 'crypto';

import type { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino';

export const createPinoConfig = (configService: ConfigService): Params => {
  const environment = configService.get<string>('app.env', 'development');
  const prettyLogs = environment !== 'production';

  return {
    pinoHttp: {
      autoLogging: true,
      genReqId: (request) => {
        const requestId = request.headers['x-request-id'];
        return typeof requestId === 'string' && requestId.length > 0
          ? requestId
          : randomUUID();
      },
      level: prettyLogs ? 'debug' : 'info',
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
      ],
      transport: prettyLogs
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: true,
              translateTime: 'SYS:standard',
            },
          }
        : undefined,
    },
  };
};
