import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterDto {
  @ApiProperty({
    example: 'Casey',
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({
    example: 'Customer',
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  lastName!: string;

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
