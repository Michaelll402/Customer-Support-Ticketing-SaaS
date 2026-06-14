import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/database/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PasswordService } from '../auth/password.service';
import { AdminAuditController } from './admin-audit.controller';
import { AdminAuditService } from './admin-audit.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AdminUsersController, AdminAuditController],
  providers: [
    AdminUsersService,
    AdminAuditService,
    PasswordService,
    RolesGuard,
  ],
})
export class AdminModule {}
