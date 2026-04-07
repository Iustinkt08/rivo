import { IsUUID, IsDateString, IsString } from 'class-validator';

export class LockSlotDto {
  @IsUUID()
  serviceId: string;

  @IsUUID()
  staffId: string;

  @IsDateString()
  startAt: string; // ISO datetime: "2026-04-10T10:00:00.000Z"

  @IsString()
  sessionId: string; // anonymous or authenticated session identifier
}
