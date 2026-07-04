import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  StaffGalleryService,
  UploadedPhotoFile,
} from './staff-gallery.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const SALON_ID = 'salon-1';
const STAFF_ID = 'staff-1';
const PHOTO_URL =
  'https://x.supabase.co/storage/v1/object/public/staff-gallery/staff-1/a.jpg';

const STAFF_ROW = { id: STAFF_ID, salonId: SALON_ID, userId: 'user-9' };
const SALON_ROW = { id: SALON_ID, adminId: 'owner-1' };

const staffSelfUser = { id: 'user-9', role: 'STAFF_MEMBER' } as any;
const otherStaffUser = { id: 'user-intruder', role: 'STAFF_MEMBER' } as any;
const ownerUser = { id: 'owner-1', role: 'ADMIN_SALON' } as any;
const otherOwnerUser = { id: 'owner-other', role: 'ADMIN_SALON' } as any;

const file: UploadedPhotoFile = {
  buffer: Buffer.from('img'),
  mimetype: 'image/jpeg',
  size: 3,
  originalname: 'a.jpg',
};

function buildMocks() {
  const prismaMock = {
    staff: { findFirst: jest.fn() },
    salon: { findUnique: jest.fn() },
    staffPhoto: { create: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
    staffPhotoCategory: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
  };
  const storageMock = {
    uploadStaffPhoto: jest.fn(),
    deleteObjectByUrl: jest.fn(),
  };
  return { prismaMock, storageMock };
}

async function buildService(mocks: ReturnType<typeof buildMocks>) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      StaffGalleryService,
      { provide: PrismaService, useValue: mocks.prismaMock },
      { provide: StorageService, useValue: mocks.storageMock },
    ],
  }).compile();
  return module.get<StaffGalleryService>(StaffGalleryService);
}

describe('StaffGalleryService — authorization matrix', () => {
  let service: StaffGalleryService;
  let mocks: ReturnType<typeof buildMocks>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mocks = buildMocks();
    service = await buildService(mocks);

    mocks.prismaMock.staff.findFirst.mockResolvedValue({ ...STAFF_ROW });
    mocks.prismaMock.salon.findUnique.mockResolvedValue({ ...SALON_ROW });
    mocks.storageMock.uploadStaffPhoto.mockResolvedValue(PHOTO_URL);
    mocks.prismaMock.staffPhoto.create.mockResolvedValue({ id: 'photo-1' });
  });

  it('allows the staff member themselves (staff.userId === user.id)', async () => {
    await expect(
      service.uploadPhoto(SALON_ID, STAFF_ID, staffSelfUser, file, {}),
    ).resolves.toEqual({ id: 'photo-1' });
  });

  it('forbids another staff member of the same salon', async () => {
    await expect(
      service.uploadPhoto(SALON_ID, STAFF_ID, otherStaffUser, file, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(mocks.storageMock.uploadStaffPhoto).not.toHaveBeenCalled();
  });

  it('allows the ADMIN_SALON who owns the salon', async () => {
    await expect(
      service.uploadPhoto(SALON_ID, STAFF_ID, ownerUser, file, {}),
    ).resolves.toEqual({ id: 'photo-1' });
  });

  it('forbids an ADMIN_SALON who owns a different salon', async () => {
    await expect(
      service.uploadPhoto(SALON_ID, STAFF_ID, otherOwnerUser, file, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(mocks.storageMock.uploadStaffPhoto).not.toHaveBeenCalled();
  });

  it('404s when the staff member does not belong to the salon', async () => {
    mocks.prismaMock.staff.findFirst.mockResolvedValue(null);
    await expect(
      service.uploadPhoto(SALON_ID, STAFF_ID, ownerUser, file, {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forbids a staff member with no linked user account', async () => {
    mocks.prismaMock.staff.findFirst.mockResolvedValue({
      ...STAFF_ROW,
      userId: null,
    });
    await expect(
      service.uploadPhoto(SALON_ID, STAFF_ID, staffSelfUser, file, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('StaffGalleryService — photo create flow', () => {
  let service: StaffGalleryService;
  let mocks: ReturnType<typeof buildMocks>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mocks = buildMocks();
    service = await buildService(mocks);

    mocks.prismaMock.staff.findFirst.mockResolvedValue({ ...STAFF_ROW });
    mocks.storageMock.uploadStaffPhoto.mockResolvedValue(PHOTO_URL);
    mocks.prismaMock.staffPhoto.create.mockResolvedValue({
      id: 'photo-1',
      url: PHOTO_URL,
    });
  });

  it('uploads to storage then persists the StaffPhoto row', async () => {
    // Act
    const result = await service.uploadPhoto(
      SALON_ID,
      STAFF_ID,
      staffSelfUser,
      file,
      { caption: 'Balayage' },
    );

    // Assert
    expect(mocks.storageMock.uploadStaffPhoto).toHaveBeenCalledWith(
      STAFF_ID,
      file.buffer,
      'image/jpeg',
    );
    expect(mocks.prismaMock.staffPhoto.create).toHaveBeenCalledWith({
      data: {
        staffId: STAFF_ID,
        categoryId: null,
        url: PHOTO_URL,
        caption: 'Balayage',
      },
    });
    expect(result).toMatchObject({ id: 'photo-1', url: PHOTO_URL });
  });

  it('rejects a categoryId belonging to another staff member', async () => {
    // Arrange — category lookup scoped to staffId finds nothing
    mocks.prismaMock.staffPhotoCategory.findFirst.mockResolvedValue(null);

    // Act + Assert
    await expect(
      service.uploadPhoto(SALON_ID, STAFF_ID, staffSelfUser, file, {
        categoryId: 'cat-of-someone-else',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mocks.storageMock.uploadStaffPhoto).not.toHaveBeenCalled();
  });

  it('links the category when it belongs to the staff member', async () => {
    // Arrange
    mocks.prismaMock.staffPhotoCategory.findFirst.mockResolvedValue({
      id: 'cat-1',
      staffId: STAFF_ID,
    });

    // Act
    await service.uploadPhoto(SALON_ID, STAFF_ID, staffSelfUser, file, {
      categoryId: 'cat-1',
    });

    // Assert
    expect(mocks.prismaMock.staffPhoto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ categoryId: 'cat-1' }),
    });
  });

  it('cleans up the storage object when the DB insert fails', async () => {
    // Arrange
    mocks.prismaMock.staffPhoto.create.mockRejectedValue(new Error('db down'));
    mocks.storageMock.deleteObjectByUrl.mockResolvedValue(undefined);

    // Act + Assert
    await expect(
      service.uploadPhoto(SALON_ID, STAFF_ID, staffSelfUser, file, {}),
    ).rejects.toThrow('db down');
    expect(mocks.storageMock.deleteObjectByUrl).toHaveBeenCalledWith(PHOTO_URL);
  });
});

describe('StaffGalleryService — photo delete flow', () => {
  let service: StaffGalleryService;
  let mocks: ReturnType<typeof buildMocks>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mocks = buildMocks();
    service = await buildService(mocks);

    mocks.prismaMock.staff.findFirst.mockResolvedValue({ ...STAFF_ROW });
    mocks.prismaMock.salon.findUnique.mockResolvedValue({ ...SALON_ROW });
    mocks.prismaMock.staffPhoto.findFirst.mockResolvedValue({
      id: 'photo-1',
      staffId: STAFF_ID,
      url: PHOTO_URL,
    });
    mocks.prismaMock.staffPhoto.delete.mockResolvedValue({});
    mocks.storageMock.deleteObjectByUrl.mockResolvedValue(undefined);
  });

  it('deletes the DB row and the storage object', async () => {
    // Act
    await service.deletePhoto(SALON_ID, STAFF_ID, ownerUser, 'photo-1');

    // Assert
    expect(mocks.prismaMock.staffPhoto.findFirst).toHaveBeenCalledWith({
      where: { id: 'photo-1', staffId: STAFF_ID },
    });
    expect(mocks.prismaMock.staffPhoto.delete).toHaveBeenCalledWith({
      where: { id: 'photo-1' },
    });
    expect(mocks.storageMock.deleteObjectByUrl).toHaveBeenCalledWith(PHOTO_URL);
  });

  it('does not throw when storage cleanup fails after the DB delete', async () => {
    // Arrange
    mocks.storageMock.deleteObjectByUrl.mockRejectedValue(
      new Error('bucket unavailable'),
    );

    // Act + Assert — DB delete already happened; request must still succeed
    await expect(
      service.deletePhoto(SALON_ID, STAFF_ID, ownerUser, 'photo-1'),
    ).resolves.toBeUndefined();
    expect(mocks.prismaMock.staffPhoto.delete).toHaveBeenCalled();
  });

  it('404s for a photo that belongs to another staff member', async () => {
    // Arrange
    mocks.prismaMock.staffPhoto.findFirst.mockResolvedValue(null);

    // Act + Assert
    await expect(
      service.deletePhoto(SALON_ID, STAFF_ID, ownerUser, 'foreign-photo'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mocks.prismaMock.staffPhoto.delete).not.toHaveBeenCalled();
  });
});

describe('StaffGalleryService — categories', () => {
  let service: StaffGalleryService;
  let mocks: ReturnType<typeof buildMocks>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mocks = buildMocks();
    service = await buildService(mocks);

    mocks.prismaMock.staff.findFirst.mockResolvedValue({ ...STAFF_ROW });
    mocks.prismaMock.salon.findUnique.mockResolvedValue({ ...SALON_ROW });
  });

  it('creates a category with default sortOrder 0', async () => {
    // Arrange
    mocks.prismaMock.staffPhotoCategory.create.mockResolvedValue({
      id: 'cat-1',
    });

    // Act
    await service.createCategory(SALON_ID, STAFF_ID, staffSelfUser, {
      name: 'Balayage',
    });

    // Assert
    expect(mocks.prismaMock.staffPhotoCategory.create).toHaveBeenCalledWith({
      data: { staffId: STAFF_ID, name: 'Balayage', sortOrder: 0 },
    });
  });

  it('lists categories with photos, both ordered by sortOrder', async () => {
    // Arrange
    mocks.prismaMock.staffPhotoCategory.findMany.mockResolvedValue([]);

    // Act
    await service.listCategories(SALON_ID, STAFF_ID, staffSelfUser);

    // Assert
    expect(mocks.prismaMock.staffPhotoCategory.findMany).toHaveBeenCalledWith({
      where: { staffId: STAFF_ID },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        photos: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    });
  });

  it('forbids listing categories for a foreign staff member (gallery may be hidden)', async () => {
    await expect(
      service.listCategories(SALON_ID, STAFF_ID, otherStaffUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(mocks.prismaMock.staffPhotoCategory.findMany).not.toHaveBeenCalled();
  });

  it('deletes a category only when it belongs to the staff member', async () => {
    // Arrange
    mocks.prismaMock.staffPhotoCategory.findFirst.mockResolvedValue(null);

    // Act + Assert
    await expect(
      service.deleteCategory(SALON_ID, STAFF_ID, ownerUser, 'foreign-cat'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mocks.prismaMock.staffPhotoCategory.delete).not.toHaveBeenCalled();
  });

  it('deletes an owned category (photos survive via SetNull)', async () => {
    // Arrange
    mocks.prismaMock.staffPhotoCategory.findFirst.mockResolvedValue({
      id: 'cat-1',
      staffId: STAFF_ID,
    });
    mocks.prismaMock.staffPhotoCategory.delete.mockResolvedValue({});

    // Act
    await service.deleteCategory(SALON_ID, STAFF_ID, ownerUser, 'cat-1');

    // Assert
    expect(mocks.prismaMock.staffPhotoCategory.delete).toHaveBeenCalledWith({
      where: { id: 'cat-1' },
    });
  });
});
