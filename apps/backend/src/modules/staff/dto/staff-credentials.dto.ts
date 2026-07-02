import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateStaffCredentialsDto {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt input limit
  password?: string; // omitted → generated server-side, returned once
}

export class ResetStaffCredentialsDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password?: string; // omitted → generated server-side, returned once
}
