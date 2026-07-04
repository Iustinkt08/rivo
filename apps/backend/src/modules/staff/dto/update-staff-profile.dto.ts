import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

// A social value is either a full https:// URL or a bare handle (optionally
// prefixed with @; dots/slashes allowed so "example.com/portfolio" works).
// Handles are normalized to full URLs server-side (see staff-profile.utils).
const SOCIAL_VALUE_PATTERN = /^(https:\/\/\S+|@?[A-Za-z0-9][A-Za-z0-9._/-]*)$/;
const SOCIAL_VALUE_MESSAGE =
  'must be an https:// URL or a bare handle (letters, digits, . _ - /)';
const SOCIAL_MAX_LENGTH = 200;

export class StaffSocialsDto {
  @IsOptional()
  @ValidateIf((o: StaffSocialsDto) => o.instagram !== '')
  @IsString()
  @MaxLength(SOCIAL_MAX_LENGTH)
  @Matches(SOCIAL_VALUE_PATTERN, {
    message: `instagram ${SOCIAL_VALUE_MESSAGE}`,
  })
  instagram?: string;

  @IsOptional()
  @ValidateIf((o: StaffSocialsDto) => o.facebook !== '')
  @IsString()
  @MaxLength(SOCIAL_MAX_LENGTH)
  @Matches(SOCIAL_VALUE_PATTERN, {
    message: `facebook ${SOCIAL_VALUE_MESSAGE}`,
  })
  facebook?: string;

  @IsOptional()
  @ValidateIf((o: StaffSocialsDto) => o.tiktok !== '')
  @IsString()
  @MaxLength(SOCIAL_MAX_LENGTH)
  @Matches(SOCIAL_VALUE_PATTERN, { message: `tiktok ${SOCIAL_VALUE_MESSAGE}` })
  tiktok?: string;

  @IsOptional()
  @ValidateIf((o: StaffSocialsDto) => o.website !== '')
  @IsString()
  @MaxLength(SOCIAL_MAX_LENGTH)
  @Matches(SOCIAL_VALUE_PATTERN, { message: `website ${SOCIAL_VALUE_MESSAGE}` })
  website?: string;
}

export class StaffPublicSettingsDto {
  @IsOptional()
  @IsBoolean()
  showSocials?: boolean;

  @IsOptional()
  @IsBoolean()
  showContact?: boolean;

  @IsOptional()
  @IsBoolean()
  showApptCount?: boolean;

  @IsOptional()
  @IsBoolean()
  showGallery?: boolean;
}

/**
 * Self-service staff profile update (staff-self or salon owner). Deliberately
 * NEVER includes username/passwordHash/isActive/salonId — those only move
 * through the owner-managed staff and credentials endpoints.
 */
export class UpdateStaffProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 60)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  specialty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  // Empty string means "clear the email" — only validate non-empty values.
  @IsOptional()
  @ValidateIf((o: UpdateStaffProfileDto) => o.email !== '')
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  avatarEmoji?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => StaffSocialsDto)
  socials?: StaffSocialsDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => StaffPublicSettingsDto)
  publicSettings?: StaffPublicSettingsDto;
}
