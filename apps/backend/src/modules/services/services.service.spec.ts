import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, Logger } from '@nestjs/common';
import { ServicesService } from './services.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('ServicesService — staff assignments', () => {
  let service: ServicesService;

  // Transaction client shares the same mocks so assertions see tx calls too.
  const txMock = {
    service: {
      create: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    staffService: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const prismaMock = {
    salon: { findUnique: jest.fn() },
    staff: { findMany: jest.fn() },
    service: { findFirst: jest.fn(), findMany: jest.fn() },
    appointment: { findMany: jest.fn() },
    $transaction: jest.fn((fn: (tx: typeof txMock) => unknown) => fn(txMock)),
  };
  const notificationsMock = { notify: jest.fn() };

  const SALON_ID = 'salon-1';
  const OWNER_ID = 'owner-1';
  const SERVICE_ID = 'svc-1';
  const STAFF_A = '4f8b1a6e-0000-4000-8000-00000000000a';
  const STAFF_B = '4f8b1a6e-0000-4000-8000-00000000000b';

  const baseDto = {
    categoryId: 'cat-1',
    name: 'Tuns',
    durationMin: 45,
    price: 100,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: NotificationsService, useValue: notificationsMock },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);

    prismaMock.salon.findUnique.mockResolvedValue({
      id: SALON_ID,
      adminId: OWNER_ID,
    });
    prismaMock.service.findFirst.mockResolvedValue({
      id: SERVICE_ID,
      salonId: SALON_ID,
      name: 'Tuns',
      price: 100,
      durationMin: 45,
      currency: 'RON',
    });
    prismaMock.appointment.findMany.mockResolvedValue([]);
    notificationsMock.notify.mockResolvedValue(null);
    txMock.service.create.mockResolvedValue({ id: SERVICE_ID });
    txMock.service.update.mockResolvedValue({ id: SERVICE_ID });
    txMock.service.findUniqueOrThrow.mockResolvedValue({
      id: SERVICE_ID,
      staffServices: [{ staffId: STAFF_A }],
    });
  });

  describe('create', () => {
    it('creates StaffService join rows for provided staffIds', async () => {
      // Arrange
      prismaMock.staff.findMany.mockResolvedValue([
        { id: STAFF_A },
        { id: STAFF_B },
      ]);

      // Act
      await service.create(SALON_ID, OWNER_ID, {
        ...baseDto,
        staffIds: [STAFF_A, STAFF_B],
      } as any);

      // Assert
      expect(txMock.staffService.createMany).toHaveBeenCalledWith({
        data: [
          { staffId: STAFF_A, serviceId: SERVICE_ID },
          { staffId: STAFF_B, serviceId: SERVICE_ID },
        ],
      });
    });

    it('throws BadRequest when a staff id does not belong to the salon', async () => {
      // Arrange — only one of the two ids resolves within this salon
      prismaMock.staff.findMany.mockResolvedValue([{ id: STAFF_A }]);

      // Act + Assert
      await expect(
        service.create(SALON_ID, OWNER_ID, {
          ...baseDto,
          staffIds: [STAFF_A, STAFF_B],
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('deduplicates staffIds before creating join rows', async () => {
      // Arrange
      prismaMock.staff.findMany.mockResolvedValue([{ id: STAFF_A }]);

      // Act
      await service.create(SALON_ID, OWNER_ID, {
        ...baseDto,
        staffIds: [STAFF_A, STAFF_A],
      } as any);

      // Assert
      expect(txMock.staffService.createMany).toHaveBeenCalledWith({
        data: [{ staffId: STAFF_A, serviceId: SERVICE_ID }],
      });
    });

    it('does not touch join rows when staffIds is omitted', async () => {
      // Act
      await service.create(SALON_ID, OWNER_ID, baseDto as any);

      // Assert
      expect(prismaMock.staff.findMany).not.toHaveBeenCalled();
      expect(txMock.staffService.createMany).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('replaces existing assignments with the provided staffIds', async () => {
      // Arrange
      prismaMock.staff.findMany.mockResolvedValue([{ id: STAFF_B }]);

      // Act
      await service.update(SALON_ID, SERVICE_ID, OWNER_ID, {
        staffIds: [STAFF_B],
      } as any);

      // Assert — old rows removed, new ones created
      expect(txMock.staffService.deleteMany).toHaveBeenCalledWith({
        where: { serviceId: SERVICE_ID },
      });
      expect(txMock.staffService.createMany).toHaveBeenCalledWith({
        data: [{ staffId: STAFF_B, serviceId: SERVICE_ID }],
      });
    });

    it('clears all assignments when staffIds is an empty array', async () => {
      // Act
      await service.update(SALON_ID, SERVICE_ID, OWNER_ID, {
        staffIds: [],
      } as any);

      // Assert
      expect(txMock.staffService.deleteMany).toHaveBeenCalledWith({
        where: { serviceId: SERVICE_ID },
      });
      expect(txMock.staffService.createMany).not.toHaveBeenCalled();
    });

    it('leaves assignments untouched when staffIds is omitted', async () => {
      // Act
      await service.update(SALON_ID, SERVICE_ID, OWNER_ID, {
        name: 'Tuns nou',
      } as any);

      // Assert
      expect(txMock.staffService.deleteMany).not.toHaveBeenCalled();
      expect(txMock.staffService.createMany).not.toHaveBeenCalled();
    });

    it('does not spread staffIds into the service update data', async () => {
      // Arrange
      prismaMock.staff.findMany.mockResolvedValue([{ id: STAFF_A }]);

      // Act
      await service.update(SALON_ID, SERVICE_ID, OWNER_ID, {
        name: 'Tuns nou',
        staffIds: [STAFF_A],
      } as any);

      // Assert
      const data = txMock.service.update.mock.calls[0][0].data;
      expect(data).toEqual({ name: 'Tuns nou' });
      expect(data.staffIds).toBeUndefined();
    });

    it('rejects staff from another salon before writing anything', async () => {
      // Arrange
      prismaMock.staff.findMany.mockResolvedValue([]);

      // Act + Assert
      await expect(
        service.update(SALON_ID, SERVICE_ID, OWNER_ID, {
          staffIds: [STAFF_B],
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('includes assigned staff ids on each service', async () => {
      // Arrange
      prismaMock.service.findMany.mockResolvedValue([]);

      // Act
      await service.findAll(SALON_ID);

      // Assert
      expect(prismaMock.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            staffServices: { select: { staffId: true } },
          }),
        }),
      );
    });
  });

  describe('update — price/duration change notifications', () => {
    const CLIENT_A = 'client-a';
    const CLIENT_B = 'client-b';

    it('notifies each distinct client with PRICE_CHANGE when the price changes', async () => {
      // Arrange
      prismaMock.appointment.findMany.mockResolvedValue([
        { clientId: CLIENT_A },
        { clientId: CLIENT_B },
      ]);

      // Act
      await service.update(SALON_ID, SERVICE_ID, OWNER_ID, {
        price: 150,
      } as any);

      // Assert — one PRICE_CHANGE per distinct client, old → new value in body
      expect(notificationsMock.notify).toHaveBeenCalledTimes(2);
      for (const clientId of [CLIENT_A, CLIENT_B]) {
        expect(notificationsMock.notify).toHaveBeenCalledWith(
          clientId,
          expect.objectContaining({
            type: 'PRICE_CHANGE',
            title: 'Preț modificat',
            body: expect.stringContaining('de la 100 RON la 150 RON'),
          }),
        );
      }
    });

    it('notifies with DURATION_CHANGE when the duration changes', async () => {
      // Arrange
      prismaMock.appointment.findMany.mockResolvedValue([
        { clientId: CLIENT_A },
      ]);

      // Act
      await service.update(SALON_ID, SERVICE_ID, OWNER_ID, {
        durationMin: 60,
      } as any);

      // Assert
      expect(notificationsMock.notify).toHaveBeenCalledWith(
        CLIENT_A,
        expect.objectContaining({
          type: 'DURATION_CHANGE',
          title: 'Durată modificată',
          body: expect.stringContaining('de la 45 min la 60 min'),
        }),
      );
    });

    it('only targets future PENDING/CONFIRMED appointments of registered clients', async () => {
      // Arrange
      prismaMock.appointment.findMany.mockResolvedValue([]);

      // Act
      await service.update(SALON_ID, SERVICE_ID, OWNER_ID, {
        price: 150,
      } as any);

      // Assert — guests excluded, distinct clients, future window, live statuses
      expect(prismaMock.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            serviceId: SERVICE_ID,
            guestName: null,
            startAt: { gt: expect.any(Date) },
            status: { in: ['PENDING', 'CONFIRMED'] },
          }),
          distinct: ['clientId'],
        }),
      );
      expect(notificationsMock.notify).not.toHaveBeenCalled();
    });

    it('does not notify when price is submitted unchanged', async () => {
      // Act — dto price equals the stored price
      await service.update(SALON_ID, SERVICE_ID, OWNER_ID, {
        price: 100,
        durationMin: 45,
      } as any);

      // Assert
      expect(prismaMock.appointment.findMany).not.toHaveBeenCalled();
      expect(notificationsMock.notify).not.toHaveBeenCalled();
    });

    it('does not notify when neither price nor duration is in the dto', async () => {
      // Act
      await service.update(SALON_ID, SERVICE_ID, OWNER_ID, {
        name: 'Tuns nou',
      } as any);

      // Assert
      expect(prismaMock.appointment.findMany).not.toHaveBeenCalled();
      expect(notificationsMock.notify).not.toHaveBeenCalled();
    });

    it('never fails the update when notifications fail', async () => {
      // Arrange
      prismaMock.appointment.findMany.mockResolvedValue([
        { clientId: CLIENT_A },
      ]);
      notificationsMock.notify.mockRejectedValue(new Error('db down'));

      // Act + Assert
      await expect(
        service.update(SALON_ID, SERVICE_ID, OWNER_ID, { price: 150 } as any),
      ).resolves.toEqual(expect.objectContaining({ id: SERVICE_ID }));
    });
  });
});
