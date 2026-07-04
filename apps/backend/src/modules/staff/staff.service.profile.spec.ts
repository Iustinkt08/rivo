import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { StaffService } from './staff.service';
import { PrismaService } from '../../prisma/prisma.service';

// Auth matrix + field whitelist for the self-service profile endpoint, and
// server-side visibility filtering of the public professional profile.

const SALON_ID = 'salon-1';
const STAFF_ID = 'staff-1';
const OWNER_ID = 'owner-1';
const STAFF_USER_ID = 'staff-user-9';

const ownerUser = { id: OWNER_ID, role: 'ADMIN_SALON' } as any;
const staffUser = { id: STAFF_USER_ID, role: 'STAFF_MEMBER' } as any;
const otherStaffUser = { id: 'someone-else', role: 'STAFF_MEMBER' } as any;
const foreignOwner = { id: 'other-owner', role: 'ADMIN_SALON' } as any;

describe('StaffService — updateOwnProfile (auth matrix + whitelist)', () => {
  let service: StaffService;

  const prismaMock = {
    salon: { findUnique: jest.fn() },
    staff: { findFirst: jest.fn(), update: jest.fn() },
  };

  const staffRow = {
    id: STAFF_ID,
    salonId: SALON_ID,
    userId: STAFF_USER_ID,
    firstName: 'Ana',
    lastName: 'Pop',
    publicSettings: null,
    passwordHash: 'bcrypt-hash',
    username: 'ana.pop',
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

    prismaMock.staff.findFirst.mockResolvedValue({ ...staffRow });
    prismaMock.salon.findUnique.mockResolvedValue({
      id: SALON_ID,
      adminId: OWNER_ID,
    });
    prismaMock.staff.update.mockResolvedValue({
      ...staffRow,
      firstName: 'Ana-Maria',
    });
  });

  it('allows the staff member to edit their own profile', async () => {
    // Act
    const result = await service.updateOwnProfile(
      SALON_ID,
      STAFF_ID,
      staffUser,
      {
        firstName: 'Ana-Maria',
      },
    );

    // Assert
    expect(prismaMock.staff.update).toHaveBeenCalledWith({
      where: { id: STAFF_ID },
      data: { firstName: 'Ana-Maria' },
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('allows the salon owner to edit a staff profile', async () => {
    // Act
    await service.updateOwnProfile(SALON_ID, STAFF_ID, ownerUser, {
      bio: 'New bio',
    });

    // Assert
    expect(prismaMock.staff.update).toHaveBeenCalledWith({
      where: { id: STAFF_ID },
      data: { bio: 'New bio' },
    });
  });

  it('rejects an ADMIN_SALON who does not own the salon', async () => {
    await expect(
      service.updateOwnProfile(SALON_ID, STAFF_ID, foreignOwner, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prismaMock.staff.update).not.toHaveBeenCalled();
  });

  it('rejects a staff user who is not linked to this staff row', async () => {
    await expect(
      service.updateOwnProfile(SALON_ID, STAFF_ID, otherStaffUser, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prismaMock.staff.update).not.toHaveBeenCalled();
  });

  it('404s when the staff member does not belong to the salon', async () => {
    // Arrange
    prismaMock.staff.findFirst.mockResolvedValue(null);

    // Act + Assert
    await expect(
      service.updateOwnProfile(SALON_ID, STAFF_ID, staffUser, {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('whitelists fields: credentials and account state can never be set', async () => {
    // Arrange — a hostile body that slipped past DTO validation somehow.
    const hostileDto = {
      firstName: 'Ana',
      passwordHash: 'evil-hash',
      username: 'stolen',
      isActive: false,
      salonId: 'other-salon',
      userId: 'attacker',
    } as any;

    // Act
    await service.updateOwnProfile(SALON_ID, STAFF_ID, staffUser, hostileDto);

    // Assert
    const data = prismaMock.staff.update.mock.calls[0][0].data;
    expect(data).toEqual({ firstName: 'Ana' });
    expect(data).not.toHaveProperty('passwordHash');
    expect(data).not.toHaveProperty('username');
    expect(data).not.toHaveProperty('isActive');
    expect(data).not.toHaveProperty('salonId');
  });

  it('normalizes social handles to full https:// URLs', async () => {
    // Act
    await service.updateOwnProfile(SALON_ID, STAFF_ID, staffUser, {
      socials: {
        instagram: '@ana.pop',
        tiktok: 'ana_pop',
        website: 'example.com',
        facebook: 'https://facebook.com/ana.pop',
      },
    });

    // Assert
    expect(prismaMock.staff.update.mock.calls[0][0].data.socials).toEqual({
      instagram: 'https://instagram.com/ana.pop',
      tiktok: 'https://www.tiktok.com/@ana_pop',
      website: 'https://example.com',
      facebook: 'https://facebook.com/ana.pop',
    });
  });

  it('merges publicSettings over the stored value instead of replacing it', async () => {
    // Arrange
    prismaMock.staff.findFirst.mockResolvedValue({
      ...staffRow,
      publicSettings: { showContact: true, showSocials: true },
    });

    // Act
    await service.updateOwnProfile(SALON_ID, STAFF_ID, staffUser, {
      publicSettings: { showGallery: false },
    });

    // Assert
    expect(
      prismaMock.staff.update.mock.calls[0][0].data.publicSettings,
    ).toEqual({ showContact: true, showSocials: true, showGallery: false });
  });

  it('clears optional text fields when empty strings are sent', async () => {
    // Act
    await service.updateOwnProfile(SALON_ID, STAFF_ID, staffUser, {
      bio: '',
      phone: '  ',
      email: '',
      specialty: '',
    });

    // Assert
    expect(prismaMock.staff.update.mock.calls[0][0].data).toEqual({
      bio: null,
      phone: null,
      email: null,
      specialty: null,
    });
  });

  it('getOwnProfile enforces the same authorization and strips the hash', async () => {
    // Act
    const own = await service.getOwnProfile(SALON_ID, STAFF_ID, staffUser);

    // Assert
    expect(own).toMatchObject({ id: STAFF_ID, username: 'ana.pop' });
    expect(own).not.toHaveProperty('passwordHash');
    await expect(
      service.getOwnProfile(SALON_ID, STAFF_ID, otherStaffUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('StaffService — findProfessionalProfile visibility rules', () => {
  let service: StaffService;

  const prismaMock = {
    staff: { findFirst: jest.fn() },
    review: { findMany: jest.fn(), aggregate: jest.fn() },
    appointment: { count: jest.fn() },
    staffPhotoCategory: { findMany: jest.fn() },
  };

  const baseStaffRow = {
    id: STAFF_ID,
    firstName: 'Ana',
    lastName: 'Pop',
    specialty: 'Hairstylist',
    avatarEmoji: '💇',
    avatarUrl: null,
    bio: 'Bio',
    phone: '0700000000',
    email: 'ana@example.com',
    socials: { instagram: '@ana' },
    publicSettings: null as unknown,
    salon: { id: SALON_ID, name: 'Salon', slug: 'salon', city: 'Cluj' },
    staffServices: [],
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

    prismaMock.staff.findFirst.mockResolvedValue({ ...baseStaffRow });
    prismaMock.review.aggregate.mockResolvedValue({
      _avg: { rating: 5 },
      _count: 1,
    });
    prismaMock.review.findMany.mockResolvedValue([]);
    prismaMock.appointment.count.mockResolvedValue(12);
    prismaMock.staffPhotoCategory.findMany.mockResolvedValue([
      {
        id: 'cat-1',
        name: 'Balayage',
        sortOrder: 0,
        photos: [{ id: 'photo-1', url: 'https://cdn/x.jpg', caption: null }],
      },
    ]);
  });

  it('defaults (null publicSettings): socials + gallery shown, contact + count hidden', async () => {
    // Act
    const profile = await service.findProfessionalProfile(STAFF_ID);

    // Assert
    expect(profile).toMatchObject({
      socials: { instagram: 'https://instagram.com/ana' },
      galleryCategories: [
        expect.objectContaining({
          id: 'cat-1',
          name: 'Balayage',
          photos: [{ id: 'photo-1', url: 'https://cdn/x.jpg', caption: null }],
        }),
      ],
    });
    expect(profile).not.toHaveProperty('phone');
    expect(profile).not.toHaveProperty('email');
    expect(profile).not.toHaveProperty('completedAppointmentsCount');
    expect(prismaMock.appointment.count).not.toHaveBeenCalled();
  });

  it('showContact exposes phone and email', async () => {
    // Arrange
    prismaMock.staff.findFirst.mockResolvedValue({
      ...baseStaffRow,
      publicSettings: { showContact: true },
    });

    // Act
    const profile = await service.findProfessionalProfile(STAFF_ID);

    // Assert
    expect(profile).toMatchObject({
      phone: '0700000000',
      email: 'ana@example.com',
    });
  });

  it('showApptCount exposes only COMPLETED appointment count', async () => {
    // Arrange
    prismaMock.staff.findFirst.mockResolvedValue({
      ...baseStaffRow,
      publicSettings: { showApptCount: true },
    });

    // Act
    const profile = await service.findProfessionalProfile(STAFF_ID);

    // Assert
    expect(prismaMock.appointment.count).toHaveBeenCalledWith({
      where: { staffId: STAFF_ID, status: 'COMPLETED' },
    });
    expect(profile).toMatchObject({ completedAppointmentsCount: 12 });
  });

  it('showGallery=false omits galleryCategories and skips the query', async () => {
    // Arrange
    prismaMock.staff.findFirst.mockResolvedValue({
      ...baseStaffRow,
      publicSettings: { showGallery: false },
    });

    // Act
    const profile = await service.findProfessionalProfile(STAFF_ID);

    // Assert
    expect(profile).not.toHaveProperty('galleryCategories');
    expect(prismaMock.staffPhotoCategory.findMany).not.toHaveBeenCalled();
  });

  it('showSocials=false omits socials entirely', async () => {
    // Arrange
    prismaMock.staff.findFirst.mockResolvedValue({
      ...baseStaffRow,
      publicSettings: { showSocials: false },
    });

    // Act
    const profile = await service.findProfessionalProfile(STAFF_ID);

    // Assert
    expect(profile).not.toHaveProperty('socials');
  });

  it('omits socials when shown but empty', async () => {
    // Arrange
    prismaMock.staff.findFirst.mockResolvedValue({
      ...baseStaffRow,
      socials: null,
    });

    // Act
    const profile = await service.findProfessionalProfile(STAFF_ID);

    // Assert
    expect(profile).not.toHaveProperty('socials');
  });
});
