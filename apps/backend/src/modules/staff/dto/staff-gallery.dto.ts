import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

const CATEGORY_NAME_MIN = 1;
const CATEGORY_NAME_MAX = 40;
const CAPTION_MAX = 200;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Optional multipart fields accompanying the uploaded `file`. */
export class UploadStaffPhotoDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(CAPTION_MAX)
  caption?: string;
}

export class CreatePhotoCategoryDto {
  @Transform(trim)
  @IsString()
  @Length(CATEGORY_NAME_MIN, CATEGORY_NAME_MAX)
  name: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
