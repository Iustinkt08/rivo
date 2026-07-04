import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('StaffService — create', () => {
  let service: StaffService;

  const prismaMock = {
    salon: { findUnique: jest.fn() },
    service: { findMany: jest.fn() },
    staff: { create: jest.fn() },
  };

  const SALON_ID = 'salon-1';
  const OWNER_ID = 'owner-1';
  const dto = { firstName: 'Ana', lastName: 'Pop' } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<StaffService>(StaffService);

    prismaMock.salon.findUnique.mockResolvedValue({
      id: SALON_ID,
      adminId: OWNER_ID,
    });
    prismaMock.service.findMany.mockResolvedValue([
      { id: 'svc-1' },
      { id: 'svc-2' },
    ]);
    prismaMock.staff.create.mockResolvedValue({ id: 'staff-1' });
  });

  it('seeds a default 7-day work schedule so new staff are bookable', async () => {
    // Act
    await service.create(SALON_ID, OWNER_ID, dto);

    // Assert
    const data = prismaMock.staff.create.mock.calls[0][0].data;
    const schedules = data.workSchedules.create;
    expect(schedules).toHaveLength(7);
    const sunday = schedules.find((s: any) => s.dayOfWeek === 'SUNDAY');
    expect(sunday.isOff).toBe(true);
    const monday = schedules.find((s: any) => s.dayOfWeek === 'MONDAY');
    expect(monday).toMatchObject({
      startTime: '09:00',
      endTime: '18:00',
      isOff: false,
    });
  });

  it('links all active salon services when serviceIds is omitted', async () => {
    // Act
    await service.create(SALON_ID, OWNER_ID, dto);

    // Assert
    expect(prismaMock.service.findMany).toHaveBeenCalledWith({
      where: { salonId: SALON_ID, isActive: true },
      select: { id: true },
    });
    const data = prismaMock.staff.create.mock.calls[0][0].data;
    expect(data.staffServices.create).toEqual([
      { serviceId: 'svc-1' },
      { serviceId: 'svc-2' },
    ]);
  });

  it('links only the provided serviceIds when given', async () => {
    // Act
    await service.create(SALON_ID, OWNER_ID, {
      ...dto,
      serviceIds: ['svc-9'],
    });

    // Assert
    expect(prismaMock.service.findMany).not.toHaveBeenCalled();
    const data = prismaMock.staff.create.mock.calls[0][0].data;
    expect(data.staffServices.create).toEqual([{ serviceId: 'svc-9' }]);
  });
});

describe('StaffService — findProfessionalProfile', () => {
  let service: StaffService;

  const prismaMock = {
    staff: { findFirst: jest.fn() },
    review: { findMany: jest.fn(), aggregate: jest.fn() },
    appointment: { count: jest.fn() },
    staffPhotoCategory: { findMany: jest.fn() },
  };

  const STAFF_ID = 'staff-1';

  const staffRow = {
    id: STAFF_ID,
    firstName: 'Ana',
    lastName: 'Pop',
    specialty: 'Hairstylist',
    avatarEmoji: '💇',
    avatarUrl: null,
    bio: 'Bio',
    phone: '0700000000',
    email: 'ana@example.com',
    socials: null,
    publicSettings: null,
    salon: { id: 'salon-1', name: 'Salon', slug: 'salon', city: 'Cluj' },
    staffServices: [
      {
        service: { id: 'svc-1', name: 'Tuns', price: 80, durationMin: 45 },
      },
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<StaffService>(StaffService);

    prismaMock.staff.findFirst.mockResolvedValue(staffRow);
    prismaMock.review.aggregate.mockResolvedValue({
      _avg: { rating: 4.5 },
      _count: 2,
    });
    prismaMock.appointment.count.mockResolvedValue(7);
    prismaMock.staffPhotoCategory.findMany.mockResolvedValue([]);
    prismaMock.review.findMany.mockResolvedValue([
      {
        id: 'rev-1',
        rating: 5,
        comment: 'Super',
        createdAt: new Date('2026-06-01T10:00:00Z'),
        client: { firstName: 'Maria', lastName: 'Ionescu' },
      },
    ]);
  });

  it('returns the public profile with services, aggregates and reviews', async () => {
    // Act
    const profile = await service.findProfessionalProfile(STAFF_ID);

    // Assert
    expect(profile).toMatchObject({
      id: STAFF_ID,
      fullName: 'Ana Pop',
      specialty: 'Hairstylist',
      salon: { id: 'salon-1', city: 'Cluj' },
      services: [{ id: 'svc-1', name: 'Tuns', price: 80, durationMin: 45 }],
      averageRating: 4.5,
      reviewCount: 2,
    });
    expect(profile.reviews).toEqual([
      expect.objectContaining({
        id: 'rev-1',
        rating: 5,
        clientName: 'Maria I.',
      }),
    ]);
  });

  it('filters reviews through the appointment→staff relation (Review has no staffId)', async () => {
    // Act
    await service.findProfessionalProfile(STAFF_ID);

    // Assert
    expect(prismaMock.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isVisible: true,
          appointment: { staffId: STAFF_ID },
        }),
      }),
    );
  });

  it('throws NotFoundException for a missing or inactive professional', async () => {
    // Arrange
    prismaMock.staff.findFirst.mockResolvedValue(null);

    // Act + Assert
    await expect(
      service.findProfessionalProfile('nope'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('StaffService — searchProfessionals', () => {
  let service: StaffService;

  const prismaMock = {
    staff: { findMany: jest.fn() },
    appointment: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<StaffService>(StaffService);

    prismaMock.staff.findMany.mockResolvedValue([
      {
        id: 'staff-1',
        firstName: 'Ana',
        lastName: 'Pop',
        specialty: 'Hairstylist',
        avatarEmoji: '💇',
        avatarUrl: null,
        salon: { id: 'salon-1', name: 'Salon', slug: 'salon' },
        _count: { appointments: 7 },
      },
    ]);
    prismaMock.appointment.findMany.mockResolvedValue([
      { staffId: 'staff-1', review: { rating: 5 } },
      { staffId: 'staff-1', review: { rating: 4 } },
    ]);
  });

  it('searches by name/specialty and computes per-staff rating aggregates', async () => {
    // Act
    const results = await service.searchProfessionals('ana', 20);

    // Assert
    expect(prismaMock.staff.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          OR: expect.arrayContaining([
            { firstName: { contains: 'ana', mode: 'insensitive' } },
          ]),
        }),
        take: 20,
      }),
    );
    expect(results).toEqual([
      expect.objectContaining({
        id: 'staff-1',
        fullName: 'Ana Pop',
        averageRating: 4.5,
        reviewCount: 2,
        appointmentCount: 7,
      }),
    ]);
  });

  it('returns staff with zero rating when they have no reviews', async () => {
    // Arrange
    prismaMock.appointment.findMany.mockResolvedValue([]);

    // Act
    const results = await service.searchProfessionals(undefined, 10);

    // Assert
    expect(results[0]).toMatchObject({ averageRating: 0, reviewCount: 0 });
  });
});

describe('StaffService — login credentials', () => {
  let service: StaffService;

  const txMock = {
    user: { create: jest.fn() },
    staff: { update: jest.fn() },
  };
  const prismaMock = {
    salon: { findUnique: jest.fn() },
    staff: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(async (fn: any) => fn(txMock)),
  };

  const OWNER_ID = 'owner-1';
  const SALON_ID = 'salon-1';
  const STAFF_ROW = {
    id: 'staff-1',
    salonId: SALON_ID,
    firstName: 'Ana',
    lastName: 'Pop',
    username: null,
    passwordHash: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<StaffService>(StaffService);

    prismaMock.salon.findUnique.mockResolvedValue({
      id: SALON_ID,
      adminId: OWNER_ID,
    });
    prismaMock.staff.findFirst.mockResolvedValue({ ...STAFF_ROW });
    prismaMock.staff.findUnique.mockResolvedValue(null); // username free
    txMock.user.create.mockResolvedValue({ id: 'new-user-1' });
    txMock.staff.update.mockResolvedValue({});
  });

  it('creates credentials: STAFF_MEMBER user linked, hash stored, password returned once', async () => {
    // Act
    const result = await service.createCredentials(
      SALON_ID,
      'staff-1',
      OWNER_ID,
      { username: 'Ana.Pop' },
    );

    // Assert
    expect(result.username).toBe('ana.pop'); // normalized
    expect(result.password).toHaveLength(12);
    expect(txMock.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: 'STAFF_MEMBER',
        email: 'ana.pop@staff.navira.local',
      }),
    });
    const update = txMock.staff.update.mock.calls[0][0];
    expect(update.data.username).toBe('ana.pop');
    expect(update.data.passwordHash).toEqual(expect.any(String));
    expect(update.data.passwordHash).not.toBe(result.password);
  });

  it('rejects a non-owner caller', async () => {
    await expect(
      service.createCredentials(SALON_ID, 'staff-1', 'intruder', {
        username: 'x.y.z',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a taken username with 409', async () => {
    // Arrange
    prismaMock.staff.findUnique.mockResolvedValue({ id: 'other' });

    // Act + Assert
    await expect(
      service.createCredentials(SALON_ID, 'staff-1', OWNER_ID, {
        username: 'ana.pop',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects creating credentials twice', async () => {
    // Arrange
    prismaMock.staff.findFirst.mockResolvedValue({
      ...STAFF_ROW,
      username: 'ana.pop',
    });

    // Act + Assert
    await expect(
      service.createCredentials(SALON_ID, 'staff-1', OWNER_ID, {
        username: 'alt.nume',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('resets the password for existing credentials and returns it once', async () => {
    // Arrange
    prismaMock.staff.findFirst.mockResolvedValue({
      ...STAFF_ROW,
      username: 'ana.pop',
    });
    prismaMock.staff.update.mockResolvedValue({});

    // Act
    const result = await service.resetCredentials(
      SALON_ID,
      'staff-1',
      OWNER_ID,
      {},
    );

    // Assert
    expect(result.username).toBe('ana.pop');
    expect(result.password).toHaveLength(12);
    expect(prismaMock.staff.update.mock.calls[0][0].data.passwordHash).toEqual(
      expect.any(String),
    );
  });

  it('never exposes passwordHash from findAll', async () => {
    // Arrange
    prismaMock.staff.findMany.mockResolvedValue([
      {
        ...STAFF_ROW,
        passwordHash: 'hash',
        staffServices: [],
        workSchedules: [],
      },
    ]);

    // Act
    const result = await service.findAll(SALON_ID);

    // Assert
    expect(result[0]).not.toHaveProperty('passwordHash');
  });
});

describe('StaffService — public shaping & removal', () => {
  let service: StaffService;

  const prismaMock = {
    salon: { findUnique: jest.fn() },
    staff: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    user: { update: jest.fn() },
  };

  const SALON_ID = 'salon-1';
  const OWNER_ID = 'owner-1';

  const fullStaffRow = {
    id: 'staff-1',
    salonId: SALON_ID,
    firstName: 'Ana',
    lastName: 'Pop',
    username: 'ana.pop',
    passwordHash: 'bcrypt-hash',
    userId: 'user-9',
    phone: '0700000000',
    isActive: true,
    staffServices: [],
    workSchedules: [],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<StaffService>(StaffService);

    prismaMock.salon.findUnique.mockResolvedValue({
      id: SALON_ID,
      adminId: OWNER_ID,
    });
    prismaMock.staff.findMany.mockResolvedValue([fullStaffRow]);
    prismaMock.staff.update.mockResolvedValue({});
    prismaMock.user.update.mockResolvedValue({});
  });

  it('public findAll hides login identifiers and account linkage', async () => {
    // Act
    const [row] = await service.findAll(SALON_ID);

    // Assert
    expect(row).not.toHaveProperty('username');
    expect(row).not.toHaveProperty('passwordHash');
    expect(row).not.toHaveProperty('userId');
    expect(row).not.toHaveProperty('phone');
    expect(row).toMatchObject({ id: 'staff-1', firstName: 'Ana' });
  });

  it('owner listing keeps username but never the password hash', async () => {
    // Act
    const [row] = await service.findAllForOwner(SALON_ID, OWNER_ID);

    // Assert
    expect(row).toMatchObject({ username: 'ana.pop' });
    expect(row).not.toHaveProperty('passwordHash');
  });

  it('owner listing rejects non-owners', async () => {
    // Act + Assert
    await expect(
      service.findAllForOwner(SALON_ID, 'someone-else'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('removing staff also deactivates their linked login account', async () => {
    // Arrange
    prismaMock.staff.findFirst.mockResolvedValue(fullStaffRow);

    // Act
    await service.remove(SALON_ID, 'staff-1', OWNER_ID);

    // Assert
    expect(prismaMock.staff.update).toHaveBeenCalledWith({
      where: { id: 'staff-1' },
      data: { isActive: false },
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-9' },
      data: { isActive: false },
    });
  });

  it('removing staff without a login account touches no user row', async () => {
    // Arrange
    prismaMock.staff.findFirst.mockResolvedValue({
      ...fullStaffRow,
      userId: null,
    });

    // Act
    await service.remove(SALON_ID, 'staff-1', OWNER_ID);

    // Assert
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
