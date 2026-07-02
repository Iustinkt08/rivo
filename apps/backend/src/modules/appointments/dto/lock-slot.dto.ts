import { IsUUID, IsDateString, IsString, MaxLength } from 'class-validator';

export class LockSlotDto {
  @IsUUID()
  serviceId: string;

  @IsUUID()
  staffId: string;

  @IsDateString()
  startAt: string; // ISO datetime: "2026-04-10T10:00:00.000Z"

  @IsString()
  @MaxLength(128)
  sessionId: string; // anonymous or authenticated session identifier
}
