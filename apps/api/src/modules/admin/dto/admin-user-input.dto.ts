import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const ADMIN_PASSWORD_MIN = 8;
export const ADMIN_PASSWORD_MAX = 128;

export class CreateAdminUserDto {
  @ApiProperty({ example: 'new.agent@demo.test' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Avery' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Agent' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  lastName!: string;

  @ApiProperty({ minLength: ADMIN_PASSWORD_MIN, example: 'Password1!' })
  @IsString()
  @MinLength(ADMIN_PASSWORD_MIN)
  @MaxLength(ADMIN_PASSWORD_MAX)
  password!: string;

  @ApiProperty({ enum: RoleName })
  @IsEnum(RoleName)
  role!: RoleName;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  teamIds?: string[];
}

export class UpdateAdminUserProfileDto {
  @ApiProperty({ example: 'Avery' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Agent' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  lastName!: string;
}

export class UpdateUserRoleDto {
  @ApiProperty({ enum: RoleName })
  @IsEnum(RoleName)
  role!: RoleName;
}

export class UpdateUserStatusDto {
  @ApiProperty({ description: 'true to activate, false to deactivate.' })
  @IsBoolean()
  isActive!: boolean;
}

export class UpdateUserTeamsDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  teamIds!: string[];
}

export class AdminUserListQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ description: 'Case-insensitive name/email search.' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: RoleName })
  @IsOptional()
  @IsEnum(RoleName)
  role?: RoleName;

  @ApiPropertyOptional({ description: 'Filter by active state.' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;
}
