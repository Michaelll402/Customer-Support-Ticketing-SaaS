import { ApiProperty } from '@nestjs/swagger';

import { AuthUserDto } from './auth-user.dto';

export class AuthSessionDto {
  @ApiProperty({
    type: AuthUserDto,
  })
  user!: AuthUserDto;
}
