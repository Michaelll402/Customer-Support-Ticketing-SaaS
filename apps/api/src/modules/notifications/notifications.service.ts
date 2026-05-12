import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { NotificationType, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/database/prisma.service';
import type { MarkAllNotificationsReadResponseDto } from './dto/mark-all-notifications-read-response.dto';
import { NotificationDto } from './dto/notification.dto';
import type { NotificationListQueryDto } from './dto/notification-list-query.dto';
import type { NotificationListResponseDto } from './dto/notification-list-response.dto';

export type CreateNotificationsInput = {
  type: NotificationType;
  recipientUserIds: string[];
  ticketId?: string | null;
  message: string;
};

@Injectable()
export class NotificationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listForUser(
    userId: string,
    query: NotificationListQueryDto,
  ): Promise<NotificationListResponseDto> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.unreadOnly ? { isRead: false } : {}),
    };

    const skip = (query.page - 1) * query.limit;

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: query.limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

    return {
      items: items.map((item) => NotificationDto.fromRecord(item)),
      total,
      unreadCount,
      page: query.page,
      limit: query.limit,
      totalPages,
      hasNextPage: query.page < totalPages,
      hasPreviousPage: query.page > 1 && totalPages > 0,
    };
  }

  async markRead(
    notificationId: string,
    userId: string,
  ): Promise<NotificationDto> {
    const existing = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Notification not found.');
    }

    if (existing.isRead) {
      return NotificationDto.fromRecord(existing);
    }

    const updated = await this.prisma.notification.update({
      where: {
        id: notificationId,
      },
      data: {
        isRead: true,
      },
    });

    return NotificationDto.fromRecord(updated);
  }

  async markAllRead(
    userId: string,
  ): Promise<MarkAllNotificationsReadResponseDto> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return {
      updatedCount: result.count,
    };
  }

  async createForRecipients(input: CreateNotificationsInput): Promise<number> {
    const uniqueRecipients = [
      ...new Set(
        input.recipientUserIds.filter(
          (id) => typeof id === 'string' && id.length > 0,
        ),
      ),
    ];

    if (uniqueRecipients.length === 0) {
      return 0;
    }

    const result = await this.prisma.notification.createMany({
      data: uniqueRecipients.map((userId) => ({
        message: input.message,
        ticketId: input.ticketId ?? null,
        type: input.type,
        userId,
      })),
    });

    return result.count;
  }
}
