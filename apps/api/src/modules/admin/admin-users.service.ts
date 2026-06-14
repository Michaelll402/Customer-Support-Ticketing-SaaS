import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RoleName } from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/database/prisma.service';
import type { AccessTokenPayload } from '../auth/auth.types';
import { PasswordService } from '../auth/password.service';
import { AuditService } from '../audit/audit.service';
import {
  AdminUserDto,
  type AdminUserListResponseDto,
} from './dto/admin-user.dto';
import type {
  AdminUserListQueryDto,
  CreateAdminUserDto,
  UpdateAdminUserProfileDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
  UpdateUserTeamsDto,
} from './dto/admin-user-input.dto';

type Actor = Pick<AccessTokenPayload, 'role' | 'sub'>;

const adminUserInclude = {
  role: { select: { name: true } },
  teamMemberships: { select: { team: { select: { id: true, name: true } } } },
} satisfies Prisma.UserInclude;

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async listUsers(
    query: AdminUserListQueryDto,
  ): Promise<AdminUserListResponseDto> {
    const where: Prisma.UserWhereInput = {};
    if (query.role) {
      where.role = { name: query.role };
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const skip = (query.page - 1) * query.limit;
    const [totalItems, users, activeAdminCount] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: adminUserInclude,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        skip,
        take: query.limit,
      }),
      this.countActiveAdmins(),
    ]);

    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / query.limit);

    return {
      items: users.map((user) => AdminUserDto.fromRecord(user)),
      meta: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1 && totalPages > 0,
      },
      activeAdminCount,
    };
  }

  async getUser(id: string): Promise<AdminUserDto> {
    return AdminUserDto.fromRecord(await this.loadUserOrThrow(id));
  }

  async createUser(
    actor: Actor,
    input: CreateAdminUserDto,
  ): Promise<AdminUserDto> {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('A user with this email already exists.');
    }

    if (input.teamIds?.length) {
      await this.assertTeamsExist(input.teamIds);
    }

    const passwordHash = await this.passwordService.hashPassword(
      input.password,
    );

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash,
        role: { connect: { name: input.role } },
        ...(input.teamIds?.length
          ? {
              teamMemberships: {
                create: input.teamIds.map((teamId) => ({ teamId })),
              },
            }
          : {}),
      },
      include: adminUserInclude,
    });

    await this.recordAudit(actor.sub, 'admin.user.created', user.id, {
      email: user.email,
      role: input.role,
      teamCount: input.teamIds?.length ?? 0,
    });

    return AdminUserDto.fromRecord(user);
  }

  async updateProfile(
    actor: Actor,
    id: string,
    input: UpdateAdminUserProfileDto,
  ): Promise<AdminUserDto> {
    await this.loadUserOrThrow(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { firstName: input.firstName, lastName: input.lastName },
      include: adminUserInclude,
    });
    await this.recordAudit(actor.sub, 'admin.user.profile_updated', id, {});
    return AdminUserDto.fromRecord(user);
  }

  async changeRole(
    actor: Actor,
    id: string,
    input: UpdateUserRoleDto,
  ): Promise<AdminUserDto> {
    const user = await this.loadUserOrThrow(id);
    if (user.role.name === input.role) {
      return AdminUserDto.fromRecord(user);
    }

    // Demoting the only remaining active admin would lock the workspace out.
    if (
      user.role.name === RoleName.ADMIN &&
      input.role !== RoleName.ADMIN &&
      user.isActive
    ) {
      await this.assertNotLastActiveAdmin();
    }

    // A role change revokes existing sessions so the new scope takes effect.
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        role: { connect: { name: input.role } },
        tokenVersion: { increment: 1 },
      },
      include: adminUserInclude,
    });

    await this.recordAudit(actor.sub, 'admin.user.role_changed', id, {
      from: user.role.name,
      to: input.role,
    });

    return AdminUserDto.fromRecord(updated);
  }

  async setStatus(
    actor: Actor,
    id: string,
    input: UpdateUserStatusDto,
  ): Promise<AdminUserDto> {
    const user = await this.loadUserOrThrow(id);
    if (user.isActive === input.isActive) {
      return AdminUserDto.fromRecord(user);
    }

    if (!input.isActive) {
      if (id === actor.sub) {
        throw new BadRequestException(
          'You cannot deactivate your own account.',
        );
      }
      if (user.role.name === RoleName.ADMIN) {
        await this.assertNotLastActiveAdmin();
      }
    }

    // Deactivation revokes existing sessions; activation simply re-enables login.
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: input.isActive,
        ...(input.isActive ? {} : { tokenVersion: { increment: 1 } }),
      },
      include: adminUserInclude,
    });

    await this.recordAudit(
      actor.sub,
      input.isActive ? 'admin.user.activated' : 'admin.user.deactivated',
      id,
      {},
    );

    return AdminUserDto.fromRecord(updated);
  }

  async revokeSessions(actor: Actor, id: string): Promise<AdminUserDto> {
    await this.loadUserOrThrow(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { tokenVersion: { increment: 1 } },
      include: adminUserInclude,
    });
    await this.recordAudit(actor.sub, 'admin.user.sessions_revoked', id, {});
    return AdminUserDto.fromRecord(updated);
  }

  async updateTeams(
    actor: Actor,
    id: string,
    input: UpdateUserTeamsDto,
  ): Promise<AdminUserDto> {
    await this.loadUserOrThrow(id);
    if (input.teamIds.length) {
      await this.assertTeamsExist(input.teamIds);
    }

    await this.prisma.$transaction([
      this.prisma.teamMember.deleteMany({ where: { userId: id } }),
      ...(input.teamIds.length
        ? [
            this.prisma.teamMember.createMany({
              data: input.teamIds.map((teamId) => ({ userId: id, teamId })),
            }),
          ]
        : []),
    ]);

    const user = await this.loadUserOrThrow(id);
    await this.recordAudit(actor.sub, 'admin.user.teams_updated', id, {
      teamCount: input.teamIds.length,
    });
    return AdminUserDto.fromRecord(user);
  }

  // --- Helpers ------------------------------------------------------------

  private async loadUserOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: adminUserInclude,
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return user;
  }

  private countActiveAdmins(): Promise<number> {
    return this.prisma.user.count({
      where: { isActive: true, role: { name: RoleName.ADMIN } },
    });
  }

  private async assertNotLastActiveAdmin(): Promise<void> {
    const activeAdmins = await this.countActiveAdmins();
    if (activeAdmins <= 1) {
      throw new ConflictException(
        'This is the last active admin. Promote or activate another admin first.',
      );
    }
  }

  private async assertTeamsExist(teamIds: string[]): Promise<void> {
    const found = await this.prisma.team.count({
      where: { id: { in: teamIds } },
    });
    if (found !== teamIds.length) {
      throw new BadRequestException('One or more teams do not exist.');
    }
  }

  private async recordAudit(
    actorId: string,
    action: string,
    targetId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.auditService.record({
        actorId,
        action,
        targetType: 'User',
        targetId,
        metadata: metadata as Prisma.InputJsonValue,
      });
    } catch (error) {
      this.logger.warn({
        event: 'audit.record_failed',
        action,
        targetId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
