import { Test, TestingModule } from '@nestjs/testing';
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
