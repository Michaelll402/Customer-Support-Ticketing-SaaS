import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { validationPipeOptions } from './common/validation/validation.pipe-options';

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.enableCors({
    credentials: true,
    origin: true,
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe(validationPipeOptions));

  const logger = app.get(Logger);
  app.useLogger(logger);

  const configService = app.get(ConfigService);
  const host = configService.getOrThrow<string>('app.host');
  const port = configService.getOrThrow<number>('app.port');
  const swaggerPath = configService.getOrThrow<string>('app.swaggerPath');

  const swaggerDocument = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Customer Support Ticketing SaaS API')
      .setDescription(
        'Milestone 0 platform baseline. Business endpoints are intentionally deferred.',
      )
      .setVersion('0.1.0')
      .build(),
  );

  SwaggerModule.setup(swaggerPath, app, swaggerDocument);

  await app.listen(port, host);

  logger.log(`API listening on http://${host}:${port}`);
  logger.log(`Swagger available on http://${host}:${port}/${swaggerPath}`);
};

void bootstrap();
