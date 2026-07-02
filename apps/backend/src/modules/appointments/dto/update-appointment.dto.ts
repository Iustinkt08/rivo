import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AppointmentStatus } from '@prisma/client';

export class UpdateAppointmentDto {
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  internalNotes?: string;
}
