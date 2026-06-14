import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/database/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { QueueModule } from '../queue/queue.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SlaModule } from '../sla/sla.module';
import { StorageModule } from '../storage/storage.module';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    QueueModule,
    RealtimeModule,
    SlaModule,
    AuditModule,
  ],
  controllers: [TicketsController],
  providers: [TicketsService, RolesGuard],
})
export class TicketsModule {}
