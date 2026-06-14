import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
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
import { AdminUsersService } from './admin-users.service';
import { AdminUserDto, AdminUserListResponseDto } from './dto/admin-user.dto';
import {
  AdminUserListQueryDto,
  CreateAdminUserDto,
  UpdateAdminUserProfileDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
  UpdateUserTeamsDto,
} from './dto/admin-user-input.dto';

type AuthenticatedRequest = Request & { user: AccessTokenPayload };

const bodyPipe = <T>(expectedType: new () => T) =>
  new ValidationPipe({ ...validationPipeOptions, expectedType });

@ApiTags('admin-users')
@ApiCookieAuth(AUTH_COOKIE_SECURITY_NAME)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.ADMIN)
@ApiForbiddenResponse({ description: 'Admins only.' })
@ApiUnauthorizedResponse({ description: 'Authentication is required.' })
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    @Inject(AdminUsersService) private readonly service: AdminUsersService,
  ) {}

  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'List users with search/role/active filters.' })
  @ApiOkResponse({ type: AdminUserListResponseDto })
  listUsers(
    @Query(
      new ValidationPipe({
        ...validationPipeOptions,
        expectedType: AdminUserListQueryDto,
      }),
    )
    query: AdminUserListQueryDto,
  ) {
    return this.service.listUsers(query);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a user with a role and optional teams.' })
  @ApiCreatedResponse({ type: AdminUserDto })
  @ApiBadRequestResponse({ description: 'Invalid payload or unknown team.' })
  @ApiConflictResponse({ description: 'Email already in use.' })
  createUser(
    @Req() request: AuthenticatedRequest,
    @Body(bodyPipe(CreateAdminUserDto)) body: CreateAdminUserDto,
  ) {
    return this.service.createUser(request.user, body);
  }

  @Get(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get a single user.' })
  @ApiOkResponse({ type: AdminUserDto })
  @ApiNotFoundResponse({ description: 'User not found.' })
  getUser(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getUser(id);
  }

  @Patch(':id')
  @HttpCode(200)
  @ApiOperation({ summary: "Update a user's profile (name)." })
  @ApiOkResponse({ type: AdminUserDto })
  @ApiNotFoundResponse({ description: 'User not found.' })
  updateProfile(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(bodyPipe(UpdateAdminUserProfileDto)) body: UpdateAdminUserProfileDto,
  ) {
    return this.service.updateProfile(request.user, id, body);
  }

  @Patch(':id/role')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Change a user role. Revokes their sessions; last-admin protected.',
  })
  @ApiOkResponse({ type: AdminUserDto })
  @ApiConflictResponse({ description: 'Cannot remove the last active admin.' })
  @ApiNotFoundResponse({ description: 'User not found.' })
  changeRole(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(bodyPipe(UpdateUserRoleDto)) body: UpdateUserRoleDto,
  ) {
    return this.service.changeRole(request.user, id, body);
  }

  @Patch(':id/status')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Activate or deactivate a user. Deactivation revokes sessions; self/last-admin protected.',
  })
  @ApiOkResponse({ type: AdminUserDto })
  @ApiBadRequestResponse({ description: 'Cannot deactivate your own account.' })
  @ApiConflictResponse({
    description: 'Cannot deactivate the last active admin.',
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  setStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(bodyPipe(UpdateUserStatusDto)) body: UpdateUserStatusDto,
  ) {
    return this.service.setStatus(request.user, id, body);
  }

  @Patch(':id/teams')
  @HttpCode(200)
  @ApiOperation({ summary: "Replace a user's team memberships." })
  @ApiOkResponse({ type: AdminUserDto })
  @ApiBadRequestResponse({ description: 'One or more teams do not exist.' })
  @ApiNotFoundResponse({ description: 'User not found.' })
  updateTeams(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(bodyPipe(UpdateUserTeamsDto)) body: UpdateUserTeamsDto,
  ) {
    return this.service.updateTeams(request.user, id, body);
  }

  @Post(':id/revoke-sessions')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Force the user to re-authenticate (bumps tokenVersion).',
  })
  @ApiOkResponse({ type: AdminUserDto })
  @ApiNotFoundResponse({ description: 'User not found.' })
  revokeSessions(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.revokeSessions(request.user, id);
  }
}
