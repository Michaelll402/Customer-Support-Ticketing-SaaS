import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/database/prisma.service';

export interface AuditRecordInput {
  /** The acting user, or null/omitted for system-originated actions. */
  actorId?: string | null;
  /** Dotted action identifier, e.g. `admin.user.role_changed`. */
  action: string;
  /** The affected entity type, e.g. `User`, `Team`, `Tag`, `SlaPlan`. */
  targetType: string;
  /** The affected entity id (polymorphic, stored as a plain string). */
  targetId: string;
  /** Optional before/after business values. */
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Appends a row to the workspace audit trail. This is a thin, append-only
   * Prisma wrapper — there is no controller, no global interception, and no
   * read surface in this slice.
   *
   * SECURITY: callers MUST NOT place secrets, password hashes, tokens, cookies,
   * connection strings, or raw credentials in `metadata`. Store only the
   * business-level before/after values needed to explain an admin action
   * (for example role names, not password hashes).
   */
  async record(input: AuditRecordInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
      },
    });
  }
}
