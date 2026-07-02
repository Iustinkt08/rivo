import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle, seconds } from '@nestjs/throttler';
import { AppointmentsService } from './appointments.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { LockSlotDto } from './dto/lock-slot.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';

// Strict limits for abuse-prone booking endpoints (global default: 100/min).
const BOOKING_CREATE_LIMIT = { default: { limit: 5, ttl: seconds(60) } };
const SLOT_LOCK_LIMIT = { default: { limit: 15, ttl: seconds(60) } };

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller()
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // ─── Availability (public — clients use this before login) ───────────────────

  @Public()
  @Get('salons/:salonId/availability')
  @ApiOperation({
    summary: 'Get available slots for a service on a given date',
  })
  getAvailability(
    @Param('salonId') salonId: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.appointmentsService.getAvailability(salonId, query);
  }

  // ─── Slot lock ───────────────────────────────────────────────────────────────

  @Post('salons/:salonId/slots/lock')
  @Throttle(SLOT_LOCK_LIMIT)
  @ApiOperation({
    summary: 'Atomically lock a slot for 5 minutes during checkout',
  })
  lockSlot(@Param('salonId') salonId: string, @Body() dto: LockSlotDto) {
    return this.appointmentsService.lockSlot(salonId, dto);
  }

  @Post('salons/:salonId/slots/release')
  @ApiOperation({ summary: 'Release a previously acquired slot lock' })
  releaseSlot(@Param('salonId') salonId: string, @Body() dto: LockSlotDto) {
    return this.appointmentsService.releaseLock(salonId, dto);
  }

  // ─── Create appointment ──────────────────────────────────────────────────────

  @Post('appointments')
  @Throttle(BOOKING_CREATE_LIMIT)
  @ApiOperation({ summary: 'Book an appointment (client)' })
  create(
    @CurrentUser('id') clientId: string,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentsService.create(clientId, dto);
  }

  // ─── My appointments (client) ────────────────────────────────────────────────

  @Get('appointments/me')
  @ApiOperation({ summary: "Get current client's appointments" })
  findMine(@CurrentUser('id') clientId: string) {
    return this.appointmentsService.findForClient(clientId);
  }

  // ─── Salon appointments (business dashboard) ─────────────────────────────────

  @Get('salons/:salonId/appointments')
  @Roles('ADMIN_SALON', 'STAFF_MEMBER')
  @ApiOperation({
    summary: 'Get appointments for a salon (optionally filter by date)',
  })
  @ApiQuery({ name: 'date', required: false, example: '2026-04-10' })
  findForSalon(
    @Param('salonId') salonId: string,
    @CurrentUser('id') userId: string,
    @Query('date') date?: string,
  ) {
    return this.appointmentsService.findForSalon(salonId, userId, date);
  }

  // ─── Salon analytics (business dashboard) ────────────────────────────────────

  @Get('salons/:salonId/analytics')
  @Roles('ADMIN_SALON', 'STAFF_MEMBER')
  @ApiOperation({
    summary: 'Salon analytics — revenue, counts, top services/staff',
  })
  @ApiQuery({ name: 'range', required: false, enum: ['week', 'month', 'year'] })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Custom range start (ISO date). Requires `to`.',
    example: '2026-01-01',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'Custom range end (ISO date). Requires `from`.',
    example: '2026-01-31',
  })
  getAnalytics(
    @Param('salonId') salonId: string,
    @CurrentUser('id') userId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    // Parse date-only strings as local midnight to avoid TZ off-by-one; the
    // service normalizes to full-day boundaries.
    const parse = (s?: string) =>
      s ? new Date(s.includes('T') ? s : `${s}T00:00:00`) : undefined;

    return this.appointmentsService.getAnalytics(salonId, userId, {
      range: query.range,
      from: parse(query.from),
      to: parse(query.to),
    });
  }

  // ─── Single appointment ──────────────────────────────────────────────────────

  @Get('appointments/:id')
  @ApiOperation({ summary: 'Get appointment details' })
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.appointmentsService.findOne(id, userId);
  }

  // ─── Reschedule ──────────────────────────────────────────────────────────────

  @Patch('appointments/:id/reschedule')
  @ApiOperation({
    summary: 'Move an appointment to a new time/staff (salon admin)',
  })
  reschedule(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    return this.appointmentsService.reschedule(id, actorId, dto);
  }

  // ─── Status transitions ──────────────────────────────────────────────────────

  @Patch('appointments/:id/status')
  @ApiOperation({
    summary:
      'Update appointment status (confirm / complete / cancel / no-show)',
  })
  updateStatus(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointmentsService.updateStatus(id, actorId, dto);
  }
}
