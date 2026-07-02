import {
  IsUUID,
  IsDateString,
  IsOptional,
  IsString,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { BookingSource } from '@prisma/client';

export class CreateAppointmentDto {
  @IsUUID()
  salonId: string;

  @IsUUID()
  serviceId: string;

  @IsUUID()
  staffId: string;

  @IsDateString()
  startAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  sessionId?: string; // to release the slot lock after booking

  @IsOptional()
  @IsEnum(BookingSource)
  source?: BookingSource;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  guestName?: string; // for WALK_IN / PHONE bookings

  @IsOptional()
  @IsString()
  @MaxLength(30)
  guestPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  clientNotes?: string;
}
