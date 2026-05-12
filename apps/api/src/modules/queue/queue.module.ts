import { BullModule } from '@nestjs/bullmq';
import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationsProcessor } from './notifications.processor';
import { NOTIFICATIONS_QUEUE_NAME } from './queue.constants';
import { QueueService } from './queue.service';

const isTestEnv = process.env.NODE_ENV === 'test';

const queueImports: DynamicModule[] = isTestEnv
  ? []
  : [
      BullModule.forRootAsync({
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          connection: {
            url: config.getOrThrow<string>('queue.redisUrl'),
          },
        }),
      }),
      BullModule.registerQueue({
        name: NOTIFICATIONS_QUEUE_NAME,
      }),
    ];

const queueProviders: Provider[] = isTestEnv
  ? [QueueService]
  : [QueueService, NotificationsProcessor];

@Module({
  imports: [...queueImports, NotificationsModule],
  providers: queueProviders,
  exports: [QueueService],
})
export class QueueModule {}
