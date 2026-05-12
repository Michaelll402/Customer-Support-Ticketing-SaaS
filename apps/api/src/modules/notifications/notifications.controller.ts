import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { AUTH_COOKIE_SECURITY_NAME } from '../auth/auth.constants';
import type { AccessTokenPayload } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { validationPipeOptions } from '../../common/validation/validation.pipe-options';
import { MarkAllNotificationsReadResponseDto } from './dto/mark-all-notifications-read-response.dto';
import { NotificationDto } from './dto/notification.dto';
import { NotificationListQueryDto } from './dto/notification-list-query.dto';
import { NotificationListResponseDto } from './dto/notification-list-response.dto';
import { NotificationsService } from './notifications.service';

type AuthenticatedRequest = Request & {
  user: AccessTokenPayload;
};

@ApiTags('notifications')
@ApiCookieAuth(AUTH_COOKIE_SECURITY_NAME)
@Controller('notifications')
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Return paginated notifications for the authenticated user, newest first.',
  })
  @ApiOkResponse({
    description: 'Notifications returned successfully.',
    type: NotificationListResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is required.',
  })
  listNotifications(
    @Req() request: AuthenticatedRequest,
    @Query(
      new ValidationPipe({
        ...validationPipeOptions,
        expectedType: NotificationListQueryDto,
      }),
    )
    query: NotificationListQueryDto,
  ) {
    return this.notificationsService.listForUser(request.user.sub, query);
  }

  @Patch('read-all')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Mark all unread notifications as read for the authenticated user.',
  })
  @ApiOkResponse({
    description:
      'All unread notifications for the authenticated user have been marked as read.',
    type: MarkAllNotificationsReadResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is required.',
  })
  markAllRead(@Req() request: AuthenticatedRequest) {
    return this.notificationsService.markAllRead(request.user.sub);
  }

  @Patch(':id/read')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Mark a single notification as read. Returns 404 if the notification belongs to another user or does not exist.',
  })
  @ApiOkResponse({
    description: 'Notification marked as read.',
    type: NotificationDto,
  })
  @ApiNotFoundResponse({
    description: 'Notification not found.',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is required.',
  })
  markRead(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) notificationId: string,
  ) {
    return this.notificationsService.markRead(notificationId, request.user.sub);
  }
}
