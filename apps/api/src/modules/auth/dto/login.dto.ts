import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'customer@example.test',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'Password1!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password!: string;
}
