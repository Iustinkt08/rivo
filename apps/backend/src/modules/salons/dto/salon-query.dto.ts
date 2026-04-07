import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SalonSortBy {
  DISTANCE = 'distance',
  RATING = 'rating',
  NAME = 'name',
}

export class SalonQueryDto {
  // ── Geo search ────────────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: 44.4268, description: 'User latitude' })
  @IsLatitude()
  @IsOptional()
  @Type(() => Number)
  lat?: number;

  @ApiPropertyOptional({ example: 26.1025, description: 'User longitude' })
  @IsLongitude()
  @IsOptional()
  @Type(() => Number)
  lng?: number;

  @ApiPropertyOptional({ example: 10, default: 10, description: 'Search radius in km' })
  @IsNumber()
  @Min(0.5)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  radiusKm?: number = 10;

  // ── Text + filters ────────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: 'bella', description: 'Search by salon name' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by category UUID' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ example: 4, description: 'Minimum average rating (1-5)' })
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  @Type(() => Number)
  minRating?: number;

  @ApiPropertyOptional({ example: 'București' })
  @IsString()
  @IsOptional()
  city?: string;

  // ── Sorting & Pagination ──────────────────────────────────────────────────
  @ApiPropertyOptional({ enum: SalonSortBy, default: SalonSortBy.DISTANCE })
  @IsEnum(SalonSortBy)
  @IsOptional()
  sortBy?: SalonSortBy = SalonSortBy.DISTANCE;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
