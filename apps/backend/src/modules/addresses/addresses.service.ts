import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserAddress } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string): Promise<UserAddress[]> {
    return this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async create(userId: string, dto: CreateAddressDto): Promise<UserAddress> {
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.userAddress.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.userAddress.create({
        data: { ...dto, userId, country: dto.country ?? 'RO' },
      });
    });
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateAddressDto,
  ): Promise<UserAddress> {
    await this.assertOwner(id, userId);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.userAddress.updateMany({
          where: { userId, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }
      return tx.userAddress.update({ where: { id }, data: dto });
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.assertOwner(id, userId);
    await this.prisma.userAddress.delete({ where: { id } });
  }

  private async assertOwner(id: string, userId: string): Promise<UserAddress> {
    const address = await this.prisma.userAddress.findUnique({ where: { id } });
    if (!address) throw new NotFoundException('Address not found');
    if (address.userId !== userId)
      throw new ForbiddenException('Access denied');
    return address;
  }
}
