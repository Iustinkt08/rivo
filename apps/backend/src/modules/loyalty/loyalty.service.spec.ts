import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LoyaltyService } from './loyalty.service';
import { UpsertPunchCardDto } from './dto/upsert-punch-card.dto';
import { PrismaService } from '../../prisma/prisma.service';

const OWNER_ID = 'owner-1';
const STAFF_USER_ID = 'staff-user-1';
const SALON_ID = 'salon-1';
const CLIENT_ID = 'client-1';

const salonRow = { id: SALON_ID, adminId: OWNER_ID };
const staffRow = { id: 'staff-1', salonId: SALON_ID, userId: STAFF_USER_ID };

/** An active 5-visit / 20% config — tests override single fields. */
const activeConfigRow = {
  id: 'config-1',
  salonId: SALON_ID,
  isActive: true,
  requiredVisits: 5,
  rewardType: 'PERCENT',
  rewardValue: 20,
  updatedAt: new Date('2026-06-01T10:00:00Z'),
};

const dtoBase = {
  isActive: true,
  requiredVisits: 5,
  rewardType: 'PERCENT',
  rewardValue: 20,
} as any;

async function validateDto(overrides: Record<string, unknown>) {
  const dto = plainToInstance(UpsertPunchCardDto, {
    ...dtoBase,
    ...overrides,
  });
  return validate(dto);
}

describe('LoyaltyService', () => {
  let service: LoyaltyService;

  const prismaMock = {
    salon: { findUnique: jest.fn() },
    staff: { findFirst: jest.fn() },
    punchCardConfig: { findUnique: jest.fn(), findMany: jest.fn(), upsert: jest.fn() },
    punchRedemption: { findFirst: jest.fn(), create: jest.fn() },
    appointment: { count: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoyaltyService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<LoyaltyService>(LoyaltyService);

    // Happy-path defaults; individual tests override what they need.
    prismaMock.salon.findUnique.mockResolvedValue(salonRow);
    prismaMock.staff.findFirst.mockResolvedValue(null);
    prismaMock.punchCardConfig.findUnique.mockResolvedValue(activeConfigRow);
    prismaMock.punchRedemption.findFirst.mockResolvedValue(null);
    prismaMock.appointment.count.mockResolvedValue(0);
    prismaMock.punchCardConfig.upsert.mockImplementation(({ create }: any) =>
      Promise.resolve({ ...activeConfigRow, ...create }),
    );
  });

  // ─── Upsert validation ───────────────────────────────────────────────────────

  describe('upsertConfig', () => {
    it('upserts the config keyed on the salon id and maps Decimal to number', async () => {
      // Act
      const result = await service.upsertConfig(SALON_ID, OWNER_ID, dtoBase);

      // Assert
      expect(prismaMock.punchCardConfig.upsert).toHaveBeenCalledWith({
        where: { salonId: SALON_ID },
        create: expect.objectContaining({ salonId: SALON_ID, requiredVisits: 5 }),
        update: expect.objectContaining({ requiredVisits: 5, rewardValue: 20 }),
      });
      expect(result.rewardValue).toBe(20);
      expect(result.isActive).toBe(true);
    });

    it('forbids a non-owner (even active staff) from writing the config', async () => {
      // Arrange — caller is staff, not the admin
      prismaMock.staff.findFirst.mockResolvedValue(staffRow);

      // Act + Assert
      await expect(
        service.upsertConfig(SALON_ID, STAFF_USER_ID, dtoBase),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prismaMock.punchCardConfig.upsert).not.toHaveBeenCalled();
    });

    it('404s for an unknown salon', async () => {
      // Arrange
      prismaMock.salon.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(
        service.upsertConfig(SALON_ID, OWNER_ID, dtoBase),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects PERCENT rewards above 100', async () => {
      // Act + Assert
      await expect(
        service.upsertConfig(SALON_ID, OWNER_ID, {
          ...dtoBase,
          rewardValue: 150,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts FIXED rewards above 100 (RON amount, not a percentage)', async () => {
      // Act
      const result = await service.upsertConfig(SALON_ID, OWNER_ID, {
        ...dtoBase,
        rewardType: 'FIXED',
        rewardValue: 150,
      });

      // Assert
      expect(result.rewardValue).toBe(150);
    });

    it('DTO rejects requiredVisits below 2 and above 50, accepts the bounds', async () => {
      // Act
      const [tooLow, tooHigh, atMin, atMax, fractional] = await Promise.all([
        validateDto({ requiredVisits: 1 }),
        validateDto({ requiredVisits: 51 }),
        validateDto({ requiredVisits: 2 }),
        validateDto({ requiredVisits: 50 }),
        validateDto({ requiredVisits: 7.5 }),
      ]);

      // Assert
      expect(tooLow).not.toHaveLength(0);
      expect(tooHigh).not.toHaveLength(0);
      expect(atMin).toHaveLength(0);
      expect(atMax).toHaveLength(0);
      expect(fractional).not.toHaveLength(0);
    });

    it('DTO rejects a non-positive rewardValue', async () => {
      // Act
      const errors = await validateDto({ rewardValue: 0 });

      // Assert
      expect(errors).not.toHaveLength(0);
    });
  });

  // ─── Read access matrix ──────────────────────────────────────────────────────

  describe('getConfig / getClientProgress access', () => {
    it('lets the owner read the config', async () => {
      // Act
      const result = await service.getConfig(SALON_ID, OWNER_ID);

      // Assert
      expect(result?.requiredVisits).toBe(5);
      expect(prismaMock.staff.findFirst).not.toHaveBeenCalled();
    });

    it('lets active staff of the salon read the config', async () => {
      // Arrange
      prismaMock.staff.findFirst.mockResolvedValue(staffRow);

      // Act
      const result = await service.getConfig(SALON_ID, STAFF_USER_ID);

      // Assert
      expect(result?.requiredVisits).toBe(5);
      expect(prismaMock.staff.findFirst).toHaveBeenCalledWith({
        where: { salonId: SALON_ID, userId: STAFF_USER_ID, isActive: true },
      });
    });

    it('403s a caller who is neither owner nor active staff (foreign salon)', async () => {
      // Act + Assert
      await expect(
        service.getConfig(SALON_ID, 'intruder'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.getClientProgress(SALON_ID, CLIENT_ID, 'intruder'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('404s progress reads for an unknown salon', async () => {
      // Arrange
      prismaMock.salon.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(
        service.getClientProgress(SALON_ID, CLIENT_ID, OWNER_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns null when the salon never configured a punch card', async () => {
      // Arrange
      prismaMock.punchCardConfig.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(service.getConfig(SALON_ID, OWNER_ID)).resolves.toBeNull();
    });
  });

  // ─── Progress computation ────────────────────────────────────────────────────

  describe('getClientProgress', () => {
    it('counts every COMPLETED visit when the client never redeemed', async () => {
      // Arrange
      prismaMock.appointment.count.mockResolvedValue(3);

      // Act
      const result = await service.getClientProgress(SALON_ID, CLIENT_ID, OWNER_ID);

      // Assert — no updatedAt filter without a redemption
      expect(prismaMock.appointment.count).toHaveBeenCalledWith({
        where: { salonId: SALON_ID, clientId: CLIENT_ID, status: 'COMPLETED' },
      });
      expect(result).toEqual({
        active: true,
        requiredVisits: 5,
        rewardType: 'PERCENT',
        rewardValue: 20,
        completedVisits: 3,
        earned: false,
      });
    });

    it('counts only visits after the latest redemption (progress reset)', async () => {
      // Arrange
      const redeemedAt = new Date('2026-06-15T09:00:00Z');
      prismaMock.punchRedemption.findFirst.mockResolvedValue({ redeemedAt });
      prismaMock.appointment.count.mockResolvedValue(1);

      // Act
      const result = await service.getClientProgress(SALON_ID, CLIENT_ID, OWNER_ID);

      // Assert
      expect(prismaMock.punchRedemption.findFirst).toHaveBeenCalledWith({
        where: { salonId: SALON_ID, clientId: CLIENT_ID },
        orderBy: { redeemedAt: 'desc' },
        select: { redeemedAt: true },
      });
      expect(prismaMock.appointment.count).toHaveBeenCalledWith({
        where: {
          salonId: SALON_ID,
          clientId: CLIENT_ID,
          status: 'COMPLETED',
          updatedAt: { gt: redeemedAt },
        },
      });
      expect(result.completedVisits).toBe(1);
      expect(result.earned).toBe(false);
    });

    it('flags earned once completedVisits reaches requiredVisits', async () => {
      // Arrange
      prismaMock.appointment.count.mockResolvedValue(5);

      // Act
      const result = await service.getClientProgress(SALON_ID, CLIENT_ID, OWNER_ID);

      // Assert
      expect(result.earned).toBe(true);
    });

    it('returns the inactive shape without counting when config is off/missing', async () => {
      // Arrange
      prismaMock.punchCardConfig.findUnique.mockResolvedValue({
        ...activeConfigRow,
        isActive: false,
      });

      // Act
      const result = await service.getClientProgress(SALON_ID, CLIENT_ID, OWNER_ID);

      // Assert
      expect(result).toEqual({
        active: false,
        requiredVisits: null,
        rewardType: null,
        rewardValue: null,
        completedVisits: 0,
        earned: false,
      });
      expect(prismaMock.appointment.count).not.toHaveBeenCalled();
    });
  });

  // ─── Me endpoint ─────────────────────────────────────────────────────────────

  describe('getMyPunchCards', () => {
    it('returns per-salon cards with computed progress and salon summary', async () => {
      // Arrange
      prismaMock.punchCardConfig.findMany.mockResolvedValue([
        {
          ...activeConfigRow,
          salon: { id: SALON_ID, name: 'Studio Glow', logoUrl: null },
        },
      ]);
      prismaMock.appointment.count.mockResolvedValue(5);

      // Act
      const result = await service.getMyPunchCards(CLIENT_ID);

      // Assert — only active configs at salons where the caller has appointments
      expect(prismaMock.punchCardConfig.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            salon: { appointments: { some: { clientId: CLIENT_ID } } },
          },
        }),
      );
      expect(result).toEqual([
        {
          salon: { id: SALON_ID, name: 'Studio Glow', logoUrl: null },
          requiredVisits: 5,
          rewardType: 'PERCENT',
          rewardValue: 20,
          completedVisits: 5,
          earned: true,
        },
      ]);
    });

    it('returns an empty array when no active configs match', async () => {
      // Arrange
      prismaMock.punchCardConfig.findMany.mockResolvedValue([]);

      // Act + Assert
      await expect(service.getMyPunchCards(CLIENT_ID)).resolves.toEqual([]);
    });
  });

  // ─── Booking-time auto-redeem ────────────────────────────────────────────────

  describe('resolveEligibleReward', () => {
    const opts = { salonId: SALON_ID, clientId: CLIENT_ID, price: 150 };

    it('returns the PERCENT reward amount once the threshold is reached', async () => {
      // Arrange — 5/5 visits, 20% of 150 RON
      prismaMock.appointment.count.mockResolvedValue(5);

      // Act
      const reward = await service.resolveEligibleReward(prismaMock as any, opts);

      // Assert
      expect(reward).toEqual({
        salonId: SALON_ID,
        clientId: CLIENT_ID,
        amountApplied: 30,
      });
    });

    it('caps FIXED rewards at the service price', async () => {
      // Arrange — 200 RON off a 150 RON service
      prismaMock.punchCardConfig.findUnique.mockResolvedValue({
        ...activeConfigRow,
        rewardType: 'FIXED',
        rewardValue: 200,
      });
      prismaMock.appointment.count.mockResolvedValue(5);

      // Act
      const reward = await service.resolveEligibleReward(prismaMock as any, opts);

      // Assert
      expect(reward?.amountApplied).toBe(150);
    });

    it('returns null below the visit threshold', async () => {
      // Arrange
      prismaMock.appointment.count.mockResolvedValue(4);

      // Act + Assert
      await expect(
        service.resolveEligibleReward(prismaMock as any, opts),
      ).resolves.toBeNull();
    });

    it('returns null when the config is inactive or missing', async () => {
      // Arrange
      prismaMock.punchCardConfig.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(
        service.resolveEligibleReward(prismaMock as any, opts),
      ).resolves.toBeNull();
      expect(prismaMock.appointment.count).not.toHaveBeenCalled();
    });
  });

  describe('recordRedemption', () => {
    it('writes the redemption row that resets the visit counter', async () => {
      // Act
      await service.recordRedemption(prismaMock as any, {
        reward: { salonId: SALON_ID, clientId: CLIENT_ID, amountApplied: 30 },
        appointmentId: 'appt-1',
      });

      // Assert
      expect(prismaMock.punchRedemption.create).toHaveBeenCalledWith({
        data: {
          salonId: SALON_ID,
          clientId: CLIENT_ID,
          appointmentId: 'appt-1',
          amountApplied: 30,
        },
      });
    });
  });
});
