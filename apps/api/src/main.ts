import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { validationPipeOptions } from './common/validation/validation.pipe-options';
import { AUTH_COOKIE_SECURITY_NAME } from './modules/auth/auth.constants';

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

const buildAllowedOrigins = (configuredOrigin: string): string[] => {
  try {
    const parsed = new URL(configuredOrigin);

    if (!LOCALHOST_HOSTNAMES.has(parsed.hostname)) {
      return [configuredOrigin];
    }

    const mirror = new URL(configuredOrigin);
    mirror.hostname =
      parsed.hostname === 'localhost' ? '127.0.0.1' : 'localhost';

    return [parsed.origin, mirror.origin];
  } catch {
    return [configuredOrigin];
  }
};

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe(validationPipeOptions));

  const logger = app.get(Logger);
  app.useLogger(logger);

  const configService = app.get(ConfigService);
  const host = configService.getOrThrow<string>('app.host');
  const port = configService.getOrThrow<number>('app.port');
  const swaggerPath = configService.getOrThrow<string>('app.swaggerPath');
  const authCookieName = configService.getOrThrow<string>('auth.cookieName');
  const webOrigin = configService.getOrThrow<string>('app.webOrigin');

  app.enableCors({
    credentials: true,
    origin: buildAllowedOrigins(webOrigin),
  });

  const swaggerDocument = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Customer Support Ticketing SaaS API')
      .setDescription(
        'Customer Support / Ticketing SaaS API. Auth, ticket core, conversation, internal notes, and attachments are implemented. Workflow actions, notifications, realtime, SLA, and dashboards remain deferred.',
      )
      .setVersion('0.1.0')
      .addCookieAuth(
        authCookieName,
        {
          in: 'cookie',
          name: authCookieName,
          type: 'apiKey',
        },
        AUTH_COOKIE_SECURITY_NAME,
      )
      .build(),
  );

  SwaggerModule.setup(swaggerPath, app, swaggerDocument);

  await app.listen(port, host);

  logger.log(`API listening on http://${host}:${port}`);
  logger.log(`Swagger available on http://${host}:${port}/${swaggerPath}`);
};

void bootstrap();
