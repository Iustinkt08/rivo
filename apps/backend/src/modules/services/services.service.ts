import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

/** Relations returned to clients: category + assigned staff ids. */
const SERVICE_INCLUDE = {
  category: true,
  staffServices: { select: { staffId: true } },
} as const;

/** Old → new numeric value for a changed service attribute. */
interface ValueChange {
  from: number;
  to: number;
}

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async assertSalonOwner(salonId: string, userId: string) {
    const salon = await this.prisma.salon.findUnique({
      where: { id: salonId },
    });
    if (!salon) throw new NotFoundException('Salon not found');
    if (salon.adminId !== userId)
      throw new ForbiddenException('Not your salon');
    return salon;
  }

  /**
   * Validates that every staff id belongs to the given salon.
   * Returns the deduplicated list ready for join-row sync.
   */
  private async assertStaffBelongToSalon(
    salonId: string,
    staffIds: string[],
  ): Promise<string[]> {
    const uniqueIds = [...new Set(staffIds)];
    if (uniqueIds.length === 0) return [];

    const found = await this.prisma.staff.findMany({
      where: { id: { in: uniqueIds }, salonId },
      select: { id: true },
    });
    if (found.length !== uniqueIds.length) {
      throw new BadRequestException(
        'Some staff members do not belong to this salon',
      );
    }
    return uniqueIds;
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  async findAll(salonId: string) {
    return this.prisma.service.findMany({
      where: { salonId },
      include: SERVICE_INCLUDE,
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    });
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  async create(salonId: string, userId: string, dto: CreateServiceDto) {
    await this.assertSalonOwner(salonId, userId);

    const staffIds =
      dto.staffIds !== undefined
        ? await this.assertStaffBelongToSalon(salonId, dto.staffIds)
        : undefined;

    return this.prisma.$transaction(async (tx) => {
      const service = await tx.service.create({
        data: {
          salonId,
          categoryId: dto.categoryId,
          name: dto.name,
          description: dto.description,
          durationMin: dto.durationMin,
          price: dto.price,
          currency: dto.currency ?? 'RON',
          isActive: dto.isActive ?? true,
        },
      });

      if (staffIds !== undefined && staffIds.length > 0) {
        await tx.staffService.createMany({
          data: staffIds.map((staffId) => ({
            staffId,
            serviceId: service.id,
          })),
        });
      }

      return tx.service.findUniqueOrThrow({
        where: { id: service.id },
        include: SERVICE_INCLUDE,
      });
    });
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  async update(
    salonId: string,
    serviceId: string,
    userId: string,
    dto: UpdateServiceDto,
  ) {
    await this.assertSalonOwner(salonId, userId);

    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, salonId },
    });
    if (!service) throw new NotFoundException('Service not found');

    // staffIds drives the join-row sync and must not be spread into `data`.
    const { staffIds, ...serviceData } = dto;
    const validatedStaffIds =
      staffIds !== undefined
        ? await this.assertStaffBelongToSalon(salonId, staffIds)
        : undefined;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.service.update({
        where: { id: serviceId },
        data: serviceData,
      });

      if (validatedStaffIds !== undefined) {
        // Replace assignments to match the provided list exactly.
        await tx.staffService.deleteMany({ where: { serviceId } });
        if (validatedStaffIds.length > 0) {
          await tx.staffService.createMany({
            data: validatedStaffIds.map((staffId) => ({
              staffId,
              serviceId,
            })),
          });
        }
      }

      return tx.service.findUniqueOrThrow({
        where: { id: updated.id },
        include: SERVICE_INCLUDE,
      });
    });

    // Notify affected clients about real price/duration changes. Awaited but
    // fire-and-forget in effect: every failure is logged, never thrown, so the
    // update itself can no longer fail past this point.
    const priceChange = this.detectChange(service.price, serviceData.price);
    const durationChange = this.detectChange(
      service.durationMin,
      serviceData.durationMin,
    );
    if (priceChange || durationChange) {
      await this.notifyServiceChanges(
        serviceId,
        serviceData.name ?? service.name,
        service.currency ?? 'RON',
        { price: priceChange, duration: durationChange },
      );
    }

    return result;
  }

  /** Returns the old → new pair when the value was provided AND actually differs. */
  private detectChange(
    oldValue: unknown,
    newValue: number | undefined,
  ): ValueChange | null {
    if (newValue === undefined) return null;
    const from = Number(oldValue);
    const to = Number(newValue);
    if (from === to) return null;
    return { from, to };
  }

  /**
   * Notifies every distinct registered client (guests excluded) holding a
   * future PENDING/CONFIRMED appointment on this service about a price or
   * duration change. All failures are logged and swallowed — a notification
   * problem must never surface as a failed service update.
   */
  private async notifyServiceChanges(
    serviceId: string,
    serviceName: string,
    currency: string,
    changes: { price: ValueChange | null; duration: ValueChange | null },
  ): Promise<void> {
    try {
      const holders = await this.prisma.appointment.findMany({
        where: {
          serviceId,
          guestName: null, // registered clients only — guests have no account
          startAt: { gt: new Date() },
          status: {
            in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
          },
        },
        select: { clientId: true },
        distinct: ['clientId'],
      });

      for (const { clientId } of holders) {
        if (changes.price) {
          await this.notifications
            .notify(clientId, {
              type: 'PRICE_CHANGE',
              title: 'Preț modificat',
              body: `Prețul serviciului „${serviceName}” s-a schimbat de la ${changes.price.from} ${currency} la ${changes.price.to} ${currency}.`,
            })
            .catch((err) =>
              this.logNotifyFailure(serviceId, clientId, 'PRICE_CHANGE', err),
            );
        }
        if (changes.duration) {
          await this.notifications
            .notify(clientId, {
              type: 'DURATION_CHANGE',
              title: 'Durată modificată',
              body: `Durata serviciului „${serviceName}” s-a schimbat de la ${changes.duration.from} min la ${changes.duration.to} min.`,
            })
            .catch((err) =>
              this.logNotifyFailure(
                serviceId,
                clientId,
                'DURATION_CHANGE',
                err,
              ),
            );
        }
      }
    } catch (err) {
      this.logger.warn(
        `Failed to notify clients about service change (service=${serviceId}): ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }

  private logNotifyFailure(
    serviceId: string,
    clientId: string,
    type: string,
    err: unknown,
  ) {
    this.logger.warn(
      `Failed to create ${type} notification (service=${serviceId}, client=${clientId}): ${
        err instanceof Error ? err.message : err
      }`,
    );
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  async remove(salonId: string, serviceId: string, userId: string) {
    await this.assertSalonOwner(salonId, userId);

    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, salonId },
    });
    if (!service) throw new NotFoundException('Service not found');

    await this.prisma.service.delete({ where: { id: serviceId } });
  }

  // ─── Toggle active ───────────────────────────────────────────────────────────

  async toggleActive(salonId: string, serviceId: string, userId: string) {
    await this.assertSalonOwner(salonId, userId);

    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, salonId },
    });
    if (!service) throw new NotFoundException('Service not found');

    return this.prisma.service.update({
      where: { id: serviceId },
      data: { isActive: !service.isActive },
      include: SERVICE_INCLUDE,
    });
  }
}
