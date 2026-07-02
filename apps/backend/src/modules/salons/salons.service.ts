import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Salon, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSalonDto } from './dto/create-salon.dto';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { SalonQueryDto, SalonSortBy } from './dto/salon-query.dto';
import { SetOpeningHoursDto } from './dto/opening-hours.dto';
import {
  PaginatedSalonsDto,
  SalonCardDto,
  SalonProfileDto,
} from './dto/salon-response.dto';

// ── Haversine raw-query row shape ─────────────────────────────────────────────
// Prisma does NOT apply @map by default, so column names are camelCase in DB.
interface SalonGeoRow {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  city: string;
  addressLine1: string;
  averageRating: number;
  reviewCount: number;
  distance_km: number; // computed alias stays snake_case
}

@Injectable()
export class SalonsService {
  private readonly logger = new Logger(SalonsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Create ────────────────────────────────────────────────────────────────

  async create(adminId: string, dto: CreateSalonDto): Promise<Salon> {
    // Only one salon per admin (can be relaxed later)
    const existing = await this.prisma.salon.findFirst({ where: { adminId } });
    if (existing) {
      throw new ConflictException(
        'You already own a salon. Contact support to manage multiple salons.',
      );
    }

    const slug = await this.generateSlug(dto.name);

    return this.prisma.salon.create({
      data: {
        ...dto,
        slug,
        country: dto.country ?? 'RO',
        cancellationHours: dto.cancellationHours ?? 24,
        latitude: dto.latitude ?? 44.4268,
        longitude: dto.longitude ?? 26.1025,
        adminId,
      },
    });
  }

  // ── Search / List ─────────────────────────────────────────────────────────

  async findAllCategories() {
    return this.prisma.category.findMany({
      select: { id: true, name: true, iconUrl: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  private async resolveCategoryId(
    categoryId?: string,
    categoryName?: string,
  ): Promise<string | undefined> {
    if (categoryId) return categoryId;
    if (!categoryName) return undefined;
    const cat = await this.prisma.category.findFirst({
      where: {
        name: { equals: categoryName, mode: Prisma.QueryMode.insensitive },
      },
      select: { id: true },
    });
    return cat?.id;
  }

  async findAll(query: SalonQueryDto): Promise<PaginatedSalonsDto> {
    const {
      lat,
      lng,
      radiusKm = 10,
      search,
      categoryId: rawCategoryId,
      category: categoryName,
      minRating,
      city,
      sortBy = SalonSortBy.DISTANCE,
      page = 1,
      limit = 20,
    } = query;

    const categoryId = await this.resolveCategoryId(
      rawCategoryId,
      categoryName,
    );

    // When a category name was given but no matching category exists → empty results
    if (categoryName && !rawCategoryId && categoryId === undefined) {
      return { data: [], total: 0, page, limit, hasNextPage: false };
    }

    const useGeo = lat !== undefined && lng !== undefined;

    // ── Geo search via Haversine (raw SQL) ──────────────────────────────────
    if (useGeo) {
      return this.findAllGeo({
        lat: lat!,
        lng: lng!,
        radiusKm,
        search,
        categoryId,
        minRating,
        page,
        limit,
      });
    }

    // ── Standard Prisma query (no geo) ─────────────────────────────────────
    const where: Prisma.SalonWhereInput = {
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
          {
            services: {
              some: {
                name: { contains: search, mode: Prisma.QueryMode.insensitive },
                isActive: true,
              },
            },
          },
        ],
      }),
      ...(city && {
        city: { equals: city, mode: Prisma.QueryMode.insensitive },
      }),
      ...(minRating && { averageRating: { gte: minRating } }),
      ...(categoryId && {
        categories: { some: { categoryId } },
      }),
    };

    const orderBy: Prisma.SalonOrderByWithRelationInput =
      sortBy === SalonSortBy.RATING
        ? { averageRating: 'desc' }
        : sortBy === SalonSortBy.NAME
          ? { name: 'asc' }
          : { averageRating: 'desc' }; // fallback when no geo

    const [salons, total] = await Promise.all([
      this.prisma.salon.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.salon.count({ where }),
    ]);

    return {
      data: salons.map((s) => this.toCard(s)),
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
    };
  }

  /**
   * Haversine geo search via $queryRaw.
   * Formula: d = 2R * asin(sqrt(sin²(Δlat/2) + cos(lat1)*cos(lat2)*sin²(Δlng/2)))
   * Using the simpler acos form with GREATEST/LEAST to avoid NaN from floating-point errors.
   */
  private async findAllGeo(params: {
    lat: number;
    lng: number;
    radiusKm: number;
    search?: string;
    categoryId?: string;
    minRating?: number;
    page: number;
    limit: number;
  }): Promise<PaginatedSalonsDto> {
    const { lat, lng, radiusKm, search, categoryId, minRating, page, limit } =
      params;
    const offset = (page - 1) * limit;

    // Build optional filter clauses
    const searchFilter = search
      ? Prisma.sql`AND (
          s.name ILIKE ${'%' + search + '%'}
          OR EXISTS (
            SELECT 1 FROM services sv
            WHERE sv."salonId" = s.id
              AND sv."isActive" = true
              AND sv.name ILIKE ${'%' + search + '%'}
          )
        )`
      : Prisma.empty;
    const ratingFilter =
      minRating != null
        ? Prisma.sql`AND s."averageRating" >= ${minRating}`
        : Prisma.empty;
    const categoryFilter = categoryId
      ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM salon_categories sc
          WHERE sc."salonId" = s.id AND sc."categoryId" = ${categoryId}
        )`
      : Prisma.empty;

    // Wrap in subquery so WHERE can filter on the computed distance_km alias.
    // Columns are camelCase because Prisma doesn't apply @map by default.
    const rows = await this.prisma.$queryRaw<SalonGeoRow[]>`
      SELECT * FROM (
        SELECT
          s.id,
          s.name,
          s.slug,
          s."logoUrl",
          s."coverImageUrl",
          s.city,
          s."addressLine1",
          s."averageRating",
          s."reviewCount",
          (
            6371 * acos(
              GREATEST(-1.0, LEAST(1.0,
                cos(radians(${lat})) * cos(radians(s.latitude))
                * cos(radians(s.longitude) - radians(${lng}))
                + sin(radians(${lat})) * sin(radians(s.latitude))
              ))
            )
          ) AS distance_km
        FROM salons s
        WHERE s."isActive" = true
          ${searchFilter}
          ${ratingFilter}
          ${categoryFilter}
      ) AS geo
      WHERE geo.distance_km <= ${radiusKm}
      ORDER BY geo.distance_km ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    // COUNT query (same subquery, no pagination)
    const countRows = await this.prisma.$queryRaw<[{ total: bigint }]>`
      SELECT COUNT(*) AS total FROM (
        SELECT
          (
            6371 * acos(
              GREATEST(-1.0, LEAST(1.0,
                cos(radians(${lat})) * cos(radians(s.latitude))
                * cos(radians(s.longitude) - radians(${lng}))
                + sin(radians(${lat})) * sin(radians(s.latitude))
              ))
            )
          ) AS distance_km
        FROM salons s
        WHERE s."isActive" = true
          ${searchFilter}
          ${ratingFilter}
          ${categoryFilter}
      ) AS geo
      WHERE geo.distance_km <= ${radiusKm}
    `;

    const total = Number(countRows[0]?.total ?? 0);

    return {
      data: rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        logoUrl: r.logoUrl,
        coverImageUrl: r.coverImageUrl,
        city: r.city,
        addressLine1: r.addressLine1,
        averageRating: Number(r.averageRating),
        reviewCount: Number(r.reviewCount),
        distanceKm: Math.round(Number(r.distance_km) * 10) / 10,
      })),
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
    };
  }

  // ── Public profile ────────────────────────────────────────────────────────

  async findBySlug(slug: string): Promise<SalonProfileDto> {
    // Accept both the slug and the salon id — mobile lists navigate by id.
    const salon = await this.prisma.salon.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
      include: {
        openingHours: { orderBy: { dayOfWeek: 'asc' } },
        gallery: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { services: true, staff: true } },
      },
    });

    if (!salon || !salon.isActive) {
      throw new NotFoundException('Salon not found');
    }

    return this.toProfile(salon);
  }

  async findById(id: string): Promise<Salon> {
    const salon = await this.prisma.salon.findUnique({ where: { id } });
    if (!salon) throw new NotFoundException('Salon not found');
    return salon;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(
    salonId: string,
    userId: string,
    dto: UpdateSalonDto,
    userRole: UserRole,
  ): Promise<Salon> {
    await this.assertOwner(salonId, userId, userRole);
    return this.prisma.salon.update({ where: { id: salonId }, data: dto });
  }

  async deactivate(
    salonId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<void> {
    await this.assertOwner(salonId, userId, userRole);
    await this.prisma.salon.update({
      where: { id: salonId },
      data: { isActive: false },
    });
  }

  // ── Opening Hours ─────────────────────────────────────────────────────────

  async setOpeningHours(
    salonId: string,
    userId: string,
    dto: SetOpeningHoursDto,
    userRole: UserRole,
  ) {
    await this.assertOwner(salonId, userId, userRole);

    // Upsert each day atomically
    const ops = dto.hours.map((h) =>
      this.prisma.openingHours.upsert({
        where: { salonId_dayOfWeek: { salonId, dayOfWeek: h.dayOfWeek } },
        update: {
          openTime: h.openTime,
          closeTime: h.closeTime,
          isClosed: h.isClosed ?? false,
        },
        create: {
          salonId,
          dayOfWeek: h.dayOfWeek,
          openTime: h.openTime,
          closeTime: h.closeTime,
          isClosed: h.isClosed ?? false,
        },
      }),
    );

    return this.prisma.$transaction(ops);
  }

  async getOpeningHours(salonId: string) {
    return this.prisma.openingHours.findMany({
      where: { salonId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  // ── Photos ────────────────────────────────────────────────────────────────

  async addPhoto(
    salonId: string,
    userId: string,
    url: string,
    caption?: string,
    userRole?: UserRole,
  ) {
    await this.assertOwner(salonId, userId, userRole);

    const maxOrder = await this.prisma.salonPhoto.aggregate({
      where: { salonId },
      _max: { sortOrder: true },
    });

    return this.prisma.salonPhoto.create({
      data: {
        salonId,
        url,
        caption,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });
  }

  async removePhoto(
    photoId: string,
    salonId: string,
    userId: string,
    userRole?: UserRole,
  ) {
    await this.assertOwner(salonId, userId, userRole);
    await this.prisma.salonPhoto.delete({ where: { id: photoId } });
  }

  // ── Owner's own salon ─────────────────────────────────────────────────────

  async findMysalon(adminId: string) {
    const salon = await this.prisma.salon.findFirst({
      where: { adminId },
      include: {
        openingHours: { orderBy: { dayOfWeek: 'asc' } },
        gallery: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { services: true, staff: true } },
      },
    });
    if (!salon)
      throw new NotFoundException('You have no salon yet. Create one first.');
    return this.toProfile(salon);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async assertOwner(
    salonId: string,
    userId: string,
    userRole?: UserRole,
  ): Promise<Salon> {
    const salon = await this.prisma.salon.findUnique({
      where: { id: salonId },
    });
    if (!salon) throw new NotFoundException('Salon not found');
    if (userRole === UserRole.SUPER_ADMIN) return salon;
    if (salon.adminId !== userId)
      throw new ForbiddenException('You are not the owner of this salon');
    return salon;
  }

  private async generateSlug(name: string): Promise<string> {
    const base = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove diacritics
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');

    let slug = base;
    let attempt = 0;

    while (await this.prisma.salon.findUnique({ where: { slug } })) {
      attempt++;
      slug = `${base}-${attempt}`;
    }

    return slug;
  }

  private toCard(s: Salon & { distanceKm?: number }): SalonCardDto {
    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      logoUrl: s.logoUrl,
      coverImageUrl: s.coverImageUrl,
      city: s.city,
      addressLine1: s.addressLine1,
      averageRating: Number(s.averageRating),
      reviewCount: s.reviewCount,
      ...(s.distanceKm !== undefined && { distanceKm: s.distanceKm }),
    };
  }

  private toProfile(
    s: Salon & {
      openingHours: {
        dayOfWeek: any;
        openTime: string;
        closeTime: string;
        isClosed: boolean;
      }[];
      gallery: {
        id: string;
        url: string;
        caption: string | null;
        sortOrder: number;
      }[];
      _count: { services: number; staff: number };
    },
  ): SalonProfileDto {
    return {
      ...this.toCard(s),
      description: s.description,
      phone: s.phone,
      email: s.email,
      websiteUrl: s.websiteUrl,
      latitude: s.latitude,
      longitude: s.longitude,
      county: s.county,
      country: s.country,
      postalCode: s.postalCode,
      requiresDeposit: s.requiresDeposit,
      depositPercentage: s.depositPercentage,
      cancellationHours: s.cancellationHours,
      openingHours: s.openingHours,
      gallery: s.gallery,
      serviceCount: s._count.services,
      staffCount: s._count.staff,
    };
  }
}
