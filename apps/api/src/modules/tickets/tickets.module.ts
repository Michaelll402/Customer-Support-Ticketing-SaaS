import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/database/prisma.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StorageModule } from '../storage/storage.module';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [TicketsController],
  providers: [TicketsService, RolesGuard],
})
export class TicketsModule {}
