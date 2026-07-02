import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('ReviewsService — findBySalon', () => {
  let service: ReviewsService;

  const prismaMock = {
    review: { findMany: jest.fn() },
  };
  const notificationsMock = { notify: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: NotificationsService, useValue: notificationsMock },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  it('attributes each review to its staff member via the appointment relation', async () => {
    // Arrange
    prismaMock.review.findMany.mockResolvedValue([
      {
        id: 'rev-1',
        rating: 5,
        comment: 'Super',
        createdAt: new Date('2026-06-01T10:00:00Z'),
        client: { firstName: 'Maria', lastName: 'Ionescu', avatarUrl: null },
        appointment: {
          staffId: 'staff-1',
          staff: { id: 'staff-1', firstName: 'Ana', lastName: 'Pop' },
        },
      },
    ]);

    // Act
    const result = await service.findBySalon('salon-1');

    // Assert
    expect(result).toEqual([
      expect.objectContaining({
        id: 'rev-1',
        rating: 5,
        staffId: 'staff-1',
        staffName: 'Ana Pop',
      }),
    ]);
    // The raw appointment relation is not leaked in the payload.
    expect((result[0] as any).appointment).toBeUndefined();
  });

  it('returns null staff attribution when the appointment has no staff', async () => {
    // Arrange
    prismaMock.review.findMany.mockResolvedValue([
      {
        id: 'rev-2',
        rating: 4,
        comment: null,
        createdAt: new Date('2026-06-02T10:00:00Z'),
        client: { firstName: 'Ion', lastName: 'Dan', avatarUrl: null },
        appointment: null,
      },
    ]);

    // Act
    const result = await service.findBySalon('salon-1');

    // Assert
    expect(result[0]).toMatchObject({ staffId: null, staffName: null });
  });
});

describe('ReviewsService — reply', () => {
  let service: ReviewsService;

  const prismaMock = {
    review: { findUnique: jest.fn(), update: jest.fn() },
  };
  const notificationsMock = { notify: jest.fn() };

  const OWNER_ID = 'owner-1';
  const CLIENT_ID = 'client-1';
  const reviewRow = {
    id: 'rev-1',
    clientId: CLIENT_ID,
    appointmentId: 'appt-1',
    salon: { adminId: OWNER_ID, name: 'Salon' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: NotificationsService, useValue: notificationsMock },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);

    prismaMock.review.findUnique.mockResolvedValue(reviewRow);
    prismaMock.review.update.mockResolvedValue({
      id: 'rev-1',
      replyText: 'Mulțumim!',
    });
  });

  it('sets replyText + repliedAt and notifies the reviewing client', async () => {
    // Act
    await service.reply('rev-1', OWNER_ID, 'Mulțumim!');

    // Assert
    const updateArgs = prismaMock.review.update.mock.calls[0][0];
    expect(updateArgs.data.replyText).toBe('Mulțumim!');
    expect(updateArgs.data.repliedAt).toBeInstanceOf(Date);
    expect(notificationsMock.notify).toHaveBeenCalledWith(
      CLIENT_ID,
      expect.objectContaining({ type: 'REVIEW' }),
    );
  });

  it('throws ForbiddenException when the caller is not the salon owner', async () => {
    // Act + Assert
    await expect(
      service.reply('rev-1', 'someone-else', 'hi'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prismaMock.review.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException for a missing review', async () => {
    // Arrange
    prismaMock.review.findUnique.mockResolvedValue(null);

    // Act + Assert
    await expect(service.reply('nope', OWNER_ID, 'hi')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('still succeeds when the client notification fails', async () => {
    // Arrange
    notificationsMock.notify.mockRejectedValue(new Error('down'));

    // Act
    const result = await service.reply('rev-1', OWNER_ID, 'Mulțumim!');

    // Assert
    expect(result).toMatchObject({ id: 'rev-1' });
  });
});
