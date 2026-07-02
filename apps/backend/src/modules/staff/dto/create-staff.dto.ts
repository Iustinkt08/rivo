import {
  IsString,
  IsOptional,
  IsArray,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateStaffDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  // When present, a login account is created and the generated password is
  // returned once in the create response.
  username?: string;

  @IsString()
  @MaxLength(50)
  firstName: string;

  @IsString()
  @MaxLength(50)
  lastName: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialty?: string; // client-facing role label, e.g. "Hairstylist"

  @IsOptional()
  @IsString()
  @MaxLength(16)
  avatarEmoji?: string; // emoji avatar fallback when no photo is set

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  serviceIds?: string[]; // Services this staff member performs
}
