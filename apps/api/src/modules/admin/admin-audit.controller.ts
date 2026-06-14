import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RoleName } from '@prisma/client';

import { validationPipeOptions } from '../../common/validation/validation.pipe-options';
import { AUTH_COOKIE_SECURITY_NAME } from '../auth/auth.constants';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminAuditService } from './admin-audit.service';
import {
  AuditLogListQueryDto,
  AuditLogListResponseDto,
} from './dto/audit-log.dto';

@ApiTags('admin-audit')
@ApiCookieAuth(AUTH_COOKIE_SECURITY_NAME)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.ADMIN)
@ApiForbiddenResponse({ description: 'Admins only.' })
@ApiUnauthorizedResponse({ description: 'Authentication is required.' })
@Controller('admin/audit')
export class AdminAuditController {
  constructor(
    @Inject(AdminAuditService) private readonly service: AdminAuditService,
  ) {}

  @Get()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'List audit-log entries, newest first, with actor/action/target/date filters.',
  })
  @ApiOkResponse({ type: AuditLogListResponseDto })
  listAuditLogs(
    @Query(
      new ValidationPipe({
        ...validationPipeOptions,
        expectedType: AuditLogListQueryDto,
      }),
    )
    query: AuditLogListQueryDto,
  ) {
    return this.service.listAuditLogs(query);
  }
}
