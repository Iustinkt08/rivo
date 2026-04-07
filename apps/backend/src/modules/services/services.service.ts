import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async assertSalonOwner(salonId: string, userId: string) {
    const salon = await this.prisma.salon.findUnique({ where: { id: salonId } });
    if (!salon) throw new NotFoundException('Salon not found');
    if (salon.adminId !== userId) throw new ForbiddenException('Not your salon');
    return salon;
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  async findAll(salonId: string) {
    return this.prisma.service.findMany({
      where: { salonId },
      include: { category: true },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    });
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  async create(salonId: string, userId: string, dto: CreateServiceDto) {
    await this.assertSalonOwner(salonId, userId);

    return this.prisma.service.create({
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
      include: { category: true },
    });
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  async update(salonId: string, serviceId: string, userId: string, dto: UpdateServiceDto) {
    await this.assertSalonOwner(salonId, userId);

    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, salonId },
    });
    if (!service) throw new NotFoundException('Service not found');

    return this.prisma.service.update({
      where: { id: serviceId },
      data: dto,
      include: { category: true },
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
      include: { category: true },
    });
  }
}
