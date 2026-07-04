import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Matches,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { DiscountType } from '@prisma/client';

// Codes are stored normalized (uppercase, trimmed) — normalize on input so
// "vara-2026 " and "VARA-2026" are the same code.
const normalizeCode = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateDiscountCodeDto {
  /** Optional custom code — when absent the server generates a readable one. */
  @IsOptional()
  @Transform(normalizeCode)
  @Matches(/^[A-Z0-9-]{3,24}$/, {
    message:
      'Codul poate conține doar litere, cifre și cratime (3-24 de caractere).',
  })
  code?: string;

  @IsEnum(DiscountType)
  type: DiscountType;

  /** PERCENT: 1-100 (cross-checked in service); FIXED: > 0 in RON. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  value: number;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxPerClient?: number;
}
