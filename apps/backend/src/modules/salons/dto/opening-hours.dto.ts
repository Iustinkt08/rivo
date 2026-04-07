import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DayOfWeek } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/; // HH:MM

export class OpeningHourItemDto {
  @ApiProperty({ enum: DayOfWeek })
  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @ApiProperty({ example: '09:00' })
  @IsString()
  @IsNotEmpty()
  @Matches(TIME_REGEX, { message: 'openTime must be in HH:MM format' })
  openTime: string;

  @ApiProperty({ example: '19:00' })
  @IsString()
  @IsNotEmpty()
  @Matches(TIME_REGEX, { message: 'closeTime must be in HH:MM format' })
  closeTime: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isClosed?: boolean;
}

export class SetOpeningHoursDto {
  @ApiProperty({ type: [OpeningHourItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpeningHourItemDto)
  hours: OpeningHourItemDto[];
}
