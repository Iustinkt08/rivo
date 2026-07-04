import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  onAccepted?: boolean;

  @IsOptional()
  @IsBoolean()
  onRejected?: boolean;

  @IsOptional()
  @IsBoolean()
  onCancelled?: boolean;

  @IsOptional()
  @IsBoolean()
  onRescheduled?: boolean;

  @IsOptional()
  @IsBoolean()
  onPriceChange?: boolean;

  @IsOptional()
  @IsBoolean()
  onDurationChange?: boolean;

  @IsOptional()
  @IsBoolean()
  onReview?: boolean;

  @IsOptional()
  @IsBoolean()
  onReminder?: boolean;
}
