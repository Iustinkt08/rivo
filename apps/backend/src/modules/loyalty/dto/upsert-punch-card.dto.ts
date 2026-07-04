import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsPositive,
  Max,
  Min,
} from 'class-validator';
import { DiscountType } from '@prisma/client';

export const MIN_REQUIRED_VISITS = 2;
export const MAX_REQUIRED_VISITS = 50;

export class UpsertPunchCardDto {
  @IsBoolean()
  isActive: boolean;

  /** COMPLETED visits needed to earn the reward. */
  @IsInt()
  @Min(MIN_REQUIRED_VISITS)
  @Max(MAX_REQUIRED_VISITS)
  requiredVisits: number;

  @IsEnum(DiscountType)
  rewardType: DiscountType;

  /** PERCENT: 1-100 (cross-checked in service); FIXED: > 0 in RON. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  rewardValue: number;
}
