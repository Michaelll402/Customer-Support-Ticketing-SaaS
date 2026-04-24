import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/database/prisma.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [PrismaModule],
  controllers: [TicketsController],
  providers: [TicketsService, RolesGuard],
})
export class TicketsModule {}
