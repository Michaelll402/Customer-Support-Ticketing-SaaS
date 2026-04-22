import { ApiProperty } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';

import type { UserWithRole } from '../../users/users.service';

export class AuthUserDto {
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    example: 'customer@example.test',
  })
  email!: string;

  @ApiProperty({
    example: 'Casey',
  })
  firstName!: string;

  @ApiProperty({
    example: 'Customer',
  })
  lastName!: string;

  @ApiProperty({
    enum: RoleName,
  })
  role!: RoleName;

  static fromUser(user: UserWithRole): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.name,
    };
  }
}
