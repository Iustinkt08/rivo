import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsPhoneNumber, IsString, IsUrl, Length } from 'class-validator';

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
  @IsPhoneNumber()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'https://cdn.rivo.ro/avatars/123.jpg' })
  @IsUrl()
  @IsOptional()
  avatarUrl?: string;
}
