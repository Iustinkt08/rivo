import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, DiscountType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { computeDiscountAmounts } from '../discounts/discounts.service';
import { UpsertPunchCardDto } from './dto/upsert-punch-card.dto';

const PERCENT_MAX = 100;

// Booking-time auto-redeem runs both on the root client and inside the
// appointment-create transaction (tx) — accept the common delegate subset.
export type LoyaltyDbClient = Pick<
  Prisma.TransactionClient,
  'punchCardConfig' | 'punchRedemption' | 'appointment'
>;

/** An earned reward resolved at booking time, with the server-computed amount. */
export interface EligiblePunchReward {
  salonId: string;
  clientId: string;
  /** Amount taken off priceSnapshot (PERCENT rounded 2dp, FIXED capped at price). */
  amountApplied: number;
}

/** Punch-card progress for one client at one salon (server-computed). */
export interface PunchProgress {
  active: boolean;
  requiredVisits: number | null;
  rewardType: DiscountType | null;
  rewardValue: number | null;
  completedVisits: number;
  earned: boolean;
}

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Access helpers ──────────────────────────────────────────────────────────

  // Mirrors assertSalonOwner in sibling services (discounts.service.ts).
  private async assertSalonOwner(salonId: string, userId: string) {
    const salon = await this.prisma.salon.findUnique({
      where: { id: salonId },
    });
    if (!salon) throw new NotFoundException('Salon not found');
    if (salon.adminId !== userId)
      throw new ForbiddenException('Not your salon');
    return salon;
  }

  // Owner OR active staff of the salon (mirrors assertSalonAccess in
  // appointments.service.ts) — staff see the config/progress read-only.
  private async assertSalonAccess(salonId: string, userId: string) {
    const salon = await this.prisma.salon.findUnique({
      where: { id: salonId },
    });
    if (!salon) throw new NotFoundException('Salon not found');
    if (salon.adminId === userId) return salon;

    const staff = await this.prisma.staff.findFirst({
      where: { salonId, userId, isActive: true },
    });
    if (!staff) throw new ForbiddenException('Not your salon');
    return salon;
  }

  /** PERCENT must be 1-100; FIXED just > 0 (DTO enforces positivity). */
  private assertValueForType(type: DiscountType, value: number) {
    if (type === DiscountType.PERCENT && value > PERCENT_MAX) {
      throw new BadRequestException(
        'Recompensa procentuală trebuie să fie între 1 și 100.',
      );
    }
  }

  /** UI shape: Decimal → number. */
  private toConfigResponse(row: {
    salonId: string;
    isActive: boolean;
    requiredVisits: number;
    rewardType: DiscountType;
    rewardValue: Prisma.Decimal | number;
    updatedAt: Date;
  }) {
    return {
      salonId: row.salonId,
      isActive: row.isActive,
      requiredVisits: row.requiredVisits,
      rewardType: row.rewardType,
      rewardValue: Number(row.rewardValue),
      updatedAt: row.updatedAt,
    };
  }

  // ─── Progress computation (single source of truth) ───────────────────────────

  /**
   * COMPLETED visits of a client at a salon since their latest punch
   * redemption there — the redemption row itself resets progress. No
   * redemption yet → every COMPLETED visit counts.
   *
   * `updatedAt` (not startAt) is compared against redeemedAt: an appointment
   * only becomes COMPLETED via an update, so updatedAt marks when the visit
   * actually counted.
   */
  private async countCompletedVisits(
    db: LoyaltyDbClient,
    salonId: string,
    clientId: string,
  ): Promise<number> {
    const lastRedemption = await db.punchRedemption.findFirst({
      where: { salonId, clientId },
      orderBy: { redeemedAt: 'desc' },
      select: { redeemedAt: true },
    });

    return db.appointment.count({
      where: {
        salonId,
        clientId,
        status: AppointmentStatus.COMPLETED,
        ...(lastRedemption
          ? { updatedAt: { gt: lastRedemption.redeemedAt } }
          : {}),
      },
    });
  }

  // ─── Owner / staff endpoints ─────────────────────────────────────────────────

  /** PUT config — owner only, upsert on the salon's unique config row. */
  async upsertConfig(salonId: string, userId: string, dto: UpsertPunchCardDto) {
    await this.assertSalonOwner(salonId, userId);
    this.assertValueForType(dto.rewardType, dto.rewardValue);

    const config = await this.prisma.punchCardConfig.upsert({
      where: { salonId },
      create: {
        salonId,
        isActive: dto.isActive,
        requiredVisits: dto.requiredVisits,
        rewardType: dto.rewardType,
        rewardValue: dto.rewardValue,
      },
      update: {
        isActive: dto.isActive,
        requiredVisits: dto.requiredVisits,
        rewardType: dto.rewardType,
        rewardValue: dto.rewardValue,
      },
    });
    return this.toConfigResponse(config);
  }

  /** GET config — owner or active staff; null when never configured. */
  async getConfig(salonId: string, userId: string) {
    await this.assertSalonAccess(salonId, userId);
    const config = await this.prisma.punchCardConfig.findUnique({
      where: { salonId },
    });
    return config ? this.toConfigResponse(config) : null;
  }

  /** GET a client's punch progress at a salon — owner or active staff. */
  async getClientProgress(
    salonId: string,
    clientId: string,
    userId: string,
  ): Promise<PunchProgress> {
    await this.assertSalonAccess(salonId, userId);

    const config = await this.prisma.punchCardConfig.findUnique({
      where: { salonId },
    });
    if (!config || !config.isActive) {
      return {
        active: false,
        requiredVisits: null,
        rewardType: null,
        rewardValue: null,
        completedVisits: 0,
        earned: false,
      };
    }

    const completedVisits = await this.countCompletedVisits(
      this.prisma,
      salonId,
      clientId,
    );
    return {
      active: true,
      requiredVisits: config.requiredVisits,
      rewardType: config.rewardType,
      rewardValue: Number(config.rewardValue),
      completedVisits,
      earned: completedVisits >= config.requiredVisits,
    };
  }

  // ─── Client endpoint ─────────────────────────────────────────────────────────

  /**
   * The caller's punch cards: every salon with an ACTIVE config where they
   * have at least one appointment (any status), with computed progress.
   */
  async getMyPunchCards(clientId: string) {
    const configs = await this.prisma.punchCardConfig.findMany({
      where: {
        isActive: true,
        salon: { appointments: { some: { clientId } } },
      },
      include: { salon: { select: { id: true, name: true, logoUrl: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    return Promise.all(
      configs.map(async (config) => {
        const completedVisits = await this.countCompletedVisits(
          this.prisma,
          config.salonId,
          clientId,
        );
        return {
          salon: config.salon,
          requiredVisits: config.requiredVisits,
          rewardType: config.rewardType,
          rewardValue: Number(config.rewardValue),
          completedVisits,
          earned: completedVisits >= config.requiredVisits,
        };
      }),
    );
  }

  // ─── Booking-time auto-redeem (appointment-create transaction) ───────────────

  /**
   * Eligibility READ for the booking transaction: when the salon's config is
   * active and the client's completed visits reached the threshold, returns
   * the reward with the amount computed server-side from `price`
   * (= priceSnapshot; PERCENT rounded to 2 decimals, FIXED capped at price).
   * Otherwise null. Never throws business errors — inelegibility is a normal
   * outcome, and callers treat lookup failures as not-eligible.
   */
  async resolveEligibleReward(
    db: LoyaltyDbClient,
    opts: { salonId: string; clientId: string; price: number },
  ): Promise<EligiblePunchReward | null> {
    const config = await db.punchCardConfig.findUnique({
      where: { salonId: opts.salonId },
    });
    if (!config || !config.isActive) return null;

    const completedVisits = await this.countCompletedVisits(
      db,
      opts.salonId,
      opts.clientId,
    );
    if (completedVisits < config.requiredVisits) return null;

    const { discountAmount } = computeDiscountAmounts(
      config.rewardType,
      Number(config.rewardValue),
      opts.price,
    );
    return {
      salonId: opts.salonId,
      clientId: opts.clientId,
      amountApplied: discountAmount,
    };
  }

  /**
   * Audit-trail WRITE inside the booking transaction. The new row is what
   * resets progress — countCompletedVisits only counts after redeemedAt. A
   * failure here must roll the whole booking back (unique appointmentId
   * guards double-redeems), so it is intentionally not caught.
   */
  async recordRedemption(
    db: LoyaltyDbClient,
    opts: { reward: EligiblePunchReward; appointmentId: string },
  ): Promise<void> {
    await db.punchRedemption.create({
      data: {
        salonId: opts.reward.salonId,
        clientId: opts.reward.clientId,
        appointmentId: opts.appointmentId,
        amountApplied: opts.reward.amountApplied,
      },
    });
  }
}
