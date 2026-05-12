import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class UpdateTicketTagsDto {
  @ApiProperty({
    description:
      'Full replacement set of tag IDs to associate with the ticket.',
    example: ['2b7c4de8-1c66-4a89-a472-8c5a57a5f9dd'],
    isArray: true,
    type: String,
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  tagIds!: string[];
}
