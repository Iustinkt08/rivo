import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  Length,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Andrei' })
  @IsString()
  @IsOptional()
  @Length(1, 50)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Popescu' })
  @IsString()
  @IsOptional()
  @Length(1, 50)
  lastName?: string;

  @ApiPropertyOptional({ example: 'andrei@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+40712345678' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'https://cdn.rivo.ro/avatars/123.jpg' })
  @IsUrl()
  @IsOptional()
  avatarUrl?: string;

  @ApiPropertyOptional({
    example: '1990-05-20',
    description: 'ISO date string (YYYY-MM-DD)',
  })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    enum: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'],
  })
  @IsString()
  @IsOptional()
  gender?: string;
}
