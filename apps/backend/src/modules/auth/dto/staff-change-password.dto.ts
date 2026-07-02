import { IsString, MaxLength, MinLength } from 'class-validator';

export class StaffChangePasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt input limit
  newPassword: string;
}
