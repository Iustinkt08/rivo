import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class AuthUserDto {
  @ApiProperty() id: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
  @ApiProperty({ enum: UserRole }) role: UserRole;
  @ApiPropertyOptional() email?: string | null;
  @ApiPropertyOptional() phone?: string | null;
  @ApiPropertyOptional() avatarUrl?: string | null;
  @ApiPropertyOptional() dateOfBirth?: Date | null;
  @ApiPropertyOptional() gender?: string | null;
  @ApiProperty() isActive: boolean;
  @ApiProperty() createdAt: Date;
}

export class AuthResponseDto {
  @ApiProperty({ type: AuthUserDto }) user: AuthUserDto;
  @ApiProperty({ example: true }) isNewUser: boolean;
  @ApiProperty({
    example: false,
    description: 'True if the user administers at least one salon',
  })
  hasSalon: boolean;
}
