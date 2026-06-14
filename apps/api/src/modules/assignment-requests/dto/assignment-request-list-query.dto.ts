import { ApiPropertyOptional } from '@nestjs/swagger';
import { AssignmentRequestStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class AssignmentRequestListQueryDto {
  @ApiPropertyOptional({
    enum: AssignmentRequestStatus,
    description:
      'Filter by status. Defaults to PENDING (the review queue) when omitted.',
  })
  @IsOptional()
  @IsEnum(AssignmentRequestStatus)
  status?: AssignmentRequestStatus;
}
