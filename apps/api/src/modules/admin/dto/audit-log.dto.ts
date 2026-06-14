import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AuditLog, Prisma, User } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { AdminListMetaDto } from './admin-user.dto';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

type AuditLogRecord = Pick<
  AuditLog,
  'id' | 'action' | 'targetType' | 'targetId' | 'metadata' | 'createdAt'
> & {
  actor: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
};

class AuditActorDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Addison Admin' })
  displayName!: string;
}

export class AuditLogDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'admin.user.role_changed' })
  action!: string;

  @ApiProperty({ example: 'User' })
  targetType!: string;

  @ApiProperty({ example: '6f3c…' })
  targetId!: string;

  @ApiPropertyOptional({
    type: AuditActorDto,
    nullable: true,
    description: 'The acting user, or null for system-originated actions.',
  })
  actor!: AuditActorDto | null;

  @ApiPropertyOptional({
    description: 'Safe before/after business values (never secrets).',
  })
  metadata!: Prisma.JsonValue | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  static fromRecord(record: AuditLogRecord): AuditLogDto {
    return {
      id: record.id,
      action: record.action,
      targetType: record.targetType,
      targetId: record.targetId,
      actor: record.actor
        ? {
            id: record.actor.id,
            displayName: `${record.actor.firstName} ${record.actor.lastName}`,
          }
        : null,
      metadata: record.metadata,
      createdAt: record.createdAt,
    };
  }
}

export class AuditLogListResponseDto {
  @ApiProperty({ type: [AuditLogDto] })
  items!: AuditLogDto[];

  @ApiProperty({ type: AdminListMetaDto })
  meta!: AdminListMetaDto;
}

export class AuditLogListQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by actor id.' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(64)
  actorId?: string;

  @ApiPropertyOptional({ example: 'admin.user.role_changed' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  action?: string;

  @ApiPropertyOptional({ example: 'User' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  targetType?: string;

  @ApiPropertyOptional({ description: 'Filter by the affected entity id.' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  targetId?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Inclusive lower bound.',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Inclusive upper bound.',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
