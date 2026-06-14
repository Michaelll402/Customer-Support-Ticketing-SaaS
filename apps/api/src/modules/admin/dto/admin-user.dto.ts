import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleName, type Role, type Team, type User } from '@prisma/client';

class AdminUserTeamDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Billing & Payments' })
  name!: string;
}

type AdminUserRecord = Pick<
  User,
  | 'id'
  | 'email'
  | 'firstName'
  | 'lastName'
  | 'isActive'
  | 'createdAt'
  | 'updatedAt'
> & {
  role: Pick<Role, 'name'>;
  teamMemberships: Array<{ team: Pick<Team, 'id' | 'name'> }>;
};

/**
 * Admin-facing user projection. Deliberately omits `passwordHash`,
 * `tokenVersion`, and any auth/secret material.
 */
export class AdminUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'agent@demo.test' })
  email!: string;

  @ApiProperty({ example: 'Avery' })
  firstName!: string;

  @ApiProperty({ example: 'Agent' })
  lastName!: string;

  @ApiProperty({ enum: RoleName })
  role!: RoleName;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: [AdminUserTeamDto] })
  teams!: AdminUserTeamDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  static fromRecord(record: AdminUserRecord): AdminUserDto {
    return {
      id: record.id,
      email: record.email,
      firstName: record.firstName,
      lastName: record.lastName,
      role: record.role.name,
      isActive: record.isActive,
      teams: record.teamMemberships.map((membership) => ({
        id: membership.team.id,
        name: membership.team.name,
      })),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

export class AdminListMetaDto {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalItems!: number;
  @ApiProperty() totalPages!: number;
  @ApiProperty() hasNextPage!: boolean;
  @ApiProperty() hasPreviousPage!: boolean;
}

export class AdminUserListResponseDto {
  @ApiProperty({ type: [AdminUserDto] })
  items!: AdminUserDto[];

  @ApiProperty({ type: AdminListMetaDto })
  meta!: AdminListMetaDto;

  @ApiPropertyOptional({
    description:
      'Number of currently active ADMIN accounts (last-admin guard).',
  })
  activeAdminCount?: number;
}
