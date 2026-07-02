import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';

// Backend-issued staff tokens: salon-scoped accounts that never touch Supabase.
export const STAFF_TOKEN_ISSUER = 'navira-staff';
const STAFF_TOKEN_TTL = '7d';
const BCRYPT_ROUNDS = 12;

export interface StaffTokenPayload extends JWTPayload {
  sub: string; // Staff.userId — same identity space as Supabase users
  role: 'STAFF_MEMBER';
  staffId: string;
  salonId: string;
}

@Injectable()
export class StaffAuthService implements OnModuleInit {
  private secret: Uint8Array;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const secret = this.config.get<string>('STAFF_JWT_SECRET');
    if (!secret) {
      // Fail fast: issuing/verifying staff tokens with a missing secret would
      // either crash mid-request or silently accept nothing.
      throw new Error(
        'STAFF_JWT_SECRET is not set — cannot initialise staff authentication',
      );
    }
    this.secret = new TextEncoder().encode(secret);
  }

  /**
   * Username + password login for salon staff accounts. Every failure path
   * returns the same generic message (no user enumeration).
   */
  async login(username: string, password: string) {
    const normalized = username.trim().toLowerCase();
    const staff = await this.prisma.staff.findUnique({
      where: { username: normalized },
      include: { salon: { select: { id: true, name: true } } },
    });

    const isLoginable =
      !!staff && staff.isActive && !!staff.passwordHash && !!staff.userId;
    const passwordOk =
      isLoginable && (await bcrypt.compare(password, staff.passwordHash!));
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await new SignJWT({
      role: 'STAFF_MEMBER',
      staffId: staff.id,
      salonId: staff.salonId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(staff.userId!)
      .setIssuer(STAFF_TOKEN_ISSUER)
      .setIssuedAt()
      .setExpirationTime(STAFF_TOKEN_TTL)
      .sign(this.secret);

    return {
      accessToken,
      staff: {
        id: staff.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        specialty: staff.specialty,
        avatarEmoji: staff.avatarEmoji,
        avatarUrl: staff.avatarUrl,
        salonId: staff.salonId,
      },
      salon: staff.salon,
    };
  }

  /** Verifies a backend-issued staff token; throws 401 on any failure. */
  async verifyToken(token: string): Promise<StaffTokenPayload> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: STAFF_TOKEN_ISSUER,
      });
      return payload as StaffTokenPayload;
    } catch {
      throw new UnauthorizedException('Staff token is invalid or expired');
    }
  }

  /** Staff changes their own password (requires the current one). */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const staff = await this.prisma.staff.findFirst({
      where: { userId, isActive: true },
    });
    const currentOk =
      !!staff?.passwordHash &&
      (await bcrypt.compare(currentPassword, staff.passwordHash));
    if (!currentOk) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.staff.update({
      where: { id: staff!.id },
      data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) },
    });
  }
}
