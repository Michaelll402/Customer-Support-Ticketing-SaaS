import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/database/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { QueueModule } from '../queue/queue.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AssignmentRequestsController } from './assignment-requests.controller';
import { AssignmentRequestsService } from './assignment-requests.service';

@Module({
  imports: [PrismaModule, QueueModule, RealtimeModule, AuditModule],
  controllers: [AssignmentRequestsController],
  providers: [AssignmentRequestsService, RolesGuard],
})
export class AssignmentRequestsModule {}
