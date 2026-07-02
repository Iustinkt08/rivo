import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class StaffLoginDto {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  // Normalized server-side to lowercase; keep the charset tight.
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt input limit
  password: string;
}
