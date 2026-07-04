import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

/** Relations returned to clients: category + assigned staff ids. */
const SERVICE_INCLUDE = {
  category: true,
  staffServices: { select: { staffId: true } },
} as const;

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.$transaction(async (tx) => {
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
