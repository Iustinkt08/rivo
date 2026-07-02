import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSalonDto {
  // ── Identity ──────────────────────────────────────────────────────────────
  @ApiProperty({ example: 'Studio Bella' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name: string;

  @ApiPropertyOptional({ example: 'Salonul nr. 1 din București pentru hair & nails.' })
  @IsString()
  @IsOptional()
  @Length(0, 1000)
  description?: string;

  @ApiPropertyOptional({ example: '+40712345678' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'contact@studiobella.ro' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'https://studiobella.ro' })
  @IsUrl()
  @IsOptional()
  websiteUrl?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/salon-logo.jpg' })
  @IsUrl()
  @IsOptional()
  logoUrl?: string;

  // ── Address ───────────────────────────────────────────────────────────────
  @ApiProperty({ example: 'Strada Florilor 12' })
  @IsString()
  @IsNotEmpty()
  addressLine1: string;

  @ApiPropertyOptional({ example: 'Etaj 2, Ap. 5' })
  @IsString()
  @IsOptional()
  addressLine2?: string;

  @ApiProperty({ example: 'București' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiPropertyOptional({ example: 'Ilfov' })
  @IsString()
  @IsOptional()
  county?: string;

  @ApiPropertyOptional({ example: 'RO', default: 'RO' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ example: '010101' })
  @IsString()
  @IsOptional()
  postalCode?: string;

  // Optional — defaults to center of Bucharest when not provided
  @ApiPropertyOptional({ example: 44.4268 })
  @IsLatitude()
  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @ApiPropertyOptional({ example: 26.1025 })
  @IsLongitude()
  @IsOptional()
  @Type(() => Number)
  longitude?: number;

  // ── Booking policy ────────────────────────────────────────────────────────
  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  requiresDeposit?: boolean;

  @ApiPropertyOptional({ example: 30, description: 'Deposit percentage (0-100)' })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  depositPercentage?: number;

  @ApiPropertyOptional({ default: 24, description: 'Hours before appointment for free cancellation' })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  cancellationHours?: number;
}
