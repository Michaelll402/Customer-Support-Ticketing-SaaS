import { forwardRef, Module } from '@nestjs/common';

import { PrismaModule } from '../../common/database/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SlaService } from './sla.service';

// QueueModule (which owns the BullMQ root connection and the SLA scan
// processor/scheduler) and SlaModule reference each other, so the cycle is
// resolved with forwardRef. The SLA queue worker lives in QueueModule alongside
// forRoot; SlaService lives here and is consumed by TicketsModule.
@Module({
  imports: [PrismaModule, RealtimeModule, forwardRef(() => QueueModule)],
  providers: [SlaService],
  exports: [SlaService],
})
export class SlaModule {}
