import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  DayOfWeek,
  Prisma,
  User,
  UserRole,
} from '@prisma/client';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { SetScheduleDto } from './dto/set-schedule.dto';
import { CreateTimeOffDto } from './dto/create-time-off.dto';
import { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
import {
  mergeVisibilitySettings,
  normalizeSocials,
  resolvePublicVisibility,
} from './staff-profile.utils';

// Default working hours for newly created staff — availability requires a
// StaffSchedule row per day, so without these a new staff member would never
// have bookable slots. The owner can adjust per-day afterwards.
const DEFAULT_WORK_START = '09:00';
const DEFAULT_WORK_END = '18:00';
const DEFAULT_DAY_OFF = DayOfWeek.SUNDAY;

// Public professional profile: cap the embedded review list.
const PROFILE_REVIEWS_LIMIT = 20;

// Staff login credentials — generated passwords avoid ambiguous glyphs (0/O, 1/l/I).
const GENERATED_PASSWORD_LENGTH = 12;
const PASSWORD_CHARSET =
  'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;
const BCRYPT_ROUNDS = 12;
// Synthetic, non-routable email domain for backend-issued staff accounts.
const STAFF_EMAIL_DOMAIN = 'staff.navira.local';

function generatePassword(): string {
  return Array.from(
    { length: GENERATED_PASSWORD_LENGTH },
    () => PASSWORD_CHARSET[randomInt(PASSWORD_CHARSET.length)],
  ).join('');
}

// passwordHash must never leave the API, whatever shape the row was fetched in.
function stripSecrets<T extends { passwordHash?: string | null }>(
  staff: T,
): Omit<T, 'passwordHash'> {
  const { passwordHash: _passwordHash, ...safe } = staff;
  return safe;
}

// PUBLIC endpoints additionally hide login identifiers, account linkage and
// contact/profile internals: exposing `username` would hand attackers the
// exact login for password guessing; `phone`/`email` visibility is governed
// by publicSettings on the professional profile endpoint (hidden by default),
// so the raw staff listing must not leak them either.
function toPublicStaff<
  T extends {
    passwordHash?: string | null;
    username?: string | null;
    userId?: string | null;
    phone?: string | null;
    email?: string | null;
    socials?: unknown;
    publicSettings?: unknown;
  },
>(
  staff: T,
): Omit<
  T,
  | 'passwordHash'
  | 'username'
  | 'userId'
  | 'phone'
  | 'email'
  | 'socials'
  | 'publicSettings'
> {
  const {
    passwordHash: _passwordHash,
    username: _username,
    userId: _userId,
    phone: _phone,
    email: _email,
    socials: _socials,
    publicSettings: _publicSettings,
    ...safe
  } = staff;
  return safe;
}

// "Maria Ionescu" → "Maria I." — client privacy on public profiles.
function formatClientName(client?: {
  firstName?: string | null;
  lastName?: string | null;
}): string {
  const first = client?.firstName?.trim();
  const lastInitial = client?.lastName?.trim()?.[0];
  if (!first) return 'Client';
  return lastInitial ? `${first} ${lastInitial}.` : first;
}

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Public: top professionals across all salons ─────────────────────────────

  /**
   * Active staff ranked by number of appointments (desc). Every staff belongs to
   * a salon (salonId is required), so the "must belong to a salon" rule holds by
   * construction. Used by the client home + professionals page.
   */
  async findTopProfessionals(limit = 10) {
    const staff = await this.prisma.staff.findMany({
      where: { isActive: true },
      orderBy: { appointments: { _count: 'desc' } },
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        bio: true,
        salonId: true,
        salon: { select: { id: true, name: true, slug: true } },
        _count: { select: { appointments: true } },
      },
    });

    return staff.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      fullName: `${s.firstName} ${s.lastName}`.trim(),
      avatarUrl: s.avatarUrl,
      bio: s.bio,
      salonId: s.salonId,
      salonName: s.salon?.name ?? null,
      appointmentCount: s._count.appointments,
    }));
  }

  // ─── Public: professional profile (client app) ──────────────────────────────

  /**
   * Full public profile for one professional: identity, salon, active services,
   * rating aggregates and latest reviews. Reviews have no staffId column, so
   * they are resolved through the appointment→staff relation.
   *
   * Visibility-gated fields (filtered SERVER-SIDE — hidden fields are omitted
   * from the response entirely, the client never receives them):
   *  - socials                     → only when publicSettings.showSocials
   *  - phone / email               → only when publicSettings.showContact
   *  - completedAppointmentsCount  → only when publicSettings.showApptCount
   *  - galleryCategories           → only when publicSettings.showGallery
   * Defaults (publicSettings null): gallery + socials shown, contact +
   * appointment count hidden.
   */
  async findProfessionalProfile(staffId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, isActive: true },
      include: {
        salon: { select: { id: true, name: true, slug: true, city: true } },
        staffServices: {
          where: { service: { isActive: true } },
          include: {
            service: {
              select: { id: true, name: true, price: true, durationMin: true },
            },
          },
        },
      },
    });
    if (!staff) throw new NotFoundException('Professional not found');

    const visibility = resolvePublicVisibility(staff.publicSettings);

    const reviewWhere = { isVisible: true, appointment: { staffId } };
    const [agg, reviews, completedAppointmentsCount, galleryCategories] =
      await Promise.all([
        this.prisma.review.aggregate({
          where: reviewWhere,
          _avg: { rating: true },
          _count: true,
        }),
        this.prisma.review.findMany({
          where: reviewWhere,
          orderBy: { createdAt: 'desc' },
          take: PROFILE_REVIEWS_LIMIT,
          include: {
            client: { select: { firstName: true, lastName: true } },
          },
        }),
        visibility.showApptCount
          ? this.prisma.appointment.count({
              where: { staffId, status: AppointmentStatus.COMPLETED },
            })
          : Promise.resolve(null),
        visibility.showGallery
          ? this.prisma.staffPhotoCategory.findMany({
              where: { staffId },
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
              include: {
                photos: {
                  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                },
              },
            })
          : Promise.resolve(null),
      ]);

    const socials = visibility.showSocials
      ? normalizeSocials(staff.socials)
      : {};

    return {
      id: staff.id,
      firstName: staff.firstName,
      lastName: staff.lastName,
      fullName: `${staff.firstName} ${staff.lastName}`.trim(),
      specialty: staff.specialty,
      avatarEmoji: staff.avatarEmoji,
      avatarUrl: staff.avatarUrl,
      bio: staff.bio,
      salon: staff.salon,
      services: staff.staffServices.map((ss) => ({
        id: ss.service.id,
        name: ss.service.name,
        price: Number(ss.service.price),
        durationMin: ss.service.durationMin,
      })),
      averageRating: agg._avg.rating ?? 0,
      reviewCount: agg._count,
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        clientName: formatClientName(r.client),
      })),
      // Visibility-gated fields — omitted entirely when hidden.
      ...(Object.keys(socials).length ? { socials } : {}),
      ...(visibility.showContact
        ? { phone: staff.phone, email: staff.email }
        : {}),
      ...(completedAppointmentsCount !== null
        ? { completedAppointmentsCount }
        : {}),
      ...(galleryCategories
        ? {
            galleryCategories: galleryCategories.map((category) => ({
              id: category.id,
              name: category.name,
              photos: category.photos.map((photo) => ({
                id: photo.id,
                url: photo.url,
                caption: photo.caption,
              })),
            })),
          }
        : {}),
    };
  }

  /**
   * Public professional search by name or specialty. Rating aggregates are
   * computed in one extra query (reviews joined via appointments) instead of
   * one query per staff member.
   */
  async searchProfessionals(search: string | undefined, limit = 20) {
    const term = search?.trim();
    const staff = await this.prisma.staff.findMany({
      where: {
        isActive: true,
        ...(term
          ? {
              OR: [
                { firstName: { contains: term, mode: 'insensitive' as const } },
                { lastName: { contains: term, mode: 'insensitive' as const } },
                { specialty: { contains: term, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: { appointments: { _count: 'desc' } },
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        specialty: true,
        avatarEmoji: true,
        avatarUrl: true,
        salon: { select: { id: true, name: true, slug: true } },
        _count: { select: { appointments: true } },
      },
    });
    if (!staff.length) return [];

    const reviewedAppts = await this.prisma.appointment.findMany({
      where: {
        staffId: { in: staff.map((s) => s.id) },
        review: { is: { isVisible: true } },
      },
      select: { staffId: true, review: { select: { rating: true } } },
    });

    const ratings = new Map<string, { sum: number; count: number }>();
    for (const a of reviewedAppts) {
      if (!a.review) continue;
      const cur = ratings.get(a.staffId) ?? { sum: 0, count: 0 };
      ratings.set(a.staffId, {
        sum: cur.sum + a.review.rating,
        count: cur.count + 1,
      });
    }

    return staff.map((s) => {
      const r = ratings.get(s.id);
      return {
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        fullName: `${s.firstName} ${s.lastName}`.trim(),
        specialty: s.specialty,
        avatarEmoji: s.avatarEmoji,
        avatarUrl: s.avatarUrl,
        salon: s.salon,
        appointmentCount: s._count.appointments,
        averageRating: r ? Number((r.sum / r.count).toFixed(1)) : 0,
        reviewCount: r?.count ?? 0,
      };
    });
  }

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

  private async findStaffInSalon(staffId: string, salonId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, salonId },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    return staff;
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  async findAll(salonId: string) {
    const staff = await this.prisma.staff.findMany({
      where: { salonId, isActive: true },
      include: {
        staffServices: { include: { service: true } },
        workSchedules: true,
      },
      orderBy: { firstName: 'asc' },
    });
    return staff.map(toPublicStaff);
  }

  // Owner-facing listing — includes `username` so the salon admin can manage
  // login accounts (never the password hash). Public callers use findAll.
  async findAllForOwner(salonId: string, userId: string) {
    await this.assertSalonOwner(salonId, userId);
    const staff = await this.prisma.staff.findMany({
      where: { salonId, isActive: true },
      include: {
        staffServices: { include: { service: true } },
        workSchedules: true,
      },
      orderBy: { firstName: 'asc' },
    });
    return staff.map(stripSecrets);
  }

  async findOne(salonId: string, staffId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, salonId },
      include: {
        staffServices: {
          include: { service: { include: { category: true } } },
        },
        workSchedules: { orderBy: { dayOfWeek: 'asc' } },
        timeOffBlocks: {
          where: { endAt: { gte: new Date() } },
          orderBy: { startAt: 'asc' },
        },
      },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    return toPublicStaff(staff);
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  async create(salonId: string, userId: string, dto: CreateStaffDto) {
    await this.assertSalonOwner(salonId, userId);

    const { serviceIds, username, ...rest } = dto;

    // Fail before creating the staff row if the requested username is taken.
    const normalizedUsername = username
      ? await this.assertUsernameAvailable(username)
      : null;

    // No explicit services → link every active salon service, so the new staff
    // member is immediately bookable (the "any specialist" availability path
    // only considers staff with StaffService links).
    const linkedServiceIds = serviceIds?.length
      ? serviceIds
      : (
          await this.prisma.service.findMany({
            where: { salonId, isActive: true },
            select: { id: true },
          })
        ).map((s) => s.id);

    const staff = await this.prisma.staff.create({
      data: {
        ...rest,
        salonId,
        staffServices: linkedServiceIds.length
          ? { create: linkedServiceIds.map((serviceId) => ({ serviceId })) }
          : undefined,
        workSchedules: {
          create: Object.values(DayOfWeek).map((day) => ({
            dayOfWeek: day,
            startTime: DEFAULT_WORK_START,
            endTime: DEFAULT_WORK_END,
            isOff: day === DEFAULT_DAY_OFF,
          })),
        },
      },
      include: {
        staffServices: { include: { service: true } },
        workSchedules: true,
      },
    });

    // Optional login account, created in the same request. The plaintext
    // password is returned exactly once, here.
    if (normalizedUsername) {
      const credentials = await this.attachCredentials(
        staff.id,
        staff.firstName,
        staff.lastName,
        normalizedUsername,
      );
      return { ...stripSecrets(staff), credentials };
    }

    return stripSecrets(staff);
  }

  // ─── Login credentials (owner-managed) ───────────────────────────────────────

  /**
   * Creates a login account for a staff member: linked User row (STAFF_MEMBER)
   * + bcrypt password hash. Owner-only. The plaintext password is returned
   * exactly once and never stored.
   */
  async createCredentials(
    salonId: string,
    staffId: string,
    ownerId: string,
    dto: { username: string; password?: string },
  ) {
    await this.assertSalonOwner(salonId, ownerId);
    const staff = await this.findStaffInSalon(staffId, salonId);
    if (staff.username) {
      throw new ConflictException(
        'Staff member already has credentials — reset the password instead',
      );
    }

    const username = await this.assertUsernameAvailable(dto.username);
    return this.attachCredentials(
      staff.id,
      staff.firstName,
      staff.lastName,
      username,
      dto.password,
    );
  }

  /** Owner resets a staff member's password; returns the new one exactly once. */
  async resetCredentials(
    salonId: string,
    staffId: string,
    ownerId: string,
    dto: { password?: string },
  ) {
    await this.assertSalonOwner(salonId, ownerId);
    const staff = await this.findStaffInSalon(staffId, salonId);
    if (!staff.username) {
      throw new BadRequestException(
        'Staff member has no credentials yet — create them first',
      );
    }

    const password = dto.password ?? generatePassword();
    await this.prisma.staff.update({
      where: { id: staff.id },
      data: { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) },
    });
    return { username: staff.username, password };
  }

  private async assertUsernameAvailable(raw: string): Promise<string> {
    const username = raw.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(username)) {
      throw new BadRequestException(
        'Username must be 3-30 characters: a-z, 0-9, dot, dash, underscore',
      );
    }
    const taken = await this.prisma.staff.findUnique({ where: { username } });
    if (taken) throw new ConflictException('Username is already taken');
    return username;
  }

  /**
   * Links a User row (role STAFF_MEMBER, synthetic email) and stores the
   * password hash. A username race after assertUsernameAvailable surfaces as
   * 409 via the unique constraint.
   */
  private async attachCredentials(
    staffId: string,
    firstName: string,
    lastName: string,
    username: string,
    password?: string,
  ) {
    const plainPassword = password ?? generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);

    try {
      await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: `${username}@${STAFF_EMAIL_DOMAIN}`,
            firstName,
            lastName,
            role: UserRole.STAFF_MEMBER,
          },
        });
        await tx.staff.update({
          where: { id: staffId },
          data: { username, passwordHash, userId: user.id },
        });
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Username is already taken');
      }
      throw err;
    }

    return { username, password: plainPassword };
  }

  // ─── Self-service public profile (staff-self or salon owner) ─────────────────

  /**
   * Profile reads/edits are allowed to exactly two callers (mirrors the
   * staff-gallery authorization):
   *  - the staff member themselves — staff tokens carry sub = Staff.userId,
   *    so `staff.userId === user.id` is the DB-backed identity check;
   *  - the ADMIN_SALON who owns :salonId (salon.adminId === user.id).
   * In both cases the staff member must belong to :salonId.
   */
  private async assertCanEditProfile(
    salonId: string,
    staffId: string,
    user: User,
  ) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, salonId },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    if (user.role === UserRole.ADMIN_SALON) {
      const salon = await this.prisma.salon.findUnique({
        where: { id: salonId },
      });
      if (!salon) throw new NotFoundException('Salon not found');
      if (salon.adminId !== user.id) {
        throw new ForbiddenException('Not your salon');
      }
      return staff;
    }

    if (staff.userId && staff.userId === user.id) return staff;

    throw new ForbiddenException(
      'Only the staff member or the salon owner can edit this profile',
    );
  }

  /** Editable profile (contact, socials, visibility) for the editor screen. */
  async getOwnProfile(salonId: string, staffId: string, user: User) {
    const staff = await this.assertCanEditProfile(salonId, staffId, user);
    return stripSecrets(staff);
  }

  /**
   * Self-service profile update. The update payload is built from an explicit
   * field whitelist so credentials and account state (username/passwordHash/
   * isActive/salonId) can never be touched here, whatever the request body
   * carries. Empty strings clear optional text fields; socials handles are
   * normalized to full https:// URLs; publicSettings merges over the stored
   * value.
   */
  async updateOwnProfile(
    salonId: string,
    staffId: string,
    user: User,
    dto: UpdateStaffProfileDto,
  ) {
    const staff = await this.assertCanEditProfile(salonId, staffId, user);

    const data: Prisma.StaffUpdateInput = {
      ...(dto.firstName !== undefined
        ? { firstName: dto.firstName.trim() }
        : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() } : {}),
      ...(dto.specialty !== undefined
        ? { specialty: dto.specialty.trim() || null }
        : {}),
      ...(dto.bio !== undefined ? { bio: dto.bio.trim() || null } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone.trim() || null } : {}),
      ...(dto.email !== undefined ? { email: dto.email.trim() || null } : {}),
      ...(dto.avatarEmoji !== undefined
        ? { avatarEmoji: dto.avatarEmoji }
        : {}),
      ...(dto.socials !== undefined
        ? { socials: normalizeSocials(dto.socials) }
        : {}),
      ...(dto.publicSettings !== undefined
        ? {
            publicSettings: mergeVisibilitySettings(
              staff.publicSettings,
              dto.publicSettings,
            ),
          }
        : {}),
    };

    const updated = await this.prisma.staff.update({
      where: { id: staff.id },
      data,
    });
    return stripSecrets(updated);
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  async update(
    salonId: string,
    staffId: string,
    userId: string,
    dto: UpdateStaffDto,
  ) {
    await this.assertSalonOwner(salonId, userId);
    await this.findStaffInSalon(staffId, salonId);

    // `username` only moves through the dedicated credentials endpoints.
    const { serviceIds, username: _username, ...rest } = dto;

    // If serviceIds provided, replace all service mappings
    if (serviceIds !== undefined) {
      await this.prisma.staffService.deleteMany({ where: { staffId } });
      if (serviceIds.length) {
        await this.prisma.staffService.createMany({
          data: serviceIds.map((serviceId) => ({ staffId, serviceId })),
        });
      }
    }

    const updated = await this.prisma.staff.update({
      where: { id: staffId },
      data: rest,
      include: {
        staffServices: { include: { service: true } },
        workSchedules: true,
      },
    });
    return stripSecrets(updated);
  }

  // ─── Remove ──────────────────────────────────────────────────────────────────

  async remove(salonId: string, staffId: string, userId: string) {
    await this.assertSalonOwner(salonId, userId);
    const staff = await this.findStaffInSalon(staffId, salonId);

    // Soft delete — keep history intact
    await this.prisma.staff.update({
      where: { id: staffId },
      data: { isActive: false },
    });

    // Terminated staff must not keep a working login for the remaining
    // lifetime of their 7-day token — the auth guard checks User.isActive.
    if (staff.userId) {
      await this.prisma.user.update({
        where: { id: staff.userId },
        data: { isActive: false },
      });
    }
  }

  // ─── Weekly schedule ─────────────────────────────────────────────────────────

  async setSchedule(
    salonId: string,
    staffId: string,
    userId: string,
    dto: SetScheduleDto,
  ) {
    await this.assertSalonOwner(salonId, userId);
    await this.findStaffInSalon(staffId, salonId);

    // Upsert each day
    await Promise.all(
      dto.schedule.map((day) =>
        this.prisma.staffSchedule.upsert({
          where: { staffId_dayOfWeek: { staffId, dayOfWeek: day.dayOfWeek } },
          create: { staffId, ...day },
          update: {
            startTime: day.startTime,
            endTime: day.endTime,
            isOff: day.isOff,
          },
        }),
      ),
    );

    return this.prisma.staffSchedule.findMany({
      where: { staffId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  // ─── Time-off blocks ──────────────────────────────────────────────────────────

  async addTimeOff(
    salonId: string,
    staffId: string,
    userId: string,
    dto: CreateTimeOffDto,
  ) {
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

  async removeTimeOff(
    salonId: string,
    staffId: string,
    blockId: string,
    userId: string,
  ) {
    await this.assertSalonOwner(salonId, userId);
    await this.findStaffInSalon(staffId, salonId);

    const block = await this.prisma.timeOffBlock.findFirst({
      where: { id: blockId, staffId },
    });
    if (!block) throw new NotFoundException('Time-off block not found');

    await this.prisma.timeOffBlock.delete({ where: { id: blockId } });
  }
}
