import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Query,
  Req,
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
import type { Request } from 'express';

import { validationPipeOptions } from '../../common/validation/validation.pipe-options';
import { AUTH_COOKIE_SECURITY_NAME } from '../auth/auth.constants';
import type { AccessTokenPayload } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  ReportAgentMetricsDto,
  ReportAssignmentRequestsDto,
  ReportMeDto,
  ReportOverviewDto,
  ReportQueueDto,
} from './dto/report-response.dto';
import { ReportWindowQueryDto } from './dto/reports-query.dto';
import { ReportsService } from './reports.service';

type AuthenticatedRequest = Request & { user: AccessTokenPayload };

const windowQueryPipe = new ValidationPipe({
  ...validationPipeOptions,
  expectedType: ReportWindowQueryDto,
});

@ApiTags('reports')
@ApiCookieAuth(AUTH_COOKIE_SECURITY_NAME)
@Controller('reports')
export class ReportsController {
  constructor(
    @Inject(ReportsService) private readonly reportsService: ReportsService,
  ) {}

  @Get('overview')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.MANAGER, RoleName.ADMIN)
  @ApiOperation({
    summary:
      'Workspace overview metrics (windowed) — counts, status/priority distribution, and SLA summaries. Manager-scoped or admin-global.',
  })
  @ApiOkResponse({ type: ReportOverviewDto })
  @ApiForbiddenResponse({ description: 'Managers and admins only.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  getOverview(
    @Req() request: AuthenticatedRequest,
    @Query(windowQueryPipe) query: ReportWindowQueryDto,
  ) {
    return this.reportsService.getOverview(
      request.user,
      query.windowDays,
      new Date(),
    );
  }

  @Get('queue')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.MANAGER, RoleName.ADMIN)
  @ApiOperation({
    summary:
      'Current open-queue health with a per-team breakdown. Manager-scoped or admin-global; excludes trashed tickets.',
  })
  @ApiOkResponse({ type: ReportQueueDto })
  @ApiForbiddenResponse({ description: 'Managers and admins only.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  getQueue(@Req() request: AuthenticatedRequest) {
    return this.reportsService.getQueue(request.user, new Date());
  }

  @Get('agent-metrics')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.MANAGER, RoleName.ADMIN)
  @ApiOperation({
    summary:
      'Per-agent productivity and SLA metrics for active staff. Manager-scoped to their teams or admin-global; no private user data.',
  })
  @ApiOkResponse({ type: ReportAgentMetricsDto })
  @ApiForbiddenResponse({ description: 'Managers and admins only.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  getAgentMetrics(
    @Req() request: AuthenticatedRequest,
    @Query(windowQueryPipe) query: ReportWindowQueryDto,
  ) {
    return this.reportsService.getAgentMetrics(
      request.user,
      query.windowDays,
      new Date(),
    );
  }

  @Get('me')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.AGENT, RoleName.MANAGER, RoleName.ADMIN)
  @ApiOperation({
    summary:
      'The authenticated staff user’s own metrics. Never accepts a userId; CUSTOMER is forbidden.',
  })
  @ApiOkResponse({ type: ReportMeDto })
  @ApiForbiddenResponse({ description: 'Customers cannot access reports.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  getMe(
    @Req() request: AuthenticatedRequest,
    @Query(windowQueryPipe) query: ReportWindowQueryDto,
  ) {
    return this.reportsService.getMe(
      request.user,
      query.windowDays,
      new Date(),
    );
  }

  @Get('assignment-requests')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.MANAGER, RoleName.ADMIN)
  @ApiOperation({
    summary:
      'Aggregate reassignment-request workflow metrics. Manager-scoped or admin-global; no request reasons or review notes.',
  })
  @ApiOkResponse({ type: ReportAssignmentRequestsDto })
  @ApiForbiddenResponse({ description: 'Managers and admins only.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  getAssignmentRequests(
    @Req() request: AuthenticatedRequest,
    @Query(windowQueryPipe) query: ReportWindowQueryDto,
  ) {
    return this.reportsService.getAssignmentRequests(
      request.user,
      query.windowDays,
      new Date(),
    );
  }
}
