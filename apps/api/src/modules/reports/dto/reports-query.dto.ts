import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const REPORT_WINDOW_DAYS_DEFAULT = 30;
export const REPORT_WINDOW_DAYS_MIN = 1;
export const REPORT_WINDOW_DAYS_MAX = 365;

export class ReportWindowQueryDto {
  @ApiPropertyOptional({
    default: REPORT_WINDOW_DAYS_DEFAULT,
    minimum: REPORT_WINDOW_DAYS_MIN,
    maximum: REPORT_WINDOW_DAYS_MAX,
    description:
      'Size of the trailing reporting window in days (UTC). Window = [now - windowDays, now].',
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(REPORT_WINDOW_DAYS_MIN)
  @Max(REPORT_WINDOW_DAYS_MAX)
  windowDays: number = REPORT_WINDOW_DAYS_DEFAULT;
}
