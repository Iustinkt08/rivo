import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateServiceDto {
  @IsString()
  categoryId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(5)
  @Type(() => Number)
  durationMin: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * Staff members who perform this service. When provided, the StaffService
   * join rows are replaced to match exactly this list (validated to belong to
   * the same salon). Omit to leave assignments untouched.
   */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  staffIds?: string[];
}
