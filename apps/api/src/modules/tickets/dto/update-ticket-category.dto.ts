import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsUUID, ValidateIf } from 'class-validator';

export class UpdateTicketCategoryDto {
  @ApiProperty({
    description: 'New category ID, or null to clear the category.',
    format: 'uuid',
    nullable: true,
    type: String,
  })
  @IsDefined()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  categoryId!: string | null;
}
