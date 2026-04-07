import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { DecodedIdToken } from 'firebase-admin/auth';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Called on every authenticated request.
   * Finds an existing user by Firebase UID or creates a new one from the token claims.
   */
  async getOrCreateUser(decoded: DecodedIdToken): Promise<User & { isNewUser?: boolean }> {
    const existing = await this.prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
    });

    if (existing) return existing;

    // First login — create a stub user from Firebase claims
    const newUser = await this.prisma.user.create({
      data: {
        firebaseUid: decoded.uid,
        email: decoded.email ?? null,
        phone: decoded.phone_number ?? null,
        firstName: decoded.name?.split(' ')[0] ?? 'User',
        lastName: decoded.name?.split(' ').slice(1).join(' ') ?? '',
        avatarUrl: decoded.picture ?? null,
        role: UserRole.CLIENT,
      },
    });

    this.logger.log(`New user created: ${newUser.id} (${decoded.uid})`);
    return { ...newUser, isNewUser: true };
  }

  /**
   * Complete profile after first Firebase login (name, phone, role selection).
   * Called explicitly by the client on first app launch.
   */
  async completeProfile(userId: string, dto: RegisterDto): Promise<User> {
    // Check uniqueness for email / phone if provided
    if (dto.email) {
      const emailTaken = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id: userId } },
      });
      if (emailTaken) throw new ConflictException('Email already in use');
    }

    if (dto.phone) {
      const phoneTaken = await this.prisma.user.findFirst({
        where: { phone: dto.phone, NOT: { id: userId } },
      });
      if (phoneTaken) throw new ConflictException('Phone number already in use');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email ?? undefined,
        phone: dto.phone ?? undefined,
        role: dto.role ?? UserRole.CLIENT,
      },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    if (dto.email) {
      const taken = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id: userId } },
      });
      if (taken) throw new ConflictException('Email already in use');
    }

    if (dto.phone) {
      const taken = await this.prisma.user.findFirst({
        where: { phone: dto.phone, NOT: { id: userId } },
      });
      if (taken) throw new ConflictException('Phone number already in use');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });
  }

  async getProfile(userId: string): Promise<User> {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  }

  async deactivate(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
  }
}
