import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DayOfWeek } from '@prisma/client';

export class OpeningHourResponseDto {
  @ApiProperty({ enum: DayOfWeek }) dayOfWeek: DayOfWeek;
  @ApiProperty() openTime: string;
  @ApiProperty() closeTime: string;
  @ApiProperty() isClosed: boolean;
}

export class SalonPhotoDto {
  @ApiProperty() id: string;
  @ApiProperty() url: string;
  @ApiPropertyOptional() caption: string | null;
  @ApiProperty() sortOrder: number;
}

export class SalonCardDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiPropertyOptional() logoUrl: string | null;
  @ApiPropertyOptional() coverImageUrl: string | null;
  @ApiProperty() city: string;
  @ApiProperty() addressLine1: string;
  @ApiProperty() averageRating: number;
  @ApiProperty() reviewCount: number;
  @ApiPropertyOptional({ description: 'Distance in km (present when geo search is used)' })
  distanceKm?: number;
}

export class SalonProfileDto extends SalonCardDto {
  @ApiPropertyOptional() description: string | null;
  @ApiPropertyOptional() phone: string | null;
  @ApiPropertyOptional() email: string | null;
  @ApiPropertyOptional() websiteUrl: string | null;
  @ApiProperty() latitude: number;
  @ApiProperty() longitude: number;
  @ApiProperty() county: string | null;
  @ApiProperty() country: string;
  @ApiProperty() postalCode: string | null;
  @ApiProperty() requiresDeposit: boolean;
  @ApiPropertyOptional() depositPercentage: number | null;
  @ApiProperty() cancellationHours: number;
  @ApiProperty({ type: [OpeningHourResponseDto] }) openingHours: OpeningHourResponseDto[];
  @ApiProperty({ type: [SalonPhotoDto] }) gallery: SalonPhotoDto[];
  @ApiProperty() serviceCount: number;
  @ApiProperty() staffCount: number;
}

export class PaginatedSalonsDto {
  @ApiProperty({ type: [SalonCardDto] }) data: SalonCardDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() hasNextPage: boolean;
}
