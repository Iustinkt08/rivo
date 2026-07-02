import { IsUUID, IsDateString, IsOptional } from 'class-validator';

export class RescheduleAppointmentDto {
  @IsDateString()
  startAt: string; // new start, ISO datetime

  @IsOptional()
  @IsUUID()
  staffId?: string; // optionally move to another staff member of the salon
}
