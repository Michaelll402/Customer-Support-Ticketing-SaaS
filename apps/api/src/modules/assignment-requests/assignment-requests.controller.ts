import {
  Body,
  Controller,
  Delete,
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
import { AssignmentRequestsService } from './assignment-requests.service';
import { AssignmentRequestDto } from './dto/assignment-request.dto';
import { AssignmentRequestListQueryDto } from './dto/assignment-request-list-query.dto';
import {
  ApproveAssignmentRequestDto,
  RejectAssignmentRequestDto,
} from './dto/review-assignment-request.dto';
import { CreateAssignmentRequestDto } from './dto/create-assignment-request.dto';

type AuthenticatedRequest = Request & {
  user: AccessTokenPayload;
};

@ApiTags('assignment-requests')
@ApiCookieAuth(AUTH_COOKIE_SECURITY_NAME)
@Controller()
export class AssignmentRequestsController {
  constructor(
    @Inject(AssignmentRequestsService)
    private readonly service: AssignmentRequestsService,
  ) {}

  @Post('tickets/:ticketId/assignment-requests')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.AGENT)
  @ApiOperation({
    summary:
      'Submit a reassignment request for an owned ticket (agent only). The ticket stays assigned to the requester until a manager or admin approves it.',
  })
  @ApiCreatedResponse({
    description: 'Assignment request created.',
    type: AssignmentRequestDto,
  })
  @ApiBadRequestResponse({ description: 'The request payload is invalid.' })
  @ApiForbiddenResponse({
    description:
      'Only the current assignee (an agent) may request a reassignment.',
  })
  @ApiNotFoundResponse({ description: 'Ticket was not found.' })
  @ApiConflictResponse({
    description: 'A pending request already exists for this ticket.',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  createForTicket(
    @Req() request: AuthenticatedRequest,
    @Param('ticketId', new ParseUUIDPipe()) ticketId: string,
    @Body(
      new ValidationPipe({
        ...validationPipeOptions,
        expectedType: CreateAssignmentRequestDto,
      }),
    )
    body: CreateAssignmentRequestDto,
  ) {
    return this.service.createForTicket(ticketId, request.user, body);
  }

  @Delete('tickets/:ticketId/assignment-requests/:requestId')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.AGENT)
  @ApiOperation({
    summary:
      'Cancel your own still-pending reassignment request. The ticket is unaffected.',
  })
  @ApiOkResponse({
    description: 'Assignment request cancelled.',
    type: AssignmentRequestDto,
  })
  @ApiForbiddenResponse({
    description: 'You can only cancel your own requests.',
  })
  @ApiNotFoundResponse({ description: 'Assignment request was not found.' })
  @ApiConflictResponse({
    description: 'The request has already been reviewed or cancelled.',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  cancelForTicket(
    @Req() request: AuthenticatedRequest,
    @Param('ticketId', new ParseUUIDPipe()) ticketId: string,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
  ) {
    return this.service.cancelForTicket(ticketId, requestId, request.user);
  }

  @Get('tickets/:ticketId/assignment-requests')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.AGENT, RoleName.MANAGER, RoleName.ADMIN)
  @ApiOperation({
    summary:
      'List assignment requests for a ticket. Agents see only their own; managers see team-scoped; admins see all. Never available to customers.',
  })
  @ApiOkResponse({
    description: 'Assignment requests for the ticket.',
    type: AssignmentRequestDto,
    isArray: true,
  })
  @ApiForbiddenResponse({ description: 'Customers cannot access this route.' })
  @ApiNotFoundResponse({ description: 'Ticket was not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  listForTicket(
    @Req() request: AuthenticatedRequest,
    @Param('ticketId', new ParseUUIDPipe()) ticketId: string,
  ) {
    return this.service.listForTicket(ticketId, request.user);
  }

  @Get('assignment-requests')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.MANAGER, RoleName.ADMIN)
  @ApiOperation({
    summary:
      'List assignment requests to review. Defaults to PENDING. Managers see only requests for tickets in their teams; admins see all.',
  })
  @ApiOkResponse({
    description: 'Assignment requests for review.',
    type: AssignmentRequestDto,
    isArray: true,
  })
  @ApiForbiddenResponse({
    description: 'Only managers and admins can review requests.',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  listForReviewer(
    @Req() request: AuthenticatedRequest,
    @Query(
      new ValidationPipe({
        ...validationPipeOptions,
        expectedType: AssignmentRequestListQueryDto,
      }),
    )
    query: AssignmentRequestListQueryDto,
  ) {
    return this.service.listForReviewer(request.user, query);
  }

  @Patch('assignment-requests/:id/approve')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.MANAGER, RoleName.ADMIN)
  @ApiOperation({
    summary:
      'Approve a pending request, applying the reassignment (or returning the ticket to its team queue). Revalidates state and returns 409 if it changed.',
  })
  @ApiOkResponse({
    description: 'Request approved and applied.',
    type: AssignmentRequestDto,
  })
  @ApiForbiddenResponse({
    description: 'The reviewer is out of scope for this ticket.',
  })
  @ApiNotFoundResponse({ description: 'Assignment request was not found.' })
  @ApiConflictResponse({
    description: 'The request or ticket state changed since the request.',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  approve(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(
      new ValidationPipe({
        ...validationPipeOptions,
        expectedType: ApproveAssignmentRequestDto,
      }),
    )
    body: ApproveAssignmentRequestDto,
  ) {
    return this.service.approve(id, request.user, body.reviewNote);
  }

  @Patch('assignment-requests/:id/reject')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.MANAGER, RoleName.ADMIN)
  @ApiOperation({
    summary:
      'Reject a pending request with a required note. The ticket assignee is unchanged.',
  })
  @ApiOkResponse({
    description: 'Request rejected.',
    type: AssignmentRequestDto,
  })
  @ApiBadRequestResponse({ description: 'A review note is required.' })
  @ApiForbiddenResponse({
    description: 'The reviewer is out of scope for this ticket.',
  })
  @ApiNotFoundResponse({ description: 'Assignment request was not found.' })
  @ApiConflictResponse({ description: 'The request is no longer pending.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  reject(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(
      new ValidationPipe({
        ...validationPipeOptions,
        expectedType: RejectAssignmentRequestDto,
      }),
    )
    body: RejectAssignmentRequestDto,
  ) {
    return this.service.reject(id, request.user, body.reviewNote);
  }
}
