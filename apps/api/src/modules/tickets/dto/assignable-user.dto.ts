import { ApiProperty } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';

export type AssignableUserRecord = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: { name: RoleName };
};

export class AssignableUserDto {
  @ApiProperty({
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    example: 'agent@example.test',
  })
  email!: string;

  @ApiProperty({
    example: 'Avery',
  })
  firstName!: string;

  @ApiProperty({
    example: 'Agent',
  })
  lastName!: string;

  @ApiProperty({
    enum: RoleName,
    example: RoleName.AGENT,
  })
  role!: RoleName;

  static fromRecord(record: AssignableUserRecord): AssignableUserDto {
    return {
      id: record.id,
      email: record.email,
      firstName: record.firstName,
      lastName: record.lastName,
      role: record.role.name,
    };
  }
}
