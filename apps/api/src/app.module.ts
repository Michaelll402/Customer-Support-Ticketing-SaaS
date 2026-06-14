import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { apiConfiguration } from './common/config/api.configuration';
import { validateApiEnv } from './common/config/env.validation';
import { createPinoConfig } from './common/logging/pino.config';
import {
  AdminModule,
  AssignmentRequestsModule,
  AttachmentsModule,
  AuditModule,
  AuthModule,
  NotificationsModule,
  QueueModule,
  RealtimeModule,
  SlaModule,
  StorageModule,
  TicketsModule,
  UsersModule,
} from './modules';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      load: [apiConfiguration],
      validate: validateApiEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: createPinoConfig,
    }),
    AuthModule,
    UsersModule,
    TicketsModule,
    AssignmentRequestsModule,
    NotificationsModule,
    AttachmentsModule,
    SlaModule,
    AuditModule,
    AdminModule,
    QueueModule,
    RealtimeModule,
    StorageModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
