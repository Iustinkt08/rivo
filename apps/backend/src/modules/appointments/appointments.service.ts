import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SlotLockService } from './slot-lock.service';
import {
  NotificationsService,
  NotificationType,
} from '../notifications/notifications.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { LockSlotDto } from './dto/lock-slot.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { AppointmentStatus, BookingSource } from '@prisma/client';
import { DAY_MS, buildBuckets, resolveWindow } from './analytics-buckets';

const SLOT_INTERVAL_MIN = 15; // generate slots every 15 minutes

// Booking window: small grace for clock skew, capped horizon against garbage data.
const BOOKING_PAST_GRACE_MS = 5 * 60_000;
const MAX_BOOKING_HORIZON_DAYS = 365;

// All salons operate in Romania — day filters must use the salon's calendar
// day, not the server/UTC one (an appointment at 00:30 local belongs to that
// local day even though its UTC timestamp falls on the previous evening).
const SALON_TIMEZONE = 'Europe/Bucharest';

// "GMT+03:00" → "+03:00" for the given calendar date (DST-aware).
function timezoneOffsetSuffix(date: string, timeZone: string): string {
  const probe = new Date(`${date}T12:00:00Z`);
  const tzName = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  })
    .formatToParts(probe)
    .find((p) => p.type === 'timeZoneName')?.value;
  const offset = tzName?.replace('GMT', '');
  return offset?.length ? offset : '+00:00';
}

// [start, end) of the salon-local calendar day; DST-correct because each
// boundary uses its own date's offset.
export function salonDayWindow(date: string): { start: Date; end: Date } {
  const start = new Date(
    `${date}T00:00:00${timezoneOffsetSuffix(date, SALON_TIMEZONE)}`,
  );
  const probe = new Date(`${date}T12:00:00Z`);
  probe.setUTCDate(probe.getUTCDate() + 1);
  const next = probe.toISOString().split('T')[0];
  const end = new Date(
    `${next}T00:00:00${timezoneOffsetSuffix(next, SALON_TIMEZONE)}`,
  );
  return { start, end };
}

// Human-readable date+time for notification bodies, in the salon's timezone.
function formatRoDateTime(d: Date): string {
  return d.toLocaleString('ro-RO', {
    timeZone: 'Europe/Bucharest',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly slotLock: SlotLockService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Access helpers ──────────────────────────────────────────────────────────

  // Salon-scoped business endpoints: caller must be the salon admin or an
  // active staff member of that salon (mirrors assertSalonOwner in siblings).
  // Returns the caller's staff row (null for the admin) so callers can scope
  // results — staff accounts only ever see their own appointments/figures.
  private async assertSalonAccess(salonId: string, userId: string) {
    const salon = await this.prisma.salon.findUnique({
      where: { id: salonId },
    });
    if (!salon) throw new NotFoundException('Salon not found');
    if (salon.adminId === userId) return { salon, callerStaff: null };

    const staff = await this.prisma.staff.findFirst({
      where: { salonId, userId, isActive: true },
    });
    if (!staff) throw new ForbiddenException('Not your salon');
    return { salon, callerStaff: staff };
  }

  // The caller's staff row for a salon, or null when they are not staff there.
  private resolveCallerStaff(salonId: string, userId: string) {
    return this.prisma.staff.findFirst({
      where: { salonId, userId, isActive: true },
    });
  }

  // Cross-tenant guard: the staff member being booked must belong to the salon.
  private async assertStaffInSalon(staffId: string, salonId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, salonId, isActive: true },
    });
    if (!staff)
      throw new NotFoundException('Staff member not found for this salon');
    return staff;
  }

  private assertBookableWindow(startAt: Date) {
    const now = Date.now();
    if (Number.isNaN(startAt.getTime()))
      throw new BadRequestException('Invalid start date');
    if (startAt.getTime() < now - BOOKING_PAST_GRACE_MS)
      throw new BadRequestException('Cannot book a slot in the past');
    if (startAt.getTime() > now + MAX_BOOKING_HORIZON_DAYS * DAY_MS)
      throw new BadRequestException('Booking date is too far in the future');
  }

  // ─── Analytics (salon dashboard) ─────────────────────────────────────────────

  /**
   * Aggregate real appointment data for a salon over a selectable window.
   *
   * Presets: `week` = last 7 days (7 daily buckets), `month` = last 30 days
   * (4 weekly buckets), `year` = last 12 months (12 monthly buckets). When both
   * `from` and `to` are supplied the window is that custom range and buckets are
   * chosen by span (daily ≤ 31d, weekly ≤ 168d, else monthly).
   *
   * Bar labels are computed server-side in Romanian. Cancelled / no-show
   * appointments are excluded from revenue and counts.
   */
  async getAnalytics(
    salonId: string,
    userId: string,
    opts: { range?: 'week' | 'month' | 'year'; from?: Date; to?: Date } = {},
  ) {
    const { callerStaff } = await this.assertSalonAccess(salonId, userId);
    const { range, from, to } = resolveWindow(opts);
    const { labels, assign } = buildBuckets(range, from, to);

    const appts = await this.prisma.appointment.findMany({
      where: {
        salonId,
        // Staff accounts only see their own figures, never salon-wide revenue.
        ...(callerStaff ? { staffId: callerStaff.id } : {}),
        startAt: { gte: from, lte: to },
        status: {
          notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
        },
      },
      select: {
        startAt: true,
        status: true,
        priceSnapshot: true,
        serviceId: true,
        staffId: true,
        service: { select: { id: true, name: true } },
        staff: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    type Agg = { id: string; name: string; count: number; revenue: number };
    const serviceMap = new Map<string, Agg>();
    const staffMap = new Map<string, Agg>();
    const bucketValues = Array.from({ length: labels.length }, () => 0);

    let revenue = 0;
    let completedCount = 0;

    for (const a of appts) {
      const price = Number(a.priceSnapshot);
      revenue += price;
      if (a.status === AppointmentStatus.COMPLETED) completedCount += 1;

      const svcName = a.service?.name ?? 'Serviciu';
      const svc = serviceMap.get(a.serviceId) ?? {
        id: a.serviceId,
        name: svcName,
        count: 0,
        revenue: 0,
      };
      svc.count += 1;
      svc.revenue += price;
      serviceMap.set(a.serviceId, svc);

      const stfName =
        `${a.staff?.firstName ?? ''} ${a.staff?.lastName ?? ''}`.trim() ||
        'Staff';
      const stf = staffMap.get(a.staffId) ?? {
        id: a.staffId,
        name: stfName,
        count: 0,
        revenue: 0,
      };
      stf.count += 1;
      stf.revenue += price;
      staffMap.set(a.staffId, stf);

      bucketValues[assign(new Date(a.startAt))] += price;
    }

    const topServices = [...serviceMap.values()]
      .sort((x, y) => y.count - x.count)
      .slice(0, 5);
    const topStaff = [...staffMap.values()]
      .sort((x, y) => y.count - x.count)
      .slice(0, 5);

    const bars = labels.map((label, i) => ({ label, value: bucketValues[i] }));

    return {
      range,
      from: from.toISOString(),
      to: to.toISOString(),
      revenue,
      appointmentCount: appts.length,
      completedCount,
      bars,
      topServices,
      topStaff,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AVAILABILITY
  // ═══════════════════════════════════════════════════════════════════════════

  async getAvailability(salonId: string, query: AvailabilityQueryDto) {
    const service = await this.prisma.service.findFirst({
      where: { id: query.serviceId, salonId, isActive: true },
    });
    if (!service) throw new NotFoundException('Service not found or inactive');

    // Resolve candidate staff
    const staffList = await this.resolveStaff(
      salonId,
      query.serviceId,
      query.staffId,
    );
    if (!staffList.length)
      throw new NotFoundException('No available staff for this service');

    const date = new Date(query.date);
    const dayOfWeek = this.getDayOfWeek(date);

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const staffIds = staffList.map((s) => s.id);

    // Batch-load time-off blocks and existing appointments for ALL staff in two
    // queries, instead of two DB round-trips per staff member (was the N+1 hot spot).
    const [timeOffBlocks, existingAppointments] = await Promise.all([
      this.prisma.timeOffBlock.findMany({
        where: {
          staffId: { in: staffIds },
          startAt: { lte: dayEnd },
          endAt: { gte: dayStart },
        },
      }),
      this.prisma.appointment.findMany({
        where: {
          staffId: { in: staffIds },
          startAt: { gte: dayStart },
          endAt: { lte: dayEnd },
          status: {
            in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
          },
        },
      }),
    ]);

    const timeOffByStaff = this.groupByStaff(timeOffBlocks);
    const apptsByStaff = this.groupByStaff(existingAppointments);

    const results = await Promise.all(
      staffList.map((staff) =>
        this.getSlotsForStaff(
          staff,
          service,
          date,
          dayOfWeek,
          salonId,
          timeOffByStaff.get(staff.id) ?? [],
          apptsByStaff.get(staff.id) ?? [],
        ),
      ),
    );

    return results
      .flat()
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  }

  private async resolveStaff(
    salonId: string,
    serviceId: string,
    staffId?: string,
  ) {
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
    timeOffBlocks: { startAt: Date; endAt: Date }[],
    existingAppointments: { startAt: Date; endAt: Date }[],
  ): Promise<
    {
      staffId: string;
      staffName: string;
      startAt: Date;
      endAt: Date;
      isLocked: boolean;
    }[]
  > {
    const schedule = staff.workSchedules.find(
      (s: any) => s.dayOfWeek === dayOfWeek,
    );
    if (!schedule || schedule.isOff) return [];

    const [openH, openM] = schedule.startTime.split(':').map(Number);
    const [closeH, closeM] = schedule.endTime.split(':').map(Number);

    const workStart = new Date(date);
    workStart.setHours(openH, openM, 0, 0);
    const workEnd = new Date(date);
    workEnd.setHours(closeH, closeM, 0, 0);

    const blocks = [...timeOffBlocks, ...existingAppointments];

    // First pass: collect non-blocked candidate slots (pure, no I/O).
    const candidates: { startAt: Date; endAt: Date }[] = [];
    const cursor = new Date(workStart);
    while (
      cursor.getTime() + service.durationMin * 60000 <=
      workEnd.getTime()
    ) {
      const slotStart = new Date(cursor);
      const slotEnd = new Date(cursor.getTime() + service.durationMin * 60000);
      if (!this.overlapsAny(slotStart, slotEnd, blocks)) {
        candidates.push({ startAt: slotStart, endAt: slotEnd });
      }
      cursor.setMinutes(cursor.getMinutes() + SLOT_INTERVAL_MIN);
    }

    // Second pass: resolve lock state for all candidates in parallel
    // (previously each isLocked check was awaited serially inside the loop).
    const lockStates = await Promise.all(
      candidates.map((c) =>
        this.slotLock.isLocked(salonId, staff.id, c.startAt),
      ),
    );

    return candidates.map((c, i) => ({
      staffId: staff.id,
      staffName: `${staff.firstName} ${staff.lastName}`,
      startAt: new Date(c.startAt),
      endAt: new Date(c.endAt),
      isLocked: lockStates[i],
    }));
  }

  private overlapsAny(
    slotStart: Date,
    slotEnd: Date,
    blocks: { startAt: Date; endAt: Date }[],
  ): boolean {
    return blocks.some((b) => slotStart < b.endAt && slotEnd > b.startAt);
  }

  private getDayOfWeek(date: Date): string {
    const days = [
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ];
    return days[date.getDay()];
  }

  private groupByStaff<T extends { staffId: string }>(
    items: T[],
  ): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const item of items) {
      const arr = map.get(item.staffId);
      if (arr) arr.push(item);
      else map.set(item.staffId, [item]);
    }
    return map;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SLOT LOCK
  // ═══════════════════════════════════════════════════════════════════════════

  async lockSlot(salonId: string, dto: LockSlotDto) {
    const salon = await this.prisma.salon.findUnique({
      where: { id: salonId },
    });
    if (!salon) throw new NotFoundException('Salon not found');

    // Verify slot is actually available before locking
    const startAt = new Date(dto.startAt);
    this.assertBookableWindow(startAt);
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, salonId, isActive: true },
    });
    if (!service) throw new NotFoundException('Service not found');

    await this.assertStaffInSalon(dto.staffId, salonId);

    const existingAppt = await this.prisma.appointment.findFirst({
      where: {
        staffId: dto.staffId,
        status: {
          in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
        },
        startAt: {
          lt: new Date(startAt.getTime() + service.durationMin * 60000),
        },
        endAt: { gt: startAt },
      },
    });
    if (existingAppt) throw new ConflictException('Slot is already booked');

    const ttlSeconds = (salon.slotLockDurationMin ?? 5) * 60;
    await this.slotLock.acquireLock(
      salonId,
      dto.staffId,
      startAt,
      dto.sessionId,
      ttlSeconds,
    );

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

    await this.assertStaffInSalon(dto.staffId, dto.salonId);

    // Salon-level mini-CRM: a blocked client cannot book at this salon
    const clientProfile = await this.prisma.clientSalonProfile.findUnique({
      where: { salonId_clientId: { salonId: dto.salonId, clientId } },
    });
    if (clientProfile?.isBlocked) {
      throw new ForbiddenException('You are blocked by this salon');
    }

    const startAt = new Date(dto.startAt);
    this.assertBookableWindow(startAt);
    const endAt = new Date(startAt.getTime() + service.durationMin * 60000);

    // Overlap check + insert run in one transaction so two concurrent bookings
    // for the same staff/slot can't both pass the check and both commit (TOCTOU).
    const appointment = await this.prisma.$transaction(async (tx) => {
      const overlap = await tx.appointment.findFirst({
        where: {
          staffId: dto.staffId,
          status: {
            in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
          },
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
      });
      if (overlap)
        throw new ConflictException('The selected slot is no longer available');

      return tx.appointment.create({
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
          client: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
          staff: { select: { id: true, firstName: true, lastName: true } },
          service: {
            select: { id: true, name: true, durationMin: true, price: true },
          },
          salon: {
            select: {
              id: true,
              name: true,
              phone: true,
              addressLine1: true,
              adminId: true,
            },
          },
        },
      });
    });

    // Ensure the client appears in the salon's client list (idempotent);
    // a failure here must not undo an already-confirmed booking.
    try {
      await this.prisma.clientSalonProfile.upsert({
        where: { salonId_clientId: { salonId: dto.salonId, clientId } },
        create: { salonId: dto.salonId, clientId },
        update: {},
      });
    } catch (err) {
      this.logger.warn(
        `Failed to upsert client salon profile (salon=${dto.salonId}, client=${clientId}): ${
          err instanceof Error ? err.message : err
        }`,
      );
    }

    // In-app notification for the salon admin; never blocks the booking.
    try {
      const clientName =
        appointment.guestName ??
        `${appointment.client?.firstName ?? ''} ${appointment.client?.lastName ?? ''}`.trim();
      await this.notifications.notify(appointment.salon.adminId, {
        type: 'NEW_BOOKING',
        title: 'Programare nouă',
        body: `${clientName || 'Un client'} — ${appointment.service.name}, ${formatRoDateTime(appointment.startAt)}`,
        appointmentId: appointment.id,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to create NEW_BOOKING notification (appointment=${appointment.id}): ${
          err instanceof Error ? err.message : err
        }`,
      );
    }

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

  async findForSalon(salonId: string, userId: string, date?: string) {
    const { callerStaff } = await this.assertSalonAccess(salonId, userId);
    const where: any = { salonId };
    // Staff accounts only see their own calendar, never the whole salon's.
    if (callerStaff) where.staffId = callerStaff.id;
    if (date) {
      const { start, end } = salonDayWindow(date);
      where.startAt = { gte: start, lt: end };
    }

    return this.prisma.appointment.findMany({
      where,
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
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
        salon: {
          select: { id: true, name: true, logoUrl: true, addressLine1: true },
        },
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        service: {
          select: { id: true, name: true, durationMin: true, price: true },
        },
        review: { select: { id: true, rating: true } },
      },
      orderBy: { startAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        service: true,
        salon: true,
        review: true,
        payment: true,
      },
    });
    if (!appt) throw new NotFoundException('Appointment not found');

    // Only the booking client, the salon admin, or the assigned staff member
    // may read full details (includes client PII and payment data).
    const isClient = appt.clientId === userId;
    const isAdmin = appt.salon.adminId === userId;
    if (!isClient && !isAdmin) {
      const staffMember = await this.resolveCallerStaff(appt.salonId, userId);
      if (!staffMember || staffMember.id !== appt.staffId) {
        throw new ForbiddenException('Access denied');
      }
    }

    return appt;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS TRANSITIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async updateStatus(id: string, actorId: string, dto: UpdateAppointmentDto) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id },
      include: { salon: true },
    });
    if (!appt) throw new NotFoundException('Appointment not found');

    // Permission check: salon admin, the client, or the assigned staff member
    // (staff manage ONLY their own appointments).
    const isAdmin = appt.salon.adminId === actorId;
    const isClient = appt.clientId === actorId;
    let isAssignedStaff = false;
    if (!isAdmin && !isClient) {
      const staffActor = await this.resolveCallerStaff(appt.salonId, actorId);
      isAssignedStaff = !!staffActor && staffActor.id === appt.staffId;
      if (!isAssignedStaff) throw new ForbiddenException('Access denied');
    }

    // Internal notes are salon-side annotations — clients may never write them.
    if (isClient && dto.internalNotes !== undefined) {
      throw new ForbiddenException('Clients cannot set internal notes');
    }

    // Validate transitions
    if (dto.status) {
      this.validateTransition(appt.status, dto.status, isClient);

      // COMPLETED / NO_SHOW only make sense once the appointment has started —
      // before that the salon can only accept (CONFIRMED) or cancel.
      const isClosingStatus =
        dto.status === AppointmentStatus.COMPLETED ||
        dto.status === AppointmentStatus.NO_SHOW;
      if (isClosingStatus && Date.now() < appt.startAt.getTime()) {
        throw new BadRequestException('Appointment has not started yet');
      }
    }

    const data: any = { ...dto };
    if (dto.status === AppointmentStatus.CANCELLED) {
      data.cancelledAt = new Date();
      data.cancelledBy = actorId;
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data,
      include: {
        staff: { select: { id: true, firstName: true, lastName: true } },
        service: { select: { id: true, name: true } },
      },
    });

    if (dto.status) {
      await this.notifyStatusChange(
        { clientId: appt.clientId, adminId: appt.salon.adminId },
        updated,
        dto.status,
        // Assigned staff act on the salon's behalf → the client gets notified.
        isAdmin || isAssignedStaff,
      );
    }

    return updated;
  }

  /**
   * Move an appointment to a new start time (and optionally another staff
   * member). Allowed for the salon admin, or for the assigned staff member on
   * their own appointment. The client is notified about the new time
   * (non-fatal).
   */
  async reschedule(id: string, actorId: string, dto: RescheduleAppointmentDto) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        salon: true,
        service: { select: { durationMin: true, name: true } },
      },
    });
    if (!appt) throw new NotFoundException('Appointment not found');

    // Salon admin, or the assigned staff member moving their own appointment.
    const isAdmin = appt.salon.adminId === actorId;
    let staffActor: { id: string } | null = null;
    if (!isAdmin) {
      staffActor = await this.resolveCallerStaff(appt.salonId, actorId);
      if (!staffActor || staffActor.id !== appt.staffId) {
        throw new ForbiddenException(
          'Only the salon admin or the assigned staff member can reschedule',
        );
      }
    }

    const isReschedulable =
      appt.status === AppointmentStatus.PENDING ||
      appt.status === AppointmentStatus.CONFIRMED;
    if (!isReschedulable) {
      throw new BadRequestException(
        `Cannot reschedule a ${appt.status} appointment`,
      );
    }

    const startAt = new Date(dto.startAt);
    this.assertBookableWindow(startAt);

    const targetStaffId = dto.staffId ?? appt.staffId;
    // Staff can move the time of their own appointment, not hand it to others.
    if (staffActor && targetStaffId !== staffActor.id) {
      throw new ForbiddenException(
        'Staff can only reschedule their own appointments',
      );
    }
    if (targetStaffId !== appt.staffId) {
      await this.assertStaffInSalon(targetStaffId, appt.salonId);
    }

    const endAt = new Date(
      startAt.getTime() + appt.service.durationMin * 60000,
    );

    // Overlap check + move run in one transaction so two concurrent reschedules
    // onto the same slot can't both pass the check and both commit (TOCTOU).
    const updated = await this.prisma.$transaction(async (tx) => {
      const overlap = await tx.appointment.findFirst({
        where: {
          id: { not: id },
          staffId: targetStaffId,
          status: {
            in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
          },
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
      });
      if (overlap)
        throw new ConflictException('The selected slot is no longer available');

      return tx.appointment.update({
        where: { id },
        data: { startAt, endAt, staffId: targetStaffId },
        include: {
          staff: { select: { id: true, firstName: true, lastName: true } },
          service: { select: { id: true, name: true } },
        },
      });
    });

    // Tell the client about the new time; never blocks the reschedule.
    try {
      await this.notifications.notify(appt.clientId, {
        type: 'REMINDER',
        title: 'Programare mutată',
        body: `${appt.service.name} a fost mutată la ${formatRoDateTime(startAt)}.`,
        appointmentId: updated.id,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to create reschedule notification (appointment=${updated.id}): ${
          err instanceof Error ? err.message : err
        }`,
      );
    }

    return updated;
  }

  // In-app notifications for status transitions; failures only log a warning.
  private async notifyStatusChange(
    parties: { clientId: string; adminId: string },
    updated: { id: string; startAt: Date; service?: { name: string } | null },
    status: AppointmentStatus,
    actorIsAdmin: boolean,
  ) {
    try {
      const when = formatRoDateTime(new Date(updated.startAt));
      const serviceName = updated.service?.name ?? 'Programarea';

      if (actorIsAdmin) {
        const byStatus: Partial<
          Record<
            AppointmentStatus,
            { type: NotificationType; title: string; body: string }
          >
        > = {
          [AppointmentStatus.CONFIRMED]: {
            type: 'REMINDER',
            title: 'Programare confirmată',
            body: `${serviceName} din ${when} a fost confirmată de salon.`,
          },
          [AppointmentStatus.CANCELLED]: {
            type: 'CANCELLATION',
            title: 'Programare anulată',
            body: `${serviceName} din ${when} a fost anulată de salon.`,
          },
          [AppointmentStatus.NO_SHOW]: {
            type: 'NO_SHOW',
            title: 'Neprezentare înregistrată',
            body: `${serviceName} din ${when} a fost marcată ca neprezentare.`,
          },
        };
        const payload = byStatus[status];
        if (payload) {
          await this.notifications.notify(parties.clientId, {
            ...payload,
            appointmentId: updated.id,
          });
        }
        return;
      }

      if (status === AppointmentStatus.CANCELLED) {
        await this.notifications.notify(parties.adminId, {
          type: 'CANCELLATION',
          title: 'Programare anulată de client',
          body: `${serviceName} din ${when} a fost anulată de client.`,
          appointmentId: updated.id,
        });
      }
    } catch (err) {
      this.logger.warn(
        `Failed to create status-change notification (appointment=${updated.id}, status=${status}): ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }

  private validateTransition(
    current: AppointmentStatus,
    next: AppointmentStatus,
    isClient: boolean,
  ) {
    const allowed: Record<AppointmentStatus, AppointmentStatus[]> = {
      PENDING: [AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED],
      CONFIRMED: [
        AppointmentStatus.COMPLETED,
        AppointmentStatus.NO_SHOW,
        AppointmentStatus.CANCELLED,
      ],
      CANCELLED: [],
      COMPLETED: [],
      NO_SHOW: [],
    };

    if (!allowed[current].includes(next)) {
      throw new BadRequestException(
        `Cannot transition from ${current} to ${next}`,
      );
    }

    // Clients can only cancel, not confirm/complete/no-show
    if (isClient && next !== AppointmentStatus.CANCELLED) {
      throw new ForbiddenException('Clients can only cancel appointments');
    }
  }
}
