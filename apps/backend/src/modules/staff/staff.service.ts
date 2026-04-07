import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { SetScheduleDto } from './dto/set-schedule.dto';
import { CreateTimeOffDto } from './dto/create-time-off.dto';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async assertSalonOwner(salonId: string, userId: string) {
    const salon = await this.prisma.salon.findUnique({ where: { id: salonId } });
    if (!salon) throw new NotFoundException('Salon not found');
    if (salon.adminId !== userId) throw new ForbiddenException('Not your salon');
    return salon;
  }

  private async findStaffInSalon(staffId: string, salonId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, salonId },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    return staff;
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  async findAll(salonId: string) {
    return this.prisma.staff.findMany({
      where: { salonId, isActive: true },
      include: {
        staffServices: { include: { service: true } },
        workSchedules: true,
      },
      orderBy: { firstName: 'asc' },
    });
  }

  async findOne(salonId: string, staffId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, salonId },
      include: {
        staffServices: { include: { service: { include: { category: true } } } },
        workSchedules: { orderBy: { dayOfWeek: 'asc' } },
        timeOffBlocks: {
          where: { endAt: { gte: new Date() } },
          orderBy: { startAt: 'asc' },
        },
      },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    return staff;
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  async create(salonId: string, userId: string, dto: CreateStaffDto) {
    await this.assertSalonOwner(salonId, userId);

    const { serviceIds, ...rest } = dto;

    return this.prisma.staff.create({
      data: {
        ...rest,
        salonId,
        staffServices: serviceIds?.length
          ? { create: serviceIds.map((serviceId) => ({ serviceId })) }
          : undefined,
      },
      include: {
        staffServices: { include: { service: true } },
        workSchedules: true,
      },
    });
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  async update(salonId: string, staffId: string, userId: string, dto: UpdateStaffDto) {
    await this.assertSalonOwner(salonId, userId);
    await this.findStaffInSalon(staffId, salonId);

    const { serviceIds, ...rest } = dto;

    // If serviceIds provided, replace all service mappings
    if (serviceIds !== undefined) {
      await this.prisma.staffService.deleteMany({ where: { staffId } });
      if (serviceIds.length) {
        await this.prisma.staffService.createMany({
          data: serviceIds.map((serviceId) => ({ staffId, serviceId })),
        });
      }
    }

    return this.prisma.staff.update({
      where: { id: staffId },
      data: rest,
      include: {
        staffServices: { include: { service: true } },
        workSchedules: true,
      },
    });
  }

  // ─── Remove ──────────────────────────────────────────────────────────────────

  async remove(salonId: string, staffId: string, userId: string) {
    await this.assertSalonOwner(salonId, userId);
    await this.findStaffInSalon(staffId, salonId);

    // Soft delete — keep history intact
    await this.prisma.staff.update({
      where: { id: staffId },
      data: { isActive: false },
    });
  }

  // ─── Weekly schedule ─────────────────────────────────────────────────────────

  async setSchedule(salonId: string, staffId: string, userId: string, dto: SetScheduleDto) {
    await this.assertSalonOwner(salonId, userId);
    await this.findStaffInSalon(staffId, salonId);

    // Upsert each day
    await Promise.all(
      dto.schedule.map((day) =>
        this.prisma.staffSchedule.upsert({
          where: { staffId_dayOfWeek: { staffId, dayOfWeek: day.dayOfWeek } },
          create: { staffId, ...day },
          update: { startTime: day.startTime, endTime: day.endTime, isOff: day.isOff },
        }),
      ),
    );

    return this.prisma.staffSchedule.findMany({
      where: { staffId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  // ─── Time-off blocks ──────────────────────────────────────────────────────────

  async addTimeOff(salonId: string, staffId: string, userId: string, dto: CreateTimeOffDto) {
    await this.assertSalonOwner(salonId, userId);
    await this.findStaffInSalon(staffId, salonId);

    return this.prisma.timeOffBlock.create({
      data: {
        staffId,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        reason: dto.reason,
      },
    });
  }

  async removeTimeOff(salonId: string, staffId: string, blockId: string, userId: string) {
    await this.assertSalonOwner(salonId, userId);
    await this.findStaffInSalon(staffId, salonId);

    const block = await this.prisma.timeOffBlock.findFirst({
      where: { id: blockId, staffId },
    });
    if (!block) throw new NotFoundException('Time-off block not found');

    await this.prisma.timeOffBlock.delete({ where: { id: blockId } });
  }
}
