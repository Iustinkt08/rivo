import { IsString, IsUUID, Length } from 'class-validator';

export class ValidateDiscountCodeDto {
  /** Raw user input — the service normalizes (trim + uppercase) before lookup. */
  @IsString()
  @Length(3, 24)
  code: string;

  @IsUUID()
  serviceId: string;
}
