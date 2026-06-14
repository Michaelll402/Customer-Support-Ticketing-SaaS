import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const ASSIGNMENT_REVIEW_NOTE_MAX = 1_000;
export const ASSIGNMENT_REJECT_NOTE_MIN = 5;

export class ApproveAssignmentRequestDto {
  @ApiPropertyOptional({
    maxLength: ASSIGNMENT_REVIEW_NOTE_MAX,
    description: 'Optional note recorded with the approval.',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(ASSIGNMENT_REVIEW_NOTE_MAX)
  reviewNote?: string;
}

export class RejectAssignmentRequestDto {
  @ApiProperty({
    minLength: ASSIGNMENT_REJECT_NOTE_MIN,
    maxLength: ASSIGNMENT_REVIEW_NOTE_MAX,
    description: 'Reason for declining the request (required).',
    example: 'Keep this one — you have the most context on the customer.',
  })
  @Transform(trimString)
  @IsString()
  @MinLength(ASSIGNMENT_REJECT_NOTE_MIN, {
    message: `reviewNote must be at least ${ASSIGNMENT_REJECT_NOTE_MIN} characters.`,
  })
  @MaxLength(ASSIGNMENT_REVIEW_NOTE_MAX)
  reviewNote!: string;
}
