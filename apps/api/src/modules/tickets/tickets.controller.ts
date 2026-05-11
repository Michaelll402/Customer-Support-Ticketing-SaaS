import {
  Patch,
  Query,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  ParseUUIDPipe,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RoleName, TicketPriority, TicketStatus } from '@prisma/client';
import type { Request } from 'express';

import { AUTH_COOKIE_SECURITY_NAME } from '../auth/auth.constants';
import type { AccessTokenPayload } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { validationPipeOptions } from '../../common/validation/validation.pipe-options';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import {
  AttachmentDownloadUrlDto,
  AttachmentUploadBodyDto,
  TicketAttachmentDto,
} from './dto/ticket-attachment.dto';
import { TicketCategoryOptionDto } from './dto/ticket-category-option.dto';
import { TicketDetailDto } from './dto/ticket-detail.dto';
import {
  SortOrder,
  TicketListQueryDto,
  TicketListSortBy,
} from './dto/ticket-list-query.dto';
import { TicketListResponseDto } from './dto/ticket-list-response.dto';
import { TicketMessageDto } from './dto/ticket-message.dto';
import { TicketTimelineDto } from './dto/ticket-timeline.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import {
  type TicketAttachmentUploadFile,
  TICKET_ATTACHMENT_MAX_BYTES,
  TicketsService,
} from './tickets.service';

type AuthenticatedRequest = Request & {
  user: AccessTokenPayload;
};

@ApiTags('tickets')
@ApiCookieAuth(AUTH_COOKIE_SECURITY_NAME)
@Controller('tickets')
export class TicketsController {
  constructor(
    @Inject(TicketsService)
    private readonly ticketsService: TicketsService,
  ) {}

  @Get()
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Return a paginated ticket list with role-scoped visibility, filters, and sorting.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: TicketStatus,
  })
  @ApiQuery({
    name: 'priority',
    required: false,
    enum: TicketPriority,
  })
  @ApiQuery({
    name: 'assigneeId',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'teamId',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: TicketListSortBy,
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: SortOrder,
  })
  @ApiOkResponse({
    description: 'Ticket list returned successfully.',
    type: TicketListResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is required.',
  })
  listTickets(
    @Req() request: AuthenticatedRequest,
    @Query(
      new ValidationPipe({
        ...validationPipeOptions,
        expectedType: TicketListQueryDto,
      }),
    )
    query: TicketListQueryDto,
  ) {
    return this.ticketsService.listTickets(request.user, query);
  }

  @Get('categories')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Return the read-only ticket category options used by ticket creation.',
  })
  @ApiOkResponse({
    description: 'Ticket categories returned successfully.',
    type: TicketCategoryOptionDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is required.',
  })
  listTicketCategories() {
    return this.ticketsService.listTicketCategories();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.CUSTOMER)
  @ApiOperation({
    summary: 'Create a new ticket for the authenticated customer.',
  })
  @ApiBody({
    type: CreateTicketDto,
  })
  @ApiCreatedResponse({
    description: 'Ticket created successfully.',
    type: TicketDetailDto,
  })
  @ApiForbiddenResponse({
    description: 'Only customers can create tickets.',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is required.',
  })
  createTicket(
    @Req() request: AuthenticatedRequest,
    @Body(
      new ValidationPipe({
        ...validationPipeOptions,
        expectedType: CreateTicketDto,
      }),
    )
    body: CreateTicketDto,
  ) {
    return this.ticketsService.createTicket(request.user, body);
  }

  @Post(':id/replies')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Add a public reply to a visible non-closed ticket. No automatic status changes are made and notifications remain deferred.',
  })
  @ApiBody({
    type: CreateTicketMessageDto,
  })
  @ApiCreatedResponse({
    description: 'Public reply created successfully.',
    type: TicketMessageDto,
  })
  @ApiBadRequestResponse({
    description:
      'The payload is invalid or the ticket is closed and cannot receive public replies.',
  })
  @ApiForbiddenResponse({
    description: 'The authenticated user cannot access this ticket.',
  })
  @ApiNotFoundResponse({
    description: 'Ticket was not found.',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is required.',
  })
  createPublicReply(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) ticketId: string,
    @Body(
      new ValidationPipe({
        ...validationPipeOptions,
        expectedType: CreateTicketMessageDto,
      }),
    )
    body: CreateTicketMessageDto,
  ) {
    return this.ticketsService.createPublicReply(ticketId, request.user, body);
  }

  @Post(':id/internal-notes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.AGENT, RoleName.MANAGER, RoleName.ADMIN)
  @ApiOperation({
    summary:
      'Add a staff-only internal note to a visible ticket. Internal notes are never available to customers.',
  })
  @ApiBody({
    type: CreateTicketMessageDto,
  })
  @ApiCreatedResponse({
    description: 'Internal note created successfully.',
    type: TicketMessageDto,
  })
  @ApiBadRequestResponse({
    description: 'The payload is invalid.',
  })
  @ApiForbiddenResponse({
    description:
      'Customers cannot create internal notes or the staff user cannot access this ticket.',
  })
  @ApiNotFoundResponse({
    description: 'Ticket was not found.',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is required.',
  })
  createInternalNote(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) ticketId: string,
    @Body(
      new ValidationPipe({
        ...validationPipeOptions,
        expectedType: CreateTicketMessageDto,
      }),
    )
    body: CreateTicketMessageDto,
  ) {
    return this.ticketsService.createInternalNote(ticketId, request.user, body);
  }

  @Post(':id/attachments')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: TICKET_ATTACHMENT_MAX_BYTES,
        files: 1,
      },
    }),
  )
  @ApiOperation({
    summary:
      'Upload one attachment to a visible ticket. The file is stored in object storage and only safe metadata is returned.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: AttachmentUploadBodyDto,
  })
  @ApiCreatedResponse({
    description: 'Attachment uploaded successfully.',
    type: TicketAttachmentDto,
  })
  @ApiBadRequestResponse({
    description:
      'The upload is missing, empty, too large, or uses a MIME type outside the supported allowlist.',
  })
  @ApiForbiddenResponse({
    description: 'The authenticated user cannot access this ticket.',
  })
  @ApiNotFoundResponse({
    description: 'Ticket was not found.',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is required.',
  })
  uploadTicketAttachment(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) ticketId: string,
    @UploadedFile() file: TicketAttachmentUploadFile | undefined,
  ) {
    return this.ticketsService.uploadTicketAttachment(
      ticketId,
      request.user,
      file,
    );
  }

  @Get(':ticketId/attachments/:attachmentId/download-url')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Return a short-lived signed download URL for an attachment on a visible ticket.',
  })
  @ApiOkResponse({
    description: 'Signed download URL returned successfully.',
    type: AttachmentDownloadUrlDto,
  })
  @ApiForbiddenResponse({
    description: 'The authenticated user cannot access this ticket.',
  })
  @ApiNotFoundResponse({
    description: 'Ticket or attachment was not found.',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is required.',
  })
  getTicketAttachmentDownloadUrl(
    @Req() request: AuthenticatedRequest,
    @Param('ticketId', new ParseUUIDPipe()) ticketId: string,
    @Param('attachmentId', new ParseUUIDPipe()) attachmentId: string,
  ) {
    return this.ticketsService.getTicketAttachmentDownloadUrl(
      ticketId,
      attachmentId,
      request.user,
    );
  }

  @Get(':id/timeline')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Return a chronological ticket timeline containing visible replies, staff notes, and system events.',
    description:
      'Customers never receive internal note entries or NOTE_ADDED system events. Attachments appear inline on the message they belong to, and signed download URLs are issued by the dedicated download-url endpoint.',
  })
  @ApiOkResponse({
    description: 'Ticket timeline returned successfully.',
    type: TicketTimelineDto,
  })
  @ApiForbiddenResponse({
    description: 'The authenticated user cannot access this ticket.',
  })
  @ApiNotFoundResponse({
    description: 'Ticket was not found.',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is required.',
  })
  getTicketTimeline(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) ticketId: string,
  ) {
    return this.ticketsService.getTicketTimeline(ticketId, request.user);
  }

  @Patch(':id')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.CUSTOMER)
  @ApiOperation({
    summary:
      'Update a customer-owned ticket within the limited customer-owned patch scope.',
  })
  @ApiBody({
    type: UpdateTicketDto,
  })
  @ApiOkResponse({
    description: 'Ticket updated successfully.',
    type: TicketDetailDto,
  })
  @ApiBadRequestResponse({
    description:
      'The patch payload is invalid or requests a customer status transition outside the allowed customer-owned scope.',
  })
  @ApiForbiddenResponse({
    description: 'Customers may only patch their own tickets.',
  })
  @ApiNotFoundResponse({
    description: 'Ticket was not found.',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is required.',
  })
  updateTicket(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) ticketId: string,
    @Body(
      new ValidationPipe({
        ...validationPipeOptions,
        expectedType: UpdateTicketDto,
      }),
    )
    body: UpdateTicketDto,
  ) {
    return this.ticketsService.updateTicket(ticketId, request.user, body);
  }

  @Get(':id')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Return ticket detail when the authenticated user has visibility.',
  })
  @ApiOkResponse({
    description: 'Ticket detail returned successfully.',
    type: TicketDetailDto,
  })
  @ApiForbiddenResponse({
    description: 'The authenticated user cannot access this ticket.',
  })
  @ApiNotFoundResponse({
    description: 'Ticket was not found.',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is required.',
  })
  getTicketById(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) ticketId: string,
  ) {
    return this.ticketsService.getTicketById(ticketId, request.user);
  }
}
