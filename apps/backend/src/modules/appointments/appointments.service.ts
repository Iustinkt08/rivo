import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SlotLockService } from './slot-lock.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { LockSlotDto } from './dto/lock-slot.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { AppointmentStatus, BookingSource } from '@prisma/client';

const SLOT_INTERVAL_MIN = 15; // generate slots every 15 minutes

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slotLock: SlotLockService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // AVAILABILITY
  // ═══════════════════════════════════════════════════════════════════════════

  async getAvailability(salonId: string, query: AvailabilityQueryDto) {
    const service = await this.prisma.service.findFirst({
      where: { id: query.serviceId, salonId, isActive: true },
    });
    if (!service) throw new NotFoundException('Service not found or inactive');

    // Resolve candidate staff
    const staffList = await this.resolveStaff(salonId, query.serviceId, query.staffId);
    if (!staffList.length) throw new NotFoundException('No available staff for this service');

    const date = new Date(query.date);
    const dayOfWeek = this.getDayOfWeek(date);

    const results = await Promise.all(
      staffList.map((staff) => this.getSlotsForStaff(staff, service, date, dayOfWeek, salonId)),
    );

    return results.flat().sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  }

  private async resolveStaff(salonId: string, serviceId: string, staffId?: string) {
    if (staffId) {
      const staff = await this.prisma.staff.findFirst({
        where: { id: staffId, salonId, isActive: true },
        include: { workSchedules: true },
      });
      return staff ? [staff] : [];
    }

    // Any staff capable of this service
    return this.prisma.staff.findMany({
      where: {
        salonId,
        isActive: true,
        staffServices: { some: { serviceId } },
      },
      include: { workSchedules: true },
    });
  }

  private async getSlotsForStaff(
    staff: any,
    service: any,
    date: Date,
    dayOfWeek: string,
    salonId: string,
  ): Promise<{ staffId: string; staffName: string; startAt: Date; endAt: Date; isLocked: boolean }[]> {
    const schedule = staff.workSchedules.find((s: any) => s.dayOfWeek === dayOfWeek);
    if (!schedule || schedule.isOff) return [];

    // Check time-off blocks overlapping this day
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const timeOffBlocks = await this.prisma.timeOffBlock.findMany({
      where: {
        staffId: staff.id,
        startAt: { lte: dayEnd },
        endAt: { gte: dayStart },
      },
    });

    // Existing confirmed/pending appointments for this staff on this day
    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        staffId: staff.id,
        startAt: { gte: dayStart },
        endAt: { lte: dayEnd },
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      },
    });

    // Generate candidate slots
    const [openH, openM] = schedule.startTime.split(':').map(Number);
    const [closeH, closeM] = schedule.endTime.split(':').map(Number);

    const workStart = new Date(date);
    workStart.setHours(openH, openM, 0, 0);
    const workEnd = new Date(date);
    workEnd.setHours(closeH, closeM, 0, 0);

    const slots: { staffId: string; staffName: string; startAt: Date; endAt: Date; isLocked: boolean }[] = [];
    const cursor = new Date(workStart);

    while (cursor.getTime() + service.durationMin * 60000 <= workEnd.getTime()) {
      const slotStart = new Date(cursor);
      const slotEnd = new Date(cursor.getTime() + service.durationMin * 60000);

      const isBlocked = this.overlapsAny(slotStart, slotEnd, [
        ...timeOffBlocks,
        ...existingAppointments,
      ]);

      if (!isBlocked) {
        const isLocked = await this.slotLock.isLocked(salonId, staff.id, slotStart);
        slots.push({
          staffId: staff.id,
          staffName: `${staff.firstName} ${staff.lastName}`,
          startAt: new Date(slotStart),
          endAt: new Date(slotEnd),
          isLocked,
        });
      }

      cursor.setMinutes(cursor.getMinutes() + SLOT_INTERVAL_MIN);
    }

    return slots;
  }

  private overlapsAny(
    slotStart: Date,
    slotEnd: Date,
    blocks: { startAt: Date; endAt: Date }[],
  ): boolean {
    return blocks.some(
      (b) => slotStart < b.endAt && slotEnd > b.startAt,
    );
  }

  private getDayOfWeek(date: Date): string {
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    return days[date.getDay()];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SLOT LOCK
  // ═══════════════════════════════════════════════════════════════════════════

  async lockSlot(salonId: string, dto: LockSlotDto) {
    const salon = await this.prisma.salon.findUnique({ where: { id: salonId } });
    if (!salon) throw new NotFoundException('Salon not found');

    // Verify slot is actually available before locking
    const startAt = new Date(dto.startAt);
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, salonId, isActive: true },
    });
    if (!service) throw new NotFoundException('Service not found');

    const existingAppt = await this.prisma.appointment.findFirst({
      where: {
        staffId: dto.staffId,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
        startAt: { lt: new Date(startAt.getTime() + service.durationMin * 60000) },
        endAt: { gt: startAt },
      },
    });
    if (existingAppt) throw new ConflictException('Slot is already booked');

    const ttlSeconds = (salon.slotLockDurationMin ?? 5) * 60;
    await this.slotLock.acquireLock(salonId, dto.staffId, startAt, dto.sessionId, ttlSeconds);

    return {
      locked: true,
      expiresIn: ttlSeconds,
      staffId: dto.staffId,
      startAt,
    };
  }

  async releaseLock(salonId: string, dto: LockSlotDto) {
    await this.slotLock.releaseLock(
      salonId,
      dto.staffId,
      new Date(dto.startAt),
      dto.sessionId,
    );
    return { released: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOKING — Create
  // ═══════════════════════════════════════════════════════════════════════════

  async create(clientId: string, dto: CreateAppointmentDto) {
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, salonId: dto.salonId, isActive: true },
    });
    if (!service) throw new NotFoundException('Service not found or inactive');

    const startAt = new Date(dto.startAt);
    const endAt = new Date(startAt.getTime() + service.durationMin * 60000);

    // Double-check no overlapping appointment (race condition safety)
    const overlap = await this.prisma.appointment.findFirst({
      where: {
        staffId: dto.staffId,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });
    if (overlap) throw new ConflictException('The selected slot is no longer available');

    // Create the appointment
    const appointment = await this.prisma.appointment.create({
      data: {
        clientId,
        salonId: dto.salonId,
        staffId: dto.staffId,
        serviceId: dto.serviceId,
        startAt,
        endAt,
        source: dto.source ?? BookingSource.ONLINE,
        guestName: dto.guestName,
        guestPhone: dto.guestPhone,
        clientNotes: dto.clientNotes,
        priceSnapshot: service.price,
        currency: service.currency,
        status: AppointmentStatus.PENDING,
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, phone: true } },
        staff: { select: { id: true, firstName: true, lastName: true } },
        service: { select: { id: true, name: true, durationMin: true, price: true } },
        salon: { select: { id: true, name: true, phone: true, addressLine1: true } },
      },
    });

    // Release the slot lock now that booking is confirmed
    if (dto.sessionId) {
      await this.slotLock
        .releaseLock(dto.salonId, dto.staffId, startAt, dto.sessionId)
        .catch(() => {}); // non-fatal if lock already expired
    }

    return appointment;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  async findForSalon(salonId: string, date?: string) {
    const where: any = { salonId };
    if (date) {
      const day = new Date(date);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      where.startAt = { gte: day, lt: nextDay };
    }

    return this.prisma.appointment.findMany({
      where,
      include: {
        client: { select: { id: true, firstName: true, lastName: true, phone: true } },
        staff: { select: { id: true, firstName: true, lastName: true } },
        service: { select: { id: true, name: true, durationMin: true } },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  async findForClient(clientId: string) {
    return this.prisma.appointment.findMany({
      where: { clientId },
      include: {
        salon: { select: { id: true, name: true, logoUrl: true, addressLine1: true } },
        staff: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        service: { select: { id: true, name: true, durationMin: true, price: true } },
        review: { select: { id: true, rating: true } },
      },
      orderBy: { startAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, phone: true } },
        staff: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        service: true,
        salon: true,
        review: true,
        payment: true,
      },
    });
    if (!appt) throw new NotFoundException('Appointment not found');
    return appt;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS TRANSITIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async updateStatus(id: string, actorId: string, dto: UpdateAppointmentDto) {
    const appt = await this.prisma.appointment.findUnique({ where: { id }, include: { salon: true } });
    if (!appt) throw new NotFoundException('Appointment not found');

    // Permission check: salon admin or the client
    const isAdmin = appt.salon.adminId === actorId;
    const isClient = appt.clientId === actorId;
    if (!isAdmin && !isClient) throw new ForbiddenException('Access denied');

    // Validate transitions
    if (dto.status) {
      this.validateTransition(appt.status, dto.status, isClient);
    }

    const data: any = { ...dto };
    if (dto.status === AppointmentStatus.CANCELLED) {
      data.cancelledAt = new Date();
      data.cancelledBy = actorId;
    }

    return this.prisma.appointment.update({
      where: { id },
      data,
      include: {
        staff: { select: { id: true, firstName: true, lastName: true } },
        service: { select: { id: true, name: true } },
      },
    });
  }

  private validateTransition(
    current: AppointmentStatus,
    next: AppointmentStatus,
    isClient: boolean,
  ) {
    const allowed: Record<AppointmentStatus, AppointmentStatus[]> = {
      PENDING: [AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED],
      CONFIRMED: [AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW, AppointmentStatus.CANCELLED],
      CANCELLED: [],
      COMPLETED: [],
      NO_SHOW: [],
    };

    if (!allowed[current].includes(next)) {
      throw new BadRequestException(`Cannot transition from ${current} to ${next}`);
    }

    // Clients can only cancel, not confirm/complete/no-show
    if (isClient && next !== AppointmentStatus.CANCELLED) {
      throw new ForbiddenException('Clients can only cancel appointments');
    }
  }
}
