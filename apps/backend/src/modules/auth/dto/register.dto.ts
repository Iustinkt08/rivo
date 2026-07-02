import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Length,
} from 'class-validator';
import { UserRole } from '@prisma/client';

// Roles a user may pick for THEMSELVES. STAFF_MEMBER accounts are created only
// by salon owners, and SUPER_ADMIN must never be self-assignable.
export const SELF_ASSIGNABLE_ROLES = [
  UserRole.CLIENT,
  UserRole.ADMIN_SALON,
] as const;

export class RegisterDto {
  @ApiProperty({ example: 'Andrei' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  firstName: string;

  @ApiProperty({ example: 'Popescu' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  lastName: string;

  @ApiPropertyOptional({ example: 'andrei@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+40712345678' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatars/123.jpg' })
  @IsUrl()
  @IsOptional()
  avatarUrl?: string;

  @ApiPropertyOptional({
    enum: SELF_ASSIGNABLE_ROLES,
    default: UserRole.CLIENT,
  })
  @IsIn(SELF_ASSIGNABLE_ROLES)
  @IsOptional()
  role?: (typeof SELF_ASSIGNABLE_ROLES)[number];
}
