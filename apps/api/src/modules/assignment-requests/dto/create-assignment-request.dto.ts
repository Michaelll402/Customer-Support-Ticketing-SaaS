import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssignmentRequestType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const ASSIGNMENT_REQUEST_REASON_MIN = 10;
export const ASSIGNMENT_REQUEST_REASON_MAX = 1_000;

export class CreateAssignmentRequestDto {
  @ApiProperty({
    enum: AssignmentRequestType,
    description:
      'REASSIGN_USER requests handing the ticket to a named same-team teammate; RETURN_TO_QUEUE asks to release it back to the team queue.',
    example: AssignmentRequestType.REASSIGN_USER,
  })
  @IsEnum(AssignmentRequestType)
  type!: AssignmentRequestType;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Required for REASSIGN_USER (the requested new assignee). Must be omitted for RETURN_TO_QUEUE.',
  })
  // Required + UUID only for REASSIGN_USER. For RETURN_TO_QUEUE the service
  // rejects any provided value so the two request shapes stay distinct.
  @ValidateIf(
    (dto: CreateAssignmentRequestDto) =>
      dto.type === AssignmentRequestType.REASSIGN_USER,
  )
  @IsDefined({
    message: 'requestedAssigneeId is required for a REASSIGN_USER request.',
  })
  @IsUUID()
  requestedAssigneeId?: string | null;

  @ApiProperty({
    minLength: ASSIGNMENT_REQUEST_REASON_MIN,
    maxLength: ASSIGNMENT_REQUEST_REASON_MAX,
    example:
      'This ticket needs billing-specific knowledge that Bennett has, so please reassign it to him.',
  })
  @Transform(trimString)
  @IsString()
  @MinLength(ASSIGNMENT_REQUEST_REASON_MIN, {
    message: `reason must be at least ${ASSIGNMENT_REQUEST_REASON_MIN} characters.`,
  })
  @MaxLength(ASSIGNMENT_REQUEST_REASON_MAX)
  reason!: string;
}
