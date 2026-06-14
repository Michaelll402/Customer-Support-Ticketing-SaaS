import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/database/prisma.service';
import { AuditLogDto, type AuditLogListResponseDto } from './dto/audit-log.dto';
import type { AuditLogListQueryDto } from './dto/audit-log.dto';

@Injectable()
export class AdminAuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listAuditLogs(
    query: AuditLogListQueryDto,
  ): Promise<AuditLogListResponseDto> {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.actorId) {
      where.actorId = query.actorId;
    }
    if (query.action) {
      where.action = query.action;
    }
    if (query.targetType) {
      where.targetType = query.targetType;
    }
    if (query.targetId) {
      where.targetId = query.targetId;
    }
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    const skip = (query.page - 1) * query.limit;
    const [totalItems, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
    ]);

    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / query.limit);

    return {
      items: logs.map((log) => AuditLogDto.fromRecord(log)),
      meta: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1 && totalPages > 0,
      },
    };
  }
}
