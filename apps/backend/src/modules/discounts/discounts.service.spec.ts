import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DiscountsService, computeDiscountAmounts } from './discounts.service';
import { PrismaService } from '../../prisma/prisma.service';

const OWNER_ID = 'owner-1';
const SALON_ID = 'salon-1';
const CLIENT_ID = 'client-1';
const SERVICE_ID = 'service-1';

const salonRow = { id: SALON_ID, adminId: OWNER_ID };
const serviceRow = { id: SERVICE_ID, salonId: SALON_ID, price: 150 };

/** A fully redeemable code — tests override single fields to break one rule. */
const validCodeRow = {
  id: 'code-1',
  salonId: SALON_ID,
  code: 'VARA-2026',
  type: 'PERCENT',
  value: 20,
  validFrom: null,
  validUntil: null,
  maxRedemptions: null,
  maxPerClient: 1,
  isActive: true,
};

describe('DiscountsService', () => {
  let service: DiscountsService;

  const prismaMock = {
    salon: { findUnique: jest.fn() },
    service: { findFirst: jest.fn() },
    discountCode: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    discountRedemption: { count: jest.fn(), create: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscountsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<DiscountsService>(DiscountsService);

    // Happy-path defaults; individual tests override what they need.
    prismaMock.salon.findUnique.mockResolvedValue(salonRow);
    prismaMock.service.findFirst.mockResolvedValue(serviceRow);
    prismaMock.discountCode.findUnique.mockResolvedValue(validCodeRow);
    prismaMock.discountRedemption.count.mockResolvedValue(0);
  });

  // ─── Create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    beforeEach(() => {
      prismaMock.discountCode.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...data, id: 'code-new', value: data.value }),
      );
    });

    it('forbids a non-owner from creating codes', async () => {
      // Act + Assert
      await expect(
        service.create(SALON_ID, 'intruder', { type: 'PERCENT', value: 10 } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prismaMock.discountCode.create).not.toHaveBeenCalled();
    });

    it('stores the custom code normalized (uppercase, trimmed)', async () => {
      // Act
      const result = await service.create(SALON_ID, OWNER_ID, {
        code: '  vara-2026 ',
        type: 'PERCENT',
        value: 20,
      } as any);

      // Assert
      expect(result.code).toBe('VARA-2026');
      expect(result.redemptionCount).toBe(0);
    });

    it('generates a readable XXXX-XXXX code when none is provided', async () => {
      // Arrange — no collision on the first candidate
      prismaMock.discountCode.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.create(SALON_ID, OWNER_ID, {
        type: 'FIXED',
        value: 25,
      } as any);

      // Assert
      expect(result.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    });

    it('retries generation until a free code is found', async () => {
      // Arrange — first two candidates collide, third is free
      prismaMock.discountCode.findUnique
        .mockResolvedValueOnce({ id: 'taken-1' })
        .mockResolvedValueOnce({ id: 'taken-2' })
        .mockResolvedValueOnce(null);

      // Act
      const result = await service.create(SALON_ID, OWNER_ID, {
        type: 'FIXED',
        value: 25,
      } as any);

      // Assert
      expect(prismaMock.discountCode.findUnique).toHaveBeenCalledTimes(3);
      expect(result.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    });

    it('gives up with 409 when every generation attempt collides', async () => {
      // Arrange
      prismaMock.discountCode.findUnique.mockResolvedValue({ id: 'taken' });

      // Act + Assert
      await expect(
        service.create(SALON_ID, OWNER_ID, { type: 'FIXED', value: 25 } as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects PERCENT values above 100', async () => {
      // Act + Assert
      await expect(
        service.create(SALON_ID, OWNER_ID, {
          type: 'PERCENT',
          value: 150,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects validUntil not after validFrom', async () => {
      // Act + Assert
      await expect(
        service.create(SALON_ID, OWNER_ID, {
          type: 'PERCENT',
          value: 10,
          validFrom: '2026-08-01T00:00:00Z',
          validUntil: '2026-07-01T00:00:00Z',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('maps a P2002 unique violation to 409', async () => {
      // Arrange
      prismaMock.discountCode.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      // Act + Assert
      await expect(
        service.create(SALON_ID, OWNER_ID, {
          code: 'VARA-2026',
          type: 'PERCENT',
          value: 10,
        } as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ─── List / update / delete ─────────────────────────────────────────────────

  describe('findAll', () => {
    it('lists newest-first with redemptionCount per code', async () => {
      // Arrange
      prismaMock.discountCode.findMany.mockResolvedValue([
        { ...validCodeRow, _count: { redemptions: 3 } },
      ]);

      // Act
      const result = await service.findAll(SALON_ID, OWNER_ID);

      // Assert
      expect(prismaMock.discountCode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
      expect(result[0].redemptionCount).toBe(3);
      expect(result[0].value).toBe(20);
    });
  });

  describe('update', () => {
    it('404s when the code belongs to another salon', async () => {
      // Arrange
      prismaMock.discountCode.findFirst.mockResolvedValue(null);

      // Act + Assert
      await expect(
        service.update(SALON_ID, 'code-x', OWNER_ID, { isActive: false }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('patches only the provided fields', async () => {
      // Arrange
      prismaMock.discountCode.findFirst.mockResolvedValue(validCodeRow);
      prismaMock.discountCode.update.mockResolvedValue({
        ...validCodeRow,
        isActive: false,
        _count: { redemptions: 0 },
      });

      // Act
      await service.update(SALON_ID, 'code-1', OWNER_ID, { isActive: false });

      // Assert
      expect(prismaMock.discountCode.update.mock.calls[0][0].data).toEqual({
        isActive: false,
      });
    });
  });

  describe('remove', () => {
    it('hard-deletes a never-redeemed code', async () => {
      // Arrange
      prismaMock.discountCode.findFirst.mockResolvedValue({
        ...validCodeRow,
        _count: { redemptions: 0 },
      });

      // Act
      const result = await service.remove(SALON_ID, 'code-1', OWNER_ID);

      // Assert
      expect(result).toEqual({ id: 'code-1', result: 'deleted' });
      expect(prismaMock.discountCode.delete).toHaveBeenCalled();
      expect(prismaMock.discountCode.update).not.toHaveBeenCalled();
    });

    it('soft-retires a redeemed code instead of deleting it', async () => {
      // Arrange
      prismaMock.discountCode.findFirst.mockResolvedValue({
        ...validCodeRow,
        _count: { redemptions: 2 },
      });
      prismaMock.discountCode.update.mockResolvedValue({});

      // Act
      const result = await service.remove(SALON_ID, 'code-1', OWNER_ID);

      // Assert
      expect(result).toEqual({ id: 'code-1', result: 'retired' });
      expect(prismaMock.discountCode.delete).not.toHaveBeenCalled();
      expect(prismaMock.discountCode.update).toHaveBeenCalledWith({
        where: { id: 'code-1' },
        data: { isActive: false },
      });
    });
  });

  // ─── Validation matrix ──────────────────────────────────────────────────────

  describe('validate', () => {
    const dto = { code: 'vara-2026', serviceId: SERVICE_ID };

    it('404s when the service does not belong to the salon', async () => {
      // Arrange
      prismaMock.service.findFirst.mockResolvedValue(null);

      // Act + Assert
      await expect(
        service.validate(SALON_ID, CLIENT_ID, dto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s for an unknown code', async () => {
      // Arrange
      prismaMock.discountCode.findUnique.mockResolvedValue(null);

      // Act + Assert
      await expect(
        service.validate(SALON_ID, CLIENT_ID, dto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('looks the code up normalized (case-insensitive input)', async () => {
      // Act
      await service.validate(SALON_ID, CLIENT_ID, {
        code: '  vara-2026 ',
        serviceId: SERVICE_ID,
      });

      // Assert
      expect(prismaMock.discountCode.findUnique).toHaveBeenCalledWith({
        where: { salonId_code: { salonId: SALON_ID, code: 'VARA-2026' } },
      });
    });

    it('rejects an inactive code', async () => {
      // Arrange
      prismaMock.discountCode.findUnique.mockResolvedValue({
        ...validCodeRow,
        isActive: false,
      });

      // Act + Assert
      await expect(
        service.validate(SALON_ID, CLIENT_ID, dto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a code before its validity window opens', async () => {
      // Arrange
      prismaMock.discountCode.findUnique.mockResolvedValue({
        ...validCodeRow,
        validFrom: new Date(Date.now() + 86_400_000),
      });

      // Act + Assert
      await expect(
        service.validate(SALON_ID, CLIENT_ID, dto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an expired code', async () => {
      // Arrange
      prismaMock.discountCode.findUnique.mockResolvedValue({
        ...validCodeRow,
        validUntil: new Date(Date.now() - 86_400_000),
      });

      // Act + Assert
      await expect(
        service.validate(SALON_ID, CLIENT_ID, dto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when the total redemption cap is reached', async () => {
      // Arrange
      prismaMock.discountCode.findUnique.mockResolvedValue({
        ...validCodeRow,
        maxRedemptions: 5,
      });
      prismaMock.discountRedemption.count.mockResolvedValue(5);

      // Act + Assert
      await expect(
        service.validate(SALON_ID, CLIENT_ID, dto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when the caller hit their per-client cap', async () => {
      // Arrange — no total cap; the single count call is the per-client one
      prismaMock.discountRedemption.count.mockResolvedValue(1); // maxPerClient=1

      // Act + Assert
      await expect(
        service.validate(SALON_ID, CLIENT_ID, dto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.discountRedemption.count).toHaveBeenCalledWith({
        where: { codeId: 'code-1', clientId: CLIENT_ID },
      });
    });

    it('computes PERCENT amounts server-side from the service price', async () => {
      // Act — 20% of 150 RON
      const result = await service.validate(SALON_ID, CLIENT_ID, dto);

      // Assert
      expect(result).toEqual({
        valid: true,
        code: 'VARA-2026',
        type: 'PERCENT',
        value: 20,
        discountAmount: 30,
        finalPrice: 120,
      });
    });

    it('caps FIXED discounts at the service price', async () => {
      // Arrange — 200 RON off a 150 RON service
      prismaMock.discountCode.findUnique.mockResolvedValue({
        ...validCodeRow,
        type: 'FIXED',
        value: 200,
      });

      // Act
      const result = await service.validate(SALON_ID, CLIENT_ID, dto);

      // Assert
      expect(result.discountAmount).toBe(150);
      expect(result.finalPrice).toBe(0);
    });

    it('rounds percent math to 2 decimals', () => {
      // Act — 33% of 99.99 = 32.9967 → 33.00
      const { discountAmount, finalPrice } = computeDiscountAmounts(
        'PERCENT' as any,
        33,
        99.99,
      );

      // Assert
      expect(discountAmount).toBe(33);
      expect(finalPrice).toBe(66.99);
    });
  });

  // ─── Redemption recording (booking transaction) ─────────────────────────────

  describe('recordRedemption', () => {
    const validated = {
      codeId: 'code-1',
      code: 'VARA-2026',
      type: 'PERCENT' as any,
      value: 20,
      maxRedemptions: 5,
      maxPerClient: 10,
      discountAmount: 30,
      finalPrice: 120,
    };

    it('writes the redemption row with the server-computed amount', async () => {
      // Arrange
      prismaMock.discountRedemption.count.mockResolvedValue(3);

      // Act
      await service.recordRedemption(prismaMock as any, {
        validated,
        appointmentId: 'appt-1',
        clientId: CLIENT_ID,
      });

      // Assert
      expect(prismaMock.discountRedemption.create).toHaveBeenCalledWith({
        data: {
          codeId: 'code-1',
          appointmentId: 'appt-1',
          clientId: CLIENT_ID,
          amountApplied: 30,
        },
      });
    });

    it('row-locks the code before re-counting (serializes parallel redemptions)', async () => {
      // Arrange
      prismaMock.discountRedemption.count.mockResolvedValue(3);

      // Act
      await service.recordRedemption(prismaMock as any, {
        validated,
        appointmentId: 'appt-1',
        clientId: CLIENT_ID,
      });

      // Assert — the UPDATE takes the row-level lock inside the booking tx.
      expect(prismaMock.discountCode.update).toHaveBeenCalledWith({
        where: { id: 'code-1' },
        data: { updatedAt: expect.any(Date) },
      });
    });

    it('throws when the insert pushed the count over maxRedemptions (parallel bookings)', async () => {
      // Arrange — after our insert the code counts 6 uses against a cap of 5
      prismaMock.discountRedemption.count.mockResolvedValue(6);

      // Act + Assert
      await expect(
        service.recordRedemption(prismaMock as any, {
          validated,
          appointmentId: 'appt-1',
          clientId: CLIENT_ID,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when the insert pushed the count over maxPerClient (parallel bookings)', async () => {
      // Arrange — total cap fine (2 ≤ 5) but this client now counts 2 > 1
      prismaMock.discountRedemption.count.mockResolvedValue(2);

      // Act + Assert
      await expect(
        service.recordRedemption(prismaMock as any, {
          validated: { ...validated, maxPerClient: 1 },
          appointmentId: 'appt-1',
          clientId: CLIENT_ID,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('skips the total-cap re-check for unlimited codes but still re-checks per-client', async () => {
      // Act
      await service.recordRedemption(prismaMock as any, {
        validated: { ...validated, maxRedemptions: null },
        appointmentId: 'appt-1',
        clientId: CLIENT_ID,
      });

      // Assert — only the per-client count runs, scoped to this client.
      expect(prismaMock.discountRedemption.count).toHaveBeenCalledTimes(1);
      expect(prismaMock.discountRedemption.count).toHaveBeenCalledWith({
        where: { codeId: 'code-1', clientId: CLIENT_ID },
      });
    });
  });
});
