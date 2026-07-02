import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { Prisma, User, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface SupabaseTokenPayload {
  uid: string;
  email?: string;
  phone?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Called on every authenticated request.
   * Finds an existing user by Supabase UID or creates a new one from the token claims.
   */
  async getOrCreateUser(
    decoded: SupabaseTokenPayload,
  ): Promise<User & { isNewUser?: boolean }> {
    const existing = await this.prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
    });
    if (existing) return existing;

    // Account may have been recreated in Supabase with the same email — re-link it
    if (decoded.email) {
      const byEmail = await this.prisma.user.findUnique({
        where: { email: decoded.email },
      });
      if (byEmail) {
        return this.prisma.user.update({
          where: { id: byEmail.id },
          data: { firebaseUid: decoded.uid },
        });
      }
    }

    // First login — create a stub user from Supabase claims.
    // Treat empty-string phone as null to avoid unique constraint conflicts.
    const phone = decoded.phone?.trim() || null;
    try {
      const newUser = await this.prisma.user.create({
        data: {
          firebaseUid: decoded.uid,
          email: decoded.email ?? null,
          phone,
          firstName: 'User',
          lastName: '',
          role: UserRole.CLIENT,
        },
      });

      this.logger.log(`New user created: ${newUser.id} (${decoded.uid})`);
      return { ...newUser, isNewUser: true };
    } catch (err) {
      // A concurrent first request can create this user between our checks above and
      // this insert (mobile fires several authed calls at once after login). Re-fetch
      // the winner's row instead of surfacing the unique violation as a 500.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const raced =
          (await this.prisma.user.findUnique({
            where: { firebaseUid: decoded.uid },
          })) ??
          (decoded.email
            ? await this.prisma.user.findUnique({
                where: { email: decoded.email },
              })
            : null);
        if (raced) return raced;
      }
      throw err;
    }
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
      if (phoneTaken)
        throw new ConflictException('Phone number already in use');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email ?? undefined,
        phone: dto.phone ?? undefined,
        avatarUrl: dto.avatarUrl ?? undefined,
        role: await this.resolveSelfAssignedRole(userId, dto.role),
      },
    });
  }

  /**
   * Self-service role selection is limited to CLIENT / ADMIN_SALON (the DTO
   * enforces this too — defense in depth). Elevated or owner-provisioned roles
   * (SUPER_ADMIN, STAFF_MEMBER) can never be self-assigned NOR overwritten by
   * re-calling complete-profile.
   */
  private async resolveSelfAssignedRole(
    userId: string,
    requested?: UserRole,
  ): Promise<UserRole> {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const currentRole = current?.role ?? UserRole.CLIENT;

    const isSelfAssignable =
      currentRole === UserRole.CLIENT || currentRole === UserRole.ADMIN_SALON;
    if (!isSelfAssignable) return currentRole;

    if (requested === UserRole.ADMIN_SALON) return UserRole.ADMIN_SALON;
    if (requested === UserRole.CLIENT) return UserRole.CLIENT;
    return currentRole; // no (valid) role requested — keep what they have
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

    const { dateOfBirth, ...rest } = dto;
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...rest,
        ...(dateOfBirth !== undefined && {
          dateOfBirth: new Date(dateOfBirth),
        }),
      },
    });
  }

  async getProfile(userId: string): Promise<User> {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  }

  /** Auth-guard lookup for backend-issued staff tokens (null if deactivated). */
  async getActiveUserById(userId: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user?.isActive ? user : null;
  }

  /** True if the user administers at least one salon (drives mobile onboarding gating). */
  async hasSalon(userId: string): Promise<boolean> {
    const count = await this.prisma.salon.count({ where: { adminId: userId } });
    return count > 0;
  }

  async deactivate(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
  }
}
