import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const prismaMock = {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const USER_ID = 'user-1';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('notify creates a notification row with type and appointmentId in data', async () => {
    // Arrange
    prismaMock.notification.create.mockResolvedValue({ id: 'n-1' });

    // Act
    await service.notify(USER_ID, {
      type: 'NEW_BOOKING',
      title: 'Programare nouă',
      body: 'Ana Pop — Unghii cu gel',
      appointmentId: 'appt-1',
    });

    // Assert
    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        title: 'Programare nouă',
        body: 'Ana Pop — Unghii cu gel',
        data: { type: 'NEW_BOOKING', appointmentId: 'appt-1' },
      },
    });
  });

  it('listFor returns newest-first, limited to 50', async () => {
    // Arrange
    prismaMock.notification.findMany.mockResolvedValue([]);

    // Act
    await service.listFor(USER_ID);

    // Assert
    expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      orderBy: { sentAt: 'desc' },
      take: 50,
    });
  });

  it('markRead throws NotFoundException for a missing notification', async () => {
    // Arrange
    prismaMock.notification.findUnique.mockResolvedValue(null);

    // Act + Assert
    await expect(service.markRead('n-404', USER_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('markRead rejects a notification owned by another user', async () => {
    // Arrange
    prismaMock.notification.findUnique.mockResolvedValue({
      id: 'n-1',
      userId: 'someone-else',
    });

    // Act + Assert
    await expect(service.markRead('n-1', USER_ID)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prismaMock.notification.update).not.toHaveBeenCalled();
  });

  it('markRead marks own notification as read', async () => {
    // Arrange
    prismaMock.notification.findUnique.mockResolvedValue({
      id: 'n-1',
      userId: USER_ID,
    });
    prismaMock.notification.update.mockResolvedValue({
      id: 'n-1',
      isRead: true,
    });

    // Act
    await service.markRead('n-1', USER_ID);

    // Assert
    expect(prismaMock.notification.update).toHaveBeenCalledWith({
      where: { id: 'n-1' },
      data: { isRead: true },
    });
  });

  it('markAllRead updates every unread notification of the user', async () => {
    // Arrange
    prismaMock.notification.updateMany.mockResolvedValue({ count: 3 });

    // Act
    await service.markAllRead(USER_ID);

    // Assert
    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, isRead: false },
      data: { isRead: true },
    });
  });
});
