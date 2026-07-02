import { IsIn, IsOptional, IsDateString } from 'class-validator';

export class AnalyticsQueryDto {
  // Preset window. Ignored when both `from` and `to` are supplied (custom range).
  @IsIn(['week', 'month', 'year'])
  @IsOptional()
  range?: 'week' | 'month' | 'year';

  // Custom range start (ISO date, e.g. "2026-01-01"). Requires `to`.
  @IsDateString()
  @IsOptional()
  from?: string;

  // Custom range end (ISO date, e.g. "2026-01-31"). Requires `from`.
  @IsDateString()
  @IsOptional()
  to?: string;
}
