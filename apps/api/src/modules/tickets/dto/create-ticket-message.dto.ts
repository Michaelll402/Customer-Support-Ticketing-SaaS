import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateTicketMessageDto {
  @ApiProperty({
    example:
      'Thanks for the context. I can reproduce this issue and will keep the investigation here.',
    maxLength: 5_000,
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5_000)
  body!: string;

  @ApiPropertyOptional({
    description:
      'Uploaded-but-unattached attachment IDs to link to the new message.',
    example: ['2b7c4de8-1c66-4a89-a472-8c5a57a5f9dd'],
    isArray: true,
    type: String,
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  attachmentIds?: string[];
}
