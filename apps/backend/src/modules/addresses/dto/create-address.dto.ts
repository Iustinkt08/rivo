import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateAddressDto {
  @ApiProperty({ example: 'Home' })
  @IsString()
  @Length(1, 50)
  label: string;

  @ApiProperty({ example: 'Str. Victoriei 10' })
  @IsString()
  @Length(1, 200)
  addressLine1: string;

  @ApiPropertyOptional({ example: 'Ap. 3' })
  @IsString()
  @IsOptional()
  addressLine2?: string;

  @ApiProperty({ example: 'București' })
  @IsString()
  @Length(1, 100)
  city: string;

  @ApiPropertyOptional({ example: 'Ilfov' })
  @IsString()
  @IsOptional()
  county?: string;

  @ApiPropertyOptional({ example: 'RO', default: 'RO' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ example: '010001' })
  @IsString()
  @IsOptional()
  postalCode?: string;

  @ApiPropertyOptional({ example: 44.4268 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: 26.1025 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
