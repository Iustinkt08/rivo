import {
  IsUUID,
  IsDateString,
  IsOptional,
  IsString,
  IsEnum,
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
  sessionId?: string; // to release the slot lock after booking

  @IsOptional()
  @IsEnum(BookingSource)
  source?: BookingSource;

  @IsOptional()
  @IsString()
  guestName?: string; // for WALK_IN / PHONE bookings

  @IsOptional()
  @IsString()
  guestPhone?: string;

  @IsOptional()
  @IsString()
  clientNotes?: string;
}
