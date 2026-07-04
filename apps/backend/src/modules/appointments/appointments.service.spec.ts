import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentsService, salonDayWindow } from './appointments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SlotLockService } from './slot-lock.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DiscountsService } from '../discounts/discounts.service';
import { LoyaltyService } from '../loyalty/loyalty.service';

// Shared across every block — jest.clearAllMocks() in each beforeEach resets it.
const discountsMock = {
  assertRedeemable: jest.fn(),
  recordRedemption: jest.fn(),
};
const loyaltyMock = {
  resolveEligibleReward: jest.fn(),
  recordRedemption: jest.fn(),
};

describe('AppointmentsService — create', () => {
  let service: AppointmentsService;

  const prismaMock = {
    service: { findFirst: jest.fn() },
    staff: { findFirst: jest.fn() },
    // Staff↔service link check (assertStaffInSalon): linked by default.
    staffService: { findUnique: jest.fn().mockResolvedValue({ staffId: 'staff-1', serviceId: 'svc-1' }) },
    appointment: { findFirst: jest.fn(), create: jest.fn() },
    clientSalonProfile: { findUnique: jest.fn(), upsert: jest.fn() },
    // Interactive transaction: run the callback with the mock itself as `tx`.
    $transaction: jest.fn((cb: any) => cb(prismaMock)),
  };
  const slotLockMock = { releaseLock: jest.fn() };
  const notificationsMock = { notify: jest.fn() };

  const ADMIN_ID = 'admin-1';

  const CLIENT_ID = 'client-1';
  const dto = {
    salonId: 'salon-1',
    serviceId: 'service-1',
    staffId: 'staff-1',
    // One week ahead — keeps the fixture inside the bookable window forever.
    startAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  } as any;

  const staffRow = { id: 'staff-1', salonId: 'salon-1', isActive: true };

  const serviceRow = {
    id: 'service-1',
    durationMin: 60,
    price: 100,
    currency: 'RON',
  };

  const createdAppointment = {
    id: 'appt-1',
    clientId: CLIENT_ID,
    salonId: dto.salonId,
    status: 'PENDING',
    startAt: new Date(dto.startAt),
    client: { id: CLIENT_ID, firstName: 'Ana', lastName: 'Pop' },
    service: { id: 'service-1', name: 'Unghii cu gel' },
    salon: { id: dto.salonId, name: 'Salon', adminId: ADMIN_ID },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SlotLockService, useValue: slotLockMock },
        { provide: NotificationsService, useValue: notificationsMock },
        { provide: DiscountsService, useValue: discountsMock },
        { provide: LoyaltyService, useValue: loyaltyMock },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);

    // Happy-path defaults; individual tests override what they need.
    prismaMock.service.findFirst.mockResolvedValue(serviceRow);
    prismaMock.staff.findFirst.mockResolvedValue(staffRow);
    prismaMock.clientSalonProfile.findUnique.mockResolvedValue(null);
    prismaMock.appointment.findFirst.mockResolvedValue(null);
    prismaMock.appointment.create.mockResolvedValue(createdAppointment);
    prismaMock.clientSalonProfile.upsert.mockResolvedValue({});
    // Default: no punch-card reward earned; loyalty tests override this.
    loyaltyMock.resolveEligibleReward.mockResolvedValue(null);
  });

  it('throws ForbiddenException when client is blocked by salon', async () => {
    // Arrange
    prismaMock.clientSalonProfile.findUnique.mockResolvedValue({
      salonId: dto.salonId,
      clientId: CLIENT_ID,
      isBlocked: true,
    });

    // Act + Assert
    await expect(service.create(CLIENT_ID, dto)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prismaMock.appointment.create).not.toHaveBeenCalled();
  });

  it('creates appointment and upserts client salon profile', async () => {
    // Act
    const result = await service.create(CLIENT_ID, dto);

    // Assert
    expect(result).toBe(createdAppointment);
    expect(prismaMock.clientSalonProfile.upsert).toHaveBeenCalledWith({
      where: {
        salonId_clientId: { salonId: dto.salonId, clientId: CLIENT_ID },
      },
      create: { salonId: dto.salonId, clientId: CLIENT_ID },
      update: {},
    });
  });

  it('does not fail booking when profile upsert fails', async () => {
    // Arrange
    prismaMock.clientSalonProfile.upsert.mockRejectedValue(
      new Error('db down'),
    );

    // Act
    const result = await service.create(CLIENT_ID, dto);

    // Assert
    expect(result).toBe(createdAppointment);
  });

  it('rejects booking when the staff member does not perform the service', async () => {
    // Arrange — staff is in the salon, but has no StaffService link.
    // ...Once: clearAllMocks keeps implementations, a plain mockResolvedValue
    // would leak the null into every later test in this suite.
    prismaMock.staffService.findUnique.mockResolvedValueOnce(null);

    // Act + Assert
    await expect(service.create(CLIENT_ID, dto)).rejects.toMatchObject({
      message: 'Staff member does not perform this service',
    });
    expect(prismaMock.appointment.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when staff does not belong to the salon', async () => {
    // Arrange
    prismaMock.staff.findFirst.mockResolvedValue(null);

    // Act + Assert
    await expect(service.create(CLIENT_ID, dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prismaMock.appointment.create).not.toHaveBeenCalled();
  });

  it('notifies the salon admin about the new booking', async () => {
    // Act
    await service.create(CLIENT_ID, dto);

    // Assert
    expect(notificationsMock.notify).toHaveBeenCalledWith(
      ADMIN_ID,
      expect.objectContaining({
        type: 'NEW_BOOKING',
        appointmentId: 'appt-1',
      }),
    );
  });

  it('does not fail booking when the admin notification fails', async () => {
    // Arrange
    notificationsMock.notify.mockRejectedValue(new Error('db down'));

    // Act
    const result = await service.create(CLIENT_ID, dto);

    // Assert
    expect(result).toBe(createdAppointment);
  });

  it('throws BadRequestException when startAt is in the past', async () => {
    // Arrange
    const pastDto = {
      ...dto,
      startAt: new Date(Date.now() - 3_600_000).toISOString(),
    };

    // Act + Assert
    await expect(service.create(CLIENT_ID, pastDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prismaMock.appointment.create).not.toHaveBeenCalled();
  });

  it('rejects an overlapping slot inside the transaction (TOCTOU guard)', async () => {
    // Arrange — overlap check (run with tx) finds a colliding appointment
    prismaMock.appointment.findFirst.mockResolvedValue({ id: 'other-appt' });

    // Act + Assert
    await expect(service.create(CLIENT_ID, dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(prismaMock.appointment.create).not.toHaveBeenCalled();
  });

  it('books without touching the discount services when no code is sent', async () => {
    // Act
    await service.create(CLIENT_ID, dto);

    // Assert
    expect(discountsMock.assertRedeemable).not.toHaveBeenCalled();
    expect(discountsMock.recordRedemption).not.toHaveBeenCalled();
    const data = prismaMock.appointment.create.mock.calls[0][0].data;
    expect(data.discountAmount).toBeUndefined();
  });

  it('applies a valid discount code: discountAmount set + redemption recorded in tx', async () => {
    // Arrange
    const validated = {
      codeId: 'code-1',
      code: 'VARA-2026',
      type: 'PERCENT',
      value: 20,
      maxRedemptions: 5,
      discountAmount: 20,
      finalPrice: 80,
    };
    discountsMock.assertRedeemable.mockResolvedValue(validated);

    // Act
    await service.create(CLIENT_ID, { ...dto, discountCode: 'vara-2026' });

    // Assert — validation re-ran with the tx client and the booking's context
    expect(discountsMock.assertRedeemable).toHaveBeenCalledWith(prismaMock, {
      salonId: dto.salonId,
      code: 'vara-2026',
      serviceId: dto.serviceId,
      clientId: CLIENT_ID,
    });
    const data = prismaMock.appointment.create.mock.calls[0][0].data;
    expect(data.discountAmount).toBe(20);
    expect(discountsMock.recordRedemption).toHaveBeenCalledWith(prismaMock, {
      validated,
      appointmentId: 'appt-1',
      clientId: CLIENT_ID,
    });
  });

  it('rejects the whole booking when the discount code is invalid', async () => {
    // Arrange
    discountsMock.assertRedeemable.mockRejectedValue(
      new BadRequestException('Codul de reducere a expirat.'),
    );

    // Act + Assert — booking NOT created, nothing redeemed
    await expect(
      service.create(CLIENT_ID, { ...dto, discountCode: 'EXPIRED-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.appointment.create).not.toHaveBeenCalled();
    expect(discountsMock.recordRedemption).not.toHaveBeenCalled();
  });

  it('rolls the booking back when the redemption cap re-check fails', async () => {
    // Arrange — validation passes, but the in-tx cap re-check throws
    discountsMock.assertRedeemable.mockResolvedValue({
      codeId: 'code-1',
      maxRedemptions: 5,
      discountAmount: 20,
    });
    discountsMock.recordRedemption.mockRejectedValue(
      new BadRequestException(
        'Codul de reducere a atins numărul maxim de utilizări.',
      ),
    );

    // Act + Assert — the error escapes the $transaction → full rollback
    await expect(
      service.create(CLIENT_ID, { ...dto, discountCode: 'VARA-2026' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // ─── Loyalty punch-card auto-redeem ──────────────────────────────────────────

  const punchReward = {
    salonId: dto.salonId,
    clientId: CLIENT_ID,
    amountApplied: 20,
  };

  it('auto-redeems an earned punch reward: discountAmount set + redemption in tx', async () => {
    // Arrange — client reached the visit threshold at this salon
    loyaltyMock.resolveEligibleReward.mockResolvedValue(punchReward);

    // Act
    await service.create(CLIENT_ID, dto);

    // Assert — eligibility resolved with the tx client from priceSnapshot
    expect(loyaltyMock.resolveEligibleReward).toHaveBeenCalledWith(prismaMock, {
      salonId: dto.salonId,
      clientId: CLIENT_ID,
      price: 100,
    });
    const data = prismaMock.appointment.create.mock.calls[0][0].data;
    expect(data.discountAmount).toBe(20);
    expect(loyaltyMock.recordRedemption).toHaveBeenCalledWith(prismaMock, {
      reward: punchReward,
      appointmentId: 'appt-1',
    });
  });

  it('never stacks the punch reward on a discount code (the code wins)', async () => {
    // Arrange — a valid code AND an earned punch reward
    discountsMock.assertRedeemable.mockResolvedValue({
      codeId: 'code-1',
      maxRedemptions: null,
      discountAmount: 30,
    });
    discountsMock.recordRedemption.mockResolvedValue(undefined);
    loyaltyMock.resolveEligibleReward.mockResolvedValue(punchReward);

    // Act
    await service.create(CLIENT_ID, { ...dto, discountCode: 'VARA-2026' });

    // Assert — loyalty never consulted, code amount applied
    expect(loyaltyMock.resolveEligibleReward).not.toHaveBeenCalled();
    expect(loyaltyMock.recordRedemption).not.toHaveBeenCalled();
    const data = prismaMock.appointment.create.mock.calls[0][0].data;
    expect(data.discountAmount).toBe(30);
  });

  it('does not redeem below the threshold (resolver returns null)', async () => {
    // Act — default mock resolves null
    await service.create(CLIENT_ID, dto);

    // Assert
    expect(loyaltyMock.resolveEligibleReward).toHaveBeenCalled();
    expect(loyaltyMock.recordRedemption).not.toHaveBeenCalled();
    const data = prismaMock.appointment.create.mock.calls[0][0].data;
    expect(data.discountAmount).toBeUndefined();
  });

  it('never redeems for guest walk-in bookings', async () => {
    // Act — salon books a walk-in guest (no registered client)
    await service.create(CLIENT_ID, {
      ...dto,
      source: 'WALK_IN',
      guestName: 'Maria',
      guestPhone: '+40711111111',
    });

    // Assert — loyalty path skipped entirely
    expect(loyaltyMock.resolveEligibleReward).not.toHaveBeenCalled();
    expect(loyaltyMock.recordRedemption).not.toHaveBeenCalled();
  });

  it('does not break the booking when the eligibility READ fails', async () => {
    // Arrange — loyalty lookup blows up inside the tx
    loyaltyMock.resolveEligibleReward.mockRejectedValue(new Error('db down'));

    // Act
    const result = await service.create(CLIENT_ID, dto);

    // Assert — booked without a reward
    expect(result).toBe(createdAppointment);
    expect(loyaltyMock.recordRedemption).not.toHaveBeenCalled();
  });

  it('rolls the booking back when the punch redemption WRITE fails', async () => {
    // Arrange — eligible, but the audit-trail insert fails (e.g. unique clash)
    loyaltyMock.resolveEligibleReward.mockResolvedValue(punchReward);
    loyaltyMock.recordRedemption.mockRejectedValue(new Error('unique clash'));

    // Act + Assert — the error escapes the $transaction → full rollback
    await expect(service.create(CLIENT_ID, dto)).rejects.toThrow(
      'unique clash',
    );
  });
});

describe('AppointmentsService — updateStatus time gating', () => {
  let service: AppointmentsService;

  const prismaMock = {
    appointment: { findUnique: jest.fn(), update: jest.fn() },
  };
  const slotLockMock = { releaseLock: jest.fn() };
  const notificationsMock = { notify: jest.fn() };

  const ADMIN_ID = 'admin-1';
  const CLIENT_ID = 'client-1';
  const APPT_ID = 'appt-1';

  const FUTURE = new Date(Date.now() + 2 * 3_600_000);
  const PAST = new Date(Date.now() - 2 * 3_600_000);

  const baseAppt = {
    id: APPT_ID,
    clientId: CLIENT_ID,
    status: 'CONFIRMED',
    salon: { adminId: ADMIN_ID },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SlotLockService, useValue: slotLockMock },
        { provide: NotificationsService, useValue: notificationsMock },
        { provide: DiscountsService, useValue: discountsMock },
        { provide: LoyaltyService, useValue: loyaltyMock },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);

    prismaMock.appointment.update.mockResolvedValue({
      id: APPT_ID,
      startAt: FUTURE,
      service: { name: 'Unghii cu gel' },
    });
  });

  it('rejects COMPLETED before the appointment start time', async () => {
    // Arrange
    prismaMock.appointment.findUnique.mockResolvedValue({
      ...baseAppt,
      startAt: FUTURE,
    });

    // Act + Assert
    await expect(
      service.updateStatus(APPT_ID, ADMIN_ID, { status: 'COMPLETED' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.appointment.update).not.toHaveBeenCalled();
  });

  it('rejects NO_SHOW before the appointment start time', async () => {
    // Arrange
    prismaMock.appointment.findUnique.mockResolvedValue({
      ...baseAppt,
      startAt: FUTURE,
    });

    // Act + Assert
    await expect(
      service.updateStatus(APPT_ID, ADMIN_ID, { status: 'NO_SHOW' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.appointment.update).not.toHaveBeenCalled();
  });

  it('allows COMPLETED after the appointment start time', async () => {
    // Arrange
    prismaMock.appointment.findUnique.mockResolvedValue({
      ...baseAppt,
      startAt: PAST,
    });

    // Act
    await service.updateStatus(APPT_ID, ADMIN_ID, {
      status: 'COMPLETED',
    } as any);

    // Assert
    expect(prismaMock.appointment.update).toHaveBeenCalled();
  });

  it('still allows CANCELLED before the appointment start time', async () => {
    // Arrange
    prismaMock.appointment.findUnique.mockResolvedValue({
      ...baseAppt,
      startAt: FUTURE,
    });

    // Act
    await service.updateStatus(APPT_ID, ADMIN_ID, {
      status: 'CANCELLED',
    } as any);

    // Assert
    expect(prismaMock.appointment.update).toHaveBeenCalled();
  });
});

describe('AppointmentsService — reschedule', () => {
  let service: AppointmentsService;

  const prismaMock = {
    appointment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    staff: { findFirst: jest.fn() },
    // Staff↔service link check (assertStaffInSalon): linked by default.
    staffService: { findUnique: jest.fn().mockResolvedValue({ staffId: 'staff-1', serviceId: 'svc-1' }) },
    $transaction: jest.fn((cb: any) => cb(prismaMock)),
  };
  const slotLockMock = { releaseLock: jest.fn() };
  const notificationsMock = { notify: jest.fn() };

  const ADMIN_ID = 'admin-1';
  const CLIENT_ID = 'client-1';
  const APPT_ID = 'appt-1';

  const NEW_START = new Date(Date.now() + 3 * 86_400_000);

  const baseAppt = {
    id: APPT_ID,
    clientId: CLIENT_ID,
    salonId: 'salon-1',
    staffId: 'staff-1',
    status: 'CONFIRMED',
    startAt: new Date(Date.now() + 86_400_000),
    salon: { adminId: ADMIN_ID },
    service: { durationMin: 60, name: 'Unghii cu gel' },
  };

  const dto = { startAt: NEW_START.toISOString() } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SlotLockService, useValue: slotLockMock },
        { provide: NotificationsService, useValue: notificationsMock },
        { provide: DiscountsService, useValue: discountsMock },
        { provide: LoyaltyService, useValue: loyaltyMock },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);

    prismaMock.appointment.findUnique.mockResolvedValue(baseAppt);
    prismaMock.appointment.findFirst.mockResolvedValue(null); // no overlap
    prismaMock.staff.findFirst.mockResolvedValue({
      id: 'staff-2',
      salonId: 'salon-1',
      isActive: true,
    });
    prismaMock.appointment.update.mockResolvedValue({
      id: APPT_ID,
      startAt: NEW_START,
      service: { name: 'Unghii cu gel' },
    });
  });

  it('lets the salon admin reschedule to a free slot', async () => {
    // Act
    await service.reschedule(APPT_ID, ADMIN_ID, dto);

    // Assert — endAt derived from service duration, same staff kept
    const updateArgs = prismaMock.appointment.update.mock.calls[0][0];
    expect(updateArgs.data.startAt).toEqual(NEW_START);
    expect(updateArgs.data.endAt).toEqual(
      new Date(NEW_START.getTime() + 60 * 60000),
    );
    expect(updateArgs.data.staffId).toBe('staff-1');
  });

  it('notifies the client with RESCHEDULED, including old → new time', async () => {
    // Act
    await service.reschedule(APPT_ID, ADMIN_ID, dto);

    // Assert
    expect(notificationsMock.notify).toHaveBeenCalledWith(
      CLIENT_ID,
      expect.objectContaining({
        type: 'RESCHEDULED',
        title: 'Programare mutată',
        appointmentId: APPT_ID,
        body: expect.stringMatching(/mutată de la .+ la .+/),
      }),
    );
  });

  it('forbids the client from rescheduling', async () => {
    // Act + Assert
    await expect(
      service.reschedule(APPT_ID, CLIENT_ID, dto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prismaMock.appointment.update).not.toHaveBeenCalled();
  });

  it('rejects when the new slot overlaps another appointment', async () => {
    // Arrange
    prismaMock.appointment.findFirst.mockResolvedValue({ id: 'other-appt' });

    // Act + Assert
    await expect(
      service.reschedule(APPT_ID, ADMIN_ID, dto),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prismaMock.appointment.update).not.toHaveBeenCalled();
  });

  it('rejects rescheduling a cancelled appointment', async () => {
    // Arrange
    prismaMock.appointment.findUnique.mockResolvedValue({
      ...baseAppt,
      status: 'CANCELLED',
    });

    // Act + Assert
    await expect(
      service.reschedule(APPT_ID, ADMIN_ID, dto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not fail rescheduling when the client notification fails', async () => {
    // Arrange
    notificationsMock.notify.mockRejectedValue(new Error('db down'));

    // Act + Assert
    await expect(service.reschedule(APPT_ID, ADMIN_ID, dto)).resolves.toEqual(
      expect.objectContaining({ id: APPT_ID }),
    );
  });
});

describe('AppointmentsService — staff scoping', () => {
  let service: AppointmentsService;

  const prismaMock = {
    salon: { findUnique: jest.fn() },
    staff: { findFirst: jest.fn() },
    // Staff↔service link check (assertStaffInSalon): linked by default.
    staffService: { findUnique: jest.fn().mockResolvedValue({ staffId: 'staff-1', serviceId: 'svc-1' }) },
    appointment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((cb: any) => cb(prismaMock)),
  };
  const slotLockMock = { releaseLock: jest.fn() };
  const notificationsMock = { notify: jest.fn() };

  const ADMIN_ID = 'admin-1';
  const STAFF_USER_ID = 'staff-user-1';
  const STAFF_ROW = { id: 'staff-1', salonId: 'salon-1', isActive: true };
  const FUTURE = new Date(Date.now() + 7 * 86_400_000);

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SlotLockService, useValue: slotLockMock },
        { provide: NotificationsService, useValue: notificationsMock },
        { provide: DiscountsService, useValue: discountsMock },
        { provide: LoyaltyService, useValue: loyaltyMock },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);

    prismaMock.salon.findUnique.mockResolvedValue({
      id: 'salon-1',
      adminId: ADMIN_ID,
    });
    prismaMock.staff.findFirst.mockResolvedValue(STAFF_ROW);
    prismaMock.appointment.findMany.mockResolvedValue([]);
  });

  it('findForSalon scopes staff callers to their own appointments', async () => {
    // Act
    await service.findForSalon('salon-1', STAFF_USER_ID);

    // Assert
    const where = prismaMock.appointment.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ salonId: 'salon-1', staffId: 'staff-1' });
  });

  it('findForSalon does not filter for the salon admin (regression)', async () => {
    // Act
    await service.findForSalon('salon-1', ADMIN_ID);

    // Assert
    const where = prismaMock.appointment.findMany.mock.calls[0][0].where;
    expect(where.staffId).toBeUndefined();
  });

  it('getAnalytics scopes staff callers to their own revenue', async () => {
    // Act
    await service.getAnalytics('salon-1', STAFF_USER_ID, { range: 'week' });

    // Assert
    const where = prismaMock.appointment.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ salonId: 'salon-1', staffId: 'staff-1' });
  });

  it('updateStatus lets assigned staff confirm their own appointment', async () => {
    // Arrange
    prismaMock.appointment.findUnique.mockResolvedValue({
      id: 'appt-1',
      status: 'PENDING',
      startAt: FUTURE,
      staffId: 'staff-1',
      clientId: 'client-1',
      salonId: 'salon-1',
      salon: { adminId: ADMIN_ID },
    });
    prismaMock.appointment.update.mockResolvedValue({
      id: 'appt-1',
      startAt: FUTURE,
      service: { name: 'Tuns' },
    });

    // Act
    await service.updateStatus('appt-1', STAFF_USER_ID, {
      status: 'CONFIRMED',
    } as any);

    // Assert
    expect(prismaMock.appointment.update).toHaveBeenCalled();
    expect(notificationsMock.notify).toHaveBeenCalledWith(
      'client-1',
      expect.objectContaining({ title: expect.any(String) }),
    );
  });

  it("updateStatus forbids staff from touching another staff's appointment", async () => {
    // Arrange
    prismaMock.appointment.findUnique.mockResolvedValue({
      id: 'appt-2',
      status: 'PENDING',
      startAt: FUTURE,
      staffId: 'other-staff',
      clientId: 'client-1',
      salonId: 'salon-1',
      salon: { adminId: ADMIN_ID },
    });

    // Act + Assert
    await expect(
      service.updateStatus('appt-2', STAFF_USER_ID, {
        status: 'CONFIRMED',
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prismaMock.appointment.update).not.toHaveBeenCalled();
  });

  it('reschedule lets assigned staff move their own appointment, not reassign it', async () => {
    // Arrange
    const appt = {
      id: 'appt-3',
      status: 'CONFIRMED',
      staffId: 'staff-1',
      clientId: 'client-1',
      salonId: 'salon-1',
      salon: { adminId: ADMIN_ID },
      service: { durationMin: 60, name: 'Tuns' },
    };
    prismaMock.appointment.findUnique.mockResolvedValue(appt);
    prismaMock.appointment.findFirst.mockResolvedValue(null); // no overlap
    prismaMock.appointment.update.mockResolvedValue({
      id: 'appt-3',
      startAt: FUTURE,
    });

    // Act — moving own appointment works
    await service.reschedule('appt-3', STAFF_USER_ID, {
      startAt: FUTURE.toISOString(),
    } as any);
    expect(prismaMock.appointment.update).toHaveBeenCalled();

    // Act + Assert — handing it to another staff member is forbidden
    await expect(
      service.reschedule('appt-3', STAFF_USER_ID, {
        startAt: FUTURE.toISOString(),
        staffId: 'other-staff',
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('salonDayWindow', () => {
  it('resolves the day window with the Romanian summer offset (UTC+3)', () => {
    // Act
    const { start, end } = salonDayWindow('2026-07-15');

    // Assert
    expect(start.toISOString()).toBe('2026-07-14T21:00:00.000Z');
    expect(end.toISOString()).toBe('2026-07-15T21:00:00.000Z');
  });

  it('resolves the day window with the Romanian winter offset (UTC+2)', () => {
    // Act
    const { start } = salonDayWindow('2026-01-15');

    // Assert
    expect(start.toISOString()).toBe('2026-01-14T22:00:00.000Z');
  });
});

describe('AppointmentsService — client internalNotes guard', () => {
  let service: AppointmentsService;

  const prismaMock = {
    appointment: { findUnique: jest.fn(), update: jest.fn() },
  };
  const slotLockMock = { releaseLock: jest.fn() };
  const notificationsMock = { notify: jest.fn() };

  const CLIENT_ID = 'client-1';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SlotLockService, useValue: slotLockMock },
        { provide: NotificationsService, useValue: notificationsMock },
        { provide: DiscountsService, useValue: discountsMock },
        { provide: LoyaltyService, useValue: loyaltyMock },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);

    prismaMock.appointment.findUnique.mockResolvedValue({
      id: 'appt-1',
      clientId: CLIENT_ID,
      status: 'CONFIRMED',
      startAt: new Date(Date.now() + 3_600_000),
      salon: { adminId: 'admin-1' },
    });
  });

  it('forbids clients from writing internal notes', async () => {
    // Act + Assert
    await expect(
      service.updateStatus('appt-1', CLIENT_ID, {
        internalNotes: 'hacked',
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prismaMock.appointment.update).not.toHaveBeenCalled();
  });

  it('still allows the salon admin to write internal notes', async () => {
    // Arrange
    prismaMock.appointment.update.mockResolvedValue({ id: 'appt-1' });

    // Act
    await service.updateStatus('appt-1', 'admin-1', {
      internalNotes: 'client prefers window seat',
    } as any);

    // Assert
    expect(prismaMock.appointment.update).toHaveBeenCalled();
  });
});

describe('AppointmentsService — status-change notifications', () => {
  let service: AppointmentsService;

  const prismaMock = {
    appointment: { findUnique: jest.fn(), update: jest.fn() },
  };
  const slotLockMock = { releaseLock: jest.fn() };
  const notificationsMock = { notify: jest.fn() };

  const ADMIN_ID = 'admin-1';
  const CLIENT_ID = 'client-1';
  const APPT_ID = 'appt-1';

  const FUTURE = new Date(Date.now() + 2 * 3_600_000);
  const PAST = new Date(Date.now() - 2 * 3_600_000);

  const apptWith = (status: string, startAt: Date) => ({
    id: APPT_ID,
    clientId: CLIENT_ID,
    status,
    startAt,
    salon: { adminId: ADMIN_ID },
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SlotLockService, useValue: slotLockMock },
        { provide: NotificationsService, useValue: notificationsMock },
        { provide: DiscountsService, useValue: discountsMock },
        { provide: LoyaltyService, useValue: loyaltyMock },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);

    prismaMock.appointment.update.mockResolvedValue({
      id: APPT_ID,
      startAt: FUTURE,
      service: { name: 'Unghii cu gel' },
    });
  });

  it('sends BOOKING_ACCEPTED to the client when the salon confirms', async () => {
    // Arrange
    prismaMock.appointment.findUnique.mockResolvedValue(
      apptWith('PENDING', FUTURE),
    );

    // Act
    await service.updateStatus(APPT_ID, ADMIN_ID, {
      status: 'CONFIRMED',
    } as any);

    // Assert
    expect(notificationsMock.notify).toHaveBeenCalledWith(
      CLIENT_ID,
      expect.objectContaining({
        type: 'BOOKING_ACCEPTED',
        title: 'Programare acceptată',
        appointmentId: APPT_ID,
      }),
    );
  });

  it('sends BOOKING_REJECTED to the client when the salon rejects', async () => {
    // Arrange
    prismaMock.appointment.findUnique.mockResolvedValue(
      apptWith('PENDING', FUTURE),
    );

    // Act
    await service.updateStatus(APPT_ID, ADMIN_ID, {
      status: 'REJECTED',
    } as any);

    // Assert
    expect(notificationsMock.notify).toHaveBeenCalledWith(
      CLIENT_ID,
      expect.objectContaining({
        type: 'BOOKING_REJECTED',
        title: 'Programare respinsă',
        appointmentId: APPT_ID,
      }),
    );
  });

  it('forbids the client from rejecting their own appointment', async () => {
    // Arrange
    prismaMock.appointment.findUnique.mockResolvedValue(
      apptWith('PENDING', FUTURE),
    );

    // Act + Assert
    await expect(
      service.updateStatus(APPT_ID, CLIENT_ID, { status: 'REJECTED' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prismaMock.appointment.update).not.toHaveBeenCalled();
  });

  it('rejects REJECTED from a non-PENDING status (terminal transitions)', async () => {
    // Arrange
    prismaMock.appointment.findUnique.mockResolvedValue(
      apptWith('CONFIRMED', FUTURE),
    );

    // Act + Assert
    await expect(
      service.updateStatus(APPT_ID, ADMIN_ID, { status: 'REJECTED' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sends CANCELLATION to the client on salon cancellation', async () => {
    // Arrange
    prismaMock.appointment.findUnique.mockResolvedValue(
      apptWith('CONFIRMED', FUTURE),
    );

    // Act
    await service.updateStatus(APPT_ID, ADMIN_ID, {
      status: 'CANCELLED',
    } as any);

    // Assert
    expect(notificationsMock.notify).toHaveBeenCalledWith(
      CLIENT_ID,
      expect.objectContaining({ type: 'CANCELLATION', appointmentId: APPT_ID }),
    );
  });

  it('sends CANCELLATION to the salon admin on client cancellation', async () => {
    // Arrange
    prismaMock.appointment.findUnique.mockResolvedValue(
      apptWith('CONFIRMED', FUTURE),
    );

    // Act
    await service.updateStatus(APPT_ID, CLIENT_ID, {
      status: 'CANCELLED',
    } as any);

    // Assert
    expect(notificationsMock.notify).toHaveBeenCalledWith(
      ADMIN_ID,
      expect.objectContaining({ type: 'CANCELLATION', appointmentId: APPT_ID }),
    );
  });

  it('sends NO_SHOW to the client when marked after start', async () => {
    // Arrange
    prismaMock.appointment.findUnique.mockResolvedValue(
      apptWith('CONFIRMED', PAST),
    );

    // Act
    await service.updateStatus(APPT_ID, ADMIN_ID, { status: 'NO_SHOW' } as any);

    // Assert
    expect(notificationsMock.notify).toHaveBeenCalledWith(
      CLIENT_ID,
      expect.objectContaining({ type: 'NO_SHOW', appointmentId: APPT_ID }),
    );
  });

  it('does not fail the status update when the notification fails', async () => {
    // Arrange
    prismaMock.appointment.findUnique.mockResolvedValue(
      apptWith('PENDING', FUTURE),
    );
    notificationsMock.notify.mockRejectedValue(new Error('db down'));

    // Act + Assert
    await expect(
      service.updateStatus(APPT_ID, ADMIN_ID, { status: 'CONFIRMED' } as any),
    ).resolves.toEqual(expect.objectContaining({ id: APPT_ID }));
  });
});
