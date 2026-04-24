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
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
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
import { TicketCategoryOptionDto } from './dto/ticket-category-option.dto';
import { TicketDetailDto } from './dto/ticket-detail.dto';
import {
  SortOrder,
  TicketListQueryDto,
  TicketListSortBy,
} from './dto/ticket-list-query.dto';
import { TicketListResponseDto } from './dto/ticket-list-response.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketsService } from './tickets.service';

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
      'Return the read-only ticket category options used by Milestone 2 ticket creation.',
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
    description: 'Only customers can create tickets in Milestone 2.',
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

  @Patch(':id')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.CUSTOMER)
  @ApiOperation({
    summary:
      'Update a customer-owned ticket with the narrow Milestone 2 patch scope.',
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
      'The patch payload is invalid or requests a customer status transition outside the allowed Milestone 2 scope.',
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
