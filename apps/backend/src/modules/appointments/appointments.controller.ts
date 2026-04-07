import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { LockSlotDto } from './dto/lock-slot.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller()
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // ─── Availability (public — clients use this before login) ───────────────────

  @Public()
  @Get('salons/:salonId/availability')
  @ApiOperation({ summary: 'Get available slots for a service on a given date' })
  getAvailability(
    @Param('salonId') salonId: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.appointmentsService.getAvailability(salonId, query);
  }

  // ─── Slot lock ───────────────────────────────────────────────────────────────

  @Post('salons/:salonId/slots/lock')
  @ApiOperation({ summary: 'Atomically lock a slot for 5 minutes during checkout' })
  lockSlot(
    @Param('salonId') salonId: string,
    @Body() dto: LockSlotDto,
  ) {
    return this.appointmentsService.lockSlot(salonId, dto);
  }

  @Post('salons/:salonId/slots/release')
  @ApiOperation({ summary: 'Release a previously acquired slot lock' })
  releaseSlot(
    @Param('salonId') salonId: string,
    @Body() dto: LockSlotDto,
  ) {
    return this.appointmentsService.releaseLock(salonId, dto);
  }

  // ─── Create appointment ──────────────────────────────────────────────────────

  @Post('appointments')
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
  @ApiOperation({ summary: 'Get appointments for a salon (optionally filter by date)' })
  @ApiQuery({ name: 'date', required: false, example: '2026-04-10' })
  findForSalon(
    @Param('salonId') salonId: string,
    @Query('date') date?: string,
  ) {
    return this.appointmentsService.findForSalon(salonId, date);
  }

  // ─── Single appointment ──────────────────────────────────────────────────────

  @Get('appointments/:id')
  @ApiOperation({ summary: 'Get appointment details' })
  findOne(@Param('id') id: string) {
    return this.appointmentsService.findOne(id);
  }

  // ─── Status transitions ──────────────────────────────────────────────────────

  @Patch('appointments/:id/status')
  @ApiOperation({ summary: 'Update appointment status (confirm / complete / cancel / no-show)' })
  updateStatus(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointmentsService.updateStatus(id, actorId, dto);
  }
}
