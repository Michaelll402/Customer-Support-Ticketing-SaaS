import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

@Module({
  imports: [AuthModule, UsersModule],
  providers: [RealtimeGateway, RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
