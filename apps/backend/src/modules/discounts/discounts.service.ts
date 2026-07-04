import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DiscountType, Prisma } from '@prisma/client';
import { randomInt } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDiscountCodeDto } from './dto/create-discount-code.dto';
import { UpdateDiscountCodeDto } from './dto/update-discount-code.dto';
import { ValidateDiscountCodeDto } from './dto/validate-discount-code.dto';

// Readable generated codes — XXXX-XXXX from an alphabet without the look-alike
// characters I/O/0/1, e.g. "K7PF-2MQX".
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_SEGMENT_LENGTH = 4;
const GENERATION_MAX_ATTEMPTS = 5;
const CODE_PATTERN = /^[A-Z0-9-]{3,24}$/;
const PERCENT_MAX = 100;

// Validation/redemption run both on the root client (POST validate) and inside
// the appointment-create transaction (tx) — accept the common delegate subset.
export type DiscountDbClient = Pick<
  Prisma.TransactionClient,
  'discountCode' | 'discountRedemption' | 'service'
>;

/** A code row validated against a service, with server-computed amounts. */
export interface ValidatedDiscount {
  codeId: string;
  code: string;
  type: DiscountType;
  value: number;
  maxRedemptions: number | null;
  /** Amount taken off the service price (2-decimal, FIXED capped at price). */
  discountAmount: number;
  finalPrice: number;
}

/** Round to 2 decimals — all amounts are RON money values. */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Server-side discount math — PERCENT of price, FIXED capped at price. */
export function computeDiscountAmounts(
  type: DiscountType,
  value: number,
  price: number,
): { discountAmount: number; finalPrice: number } {
  const raw =
    type === DiscountType.PERCENT ? (price * value) / PERCENT_MAX : value;
  const discountAmount = roundMoney(Math.min(Math.max(raw, 0), price));
  return { discountAmount, finalPrice: roundMoney(price - discountAmount) };
}

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

function randomCodeSegment(): string {
  return Array.from(
    { length: CODE_SEGMENT_LENGTH },
    () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
  ).join('');
}

@Injectable()
export class DiscountsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  // Mirrors assertSalonOwner in sibling services (services.service.ts).
  private async assertSalonOwner(salonId: string, userId: string) {
    const salon = await this.prisma.salon.findUnique({
      where: { id: salonId },
    });
    if (!salon) throw new NotFoundException('Salon not found');
    if (salon.adminId !== userId)
      throw new ForbiddenException('Not your salon');
    return salon;
  }

  /** PERCENT must be 1-100; FIXED just > 0 (DTO enforces positivity). */
  private assertValueForType(type: DiscountType, value: number) {
    if (type === DiscountType.PERCENT && value > PERCENT_MAX) {
      throw new BadRequestException(
        'Reducerea procentuală trebuie să fie între 1 și 100.',
      );
    }
  }

  private assertValidityWindow(
    validFrom: Date | null,
    validUntil: Date | null,
  ) {
    if (validFrom && validUntil && validUntil.getTime() <= validFrom.getTime()) {
      throw new BadRequestException(
        'Data de sfârșit trebuie să fie după data de început.',
      );
    }
  }

  private async generateUniqueCode(salonId: string): Promise<string> {
    for (let attempt = 0; attempt < GENERATION_MAX_ATTEMPTS; attempt++) {
      const candidate = `${randomCodeSegment()}-${randomCodeSegment()}`;
      const existing = await this.prisma.discountCode.findUnique({
        where: { salonId_code: { salonId, code: candidate } },
        select: { id: true },
      });
      if (!existing) return candidate;
    }
    throw new ConflictException(
      'Nu am putut genera un cod unic. Încearcă din nou.',
    );
  }

  /** UI shape: Decimal → number, `_count.redemptions` → `redemptionCount`. */
  private toResponse<
    T extends { value: Prisma.Decimal | number; _count?: { redemptions: number } },
  >(row: T) {
    const { _count, ...rest } = row;
    return {
      ...rest,
      value: Number(row.value),
      redemptionCount: _count?.redemptions ?? 0,
    };
  }

  // ─── Owner CRUD ─────────────────────────────────────────────────────────────

  async create(salonId: string, userId: string, dto: CreateDiscountCodeDto) {
    await this.assertSalonOwner(salonId, userId);
    this.assertValueForType(dto.type, dto.value);

    const validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    const validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    this.assertValidityWindow(validFrom, validUntil);

    // DTO already normalizes custom codes; generated ones match by design.
    const code = dto.code
      ? normalizeCode(dto.code)
      : await this.generateUniqueCode(salonId);
    if (!CODE_PATTERN.test(code)) {
      throw new BadRequestException(
        'Codul poate conține doar litere, cifre și cratime (3-24 de caractere).',
      );
    }

    try {
      const created = await this.prisma.discountCode.create({
        data: {
          salonId,
          code,
          type: dto.type,
          value: dto.value,
          validFrom,
          validUntil,
          maxRedemptions: dto.maxRedemptions ?? null,
          maxPerClient: dto.maxPerClient ?? 1,
        },
      });
      return this.toResponse(created);
    } catch (err) {
      // Unique (salonId, code) race or duplicate custom code → 409.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'Există deja un cod cu acest nume în salonul tău.',
        );
      }
      throw err;
    }
  }

  async findAll(salonId: string, userId: string) {
    await this.assertSalonOwner(salonId, userId);
    const codes = await this.prisma.discountCode.findMany({
      where: { salonId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { redemptions: true } } },
    });
    return codes.map((c) => this.toResponse(c));
  }

  async update(
    salonId: string,
    id: string,
    userId: string,
    dto: UpdateDiscountCodeDto,
  ) {
    await this.assertSalonOwner(salonId, userId);
    const existing = await this.prisma.discountCode.findFirst({
      where: { id, salonId },
    });
    if (!existing) throw new NotFoundException('Discount code not found');

    const validUntil =
      dto.validUntil !== undefined ? new Date(dto.validUntil) : undefined;
    if (validUntil !== undefined) {
      this.assertValidityWindow(existing.validFrom, validUntil);
    }

    const updated = await this.prisma.discountCode.update({
      where: { id },
      data: {
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(validUntil !== undefined ? { validUntil } : {}),
        ...(dto.maxRedemptions !== undefined
          ? { maxRedemptions: dto.maxRedemptions }
          : {}),
        ...(dto.maxPerClient !== undefined
          ? { maxPerClient: dto.maxPerClient }
          : {}),
      },
      include: { _count: { select: { redemptions: true } } },
    });
    return this.toResponse(updated);
  }

  /**
   * Hard-delete when the code was never redeemed; otherwise soft-retire
   * (isActive=false) so the redemption audit trail stays intact.
   * Returns which of the two happened.
   */
  async remove(salonId: string, id: string, userId: string) {
    await this.assertSalonOwner(salonId, userId);
    const existing = await this.prisma.discountCode.findFirst({
      where: { id, salonId },
      include: { _count: { select: { redemptions: true } } },
    });
    if (!existing) throw new NotFoundException('Discount code not found');

    if (existing._count.redemptions === 0) {
      await this.prisma.discountCode.delete({ where: { id } });
      return { id, result: 'deleted' as const };
    }

    await this.prisma.discountCode.update({
      where: { id },
      data: { isActive: false },
    });
    return { id, result: 'retired' as const };
  }

  // ─── Client validation / redemption ─────────────────────────────────────────

  /**
   * Full redeemability check — code exists in salon (case-insensitive via
   * normalization), active, inside its validity window, under both usage caps,
   * and the service belongs to the salon. Amounts are ALWAYS computed
   * server-side from the service price; client amounts are never trusted.
   *
   * Runs against the root client (POST validate) or a transaction client
   * (appointment create) so booking-time re-validation uses the same rules.
   * Messages are Romanian — the app shows them verbatim.
   */
  async assertRedeemable(
    db: DiscountDbClient,
    opts: {
      salonId: string;
      code: string;
      serviceId: string;
      clientId: string;
    },
  ): Promise<ValidatedDiscount> {
    const service = await db.service.findFirst({
      where: { id: opts.serviceId, salonId: opts.salonId, isActive: true },
    });
    if (!service) {
      throw new NotFoundException(
        'Serviciul nu a fost găsit pentru acest salon.',
      );
    }

    const normalized = normalizeCode(opts.code);
    const codeRow = await db.discountCode.findUnique({
      where: { salonId_code: { salonId: opts.salonId, code: normalized } },
    });
    if (!codeRow) {
      throw new NotFoundException('Codul de reducere nu există.');
    }
    if (!codeRow.isActive) {
      throw new BadRequestException('Codul de reducere nu mai este activ.');
    }

    const now = Date.now();
    if (codeRow.validFrom && now < codeRow.validFrom.getTime()) {
      throw new BadRequestException(
        'Codul de reducere nu este încă valabil.',
      );
    }
    if (codeRow.validUntil && now > codeRow.validUntil.getTime()) {
      throw new BadRequestException('Codul de reducere a expirat.');
    }

    if (codeRow.maxRedemptions != null) {
      const total = await db.discountRedemption.count({
        where: { codeId: codeRow.id },
      });
      if (total >= codeRow.maxRedemptions) {
        throw new BadRequestException(
          'Codul de reducere a atins numărul maxim de utilizări.',
        );
      }
    }

    const clientUses = await db.discountRedemption.count({
      where: { codeId: codeRow.id, clientId: opts.clientId },
    });
    if (clientUses >= codeRow.maxPerClient) {
      throw new BadRequestException(
        'Ai folosit deja acest cod de numărul maxim de ori.',
      );
    }

    const price = Number(service.price);
    const { discountAmount, finalPrice } = computeDiscountAmounts(
      codeRow.type,
      Number(codeRow.value),
      price,
    );

    return {
      codeId: codeRow.id,
      code: codeRow.code,
      type: codeRow.type,
      value: Number(codeRow.value),
      maxRedemptions: codeRow.maxRedemptions,
      discountAmount,
      finalPrice,
    };
  }

  /** POST validate — checkout preview, any authenticated user. */
  async validate(
    salonId: string,
    clientId: string,
    dto: ValidateDiscountCodeDto,
  ) {
    const validated = await this.assertRedeemable(this.prisma, {
      salonId,
      code: dto.code,
      serviceId: dto.serviceId,
      clientId,
    });
    return {
      valid: true as const,
      code: validated.code,
      type: validated.type,
      value: validated.value,
      discountAmount: validated.discountAmount,
      finalPrice: validated.finalPrice,
    };
  }

  /**
   * Writes the redemption row inside the booking transaction, then re-checks
   * the total cap — two parallel bookings can each pass assertRedeemable, but
   * whichever pushes the count over maxRedemptions rolls back here.
   */
  async recordRedemption(
    tx: DiscountDbClient,
    opts: {
      validated: ValidatedDiscount;
      appointmentId: string;
      clientId: string;
    },
  ): Promise<void> {
    await tx.discountRedemption.create({
      data: {
        codeId: opts.validated.codeId,
        appointmentId: opts.appointmentId,
        clientId: opts.clientId,
        amountApplied: opts.validated.discountAmount,
      },
    });

    if (opts.validated.maxRedemptions != null) {
      const total = await tx.discountRedemption.count({
        where: { codeId: opts.validated.codeId },
      });
      if (total > opts.validated.maxRedemptions) {
        throw new BadRequestException(
          'Codul de reducere a atins numărul maxim de utilizări.',
        );
      }
    }
  }
}
