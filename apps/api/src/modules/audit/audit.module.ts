import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/database/prisma.module';
import { AuditService } from './audit.service';

@Module({
  imports: [PrismaModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
