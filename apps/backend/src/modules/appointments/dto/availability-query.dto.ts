import { IsUUID, IsDateString, IsOptional } from 'class-validator';

export class AvailabilityQueryDto {
  @IsUUID()
  serviceId: string;

  @IsUUID()
  @IsOptional()
  staffId?: string; // omit = "any available staff"

  @IsDateString()
  date: string; // "2026-04-10" — returns all slots for that day
}
