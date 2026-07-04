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
    notificationPreference: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const USER_ID = 'user-1';

  const ALL_TRUE_PREFERENCES = {
    onAccepted: true,
    onRejected: true,
    onCancelled: true,
    onRescheduled: true,
    onPriceChange: true,
    onDurationChange: true,
    onReview: true,
    onReminder: true,
  };

  const ALL_FALSE_PREFERENCES = {
    onAccepted: false,
    onRejected: false,
    onCancelled: false,
    onRescheduled: false,
    onPriceChange: false,
    onDurationChange: false,
    onReview: false,
    onReminder: false,
  };

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

  it('notify skips persisting when the preference for that type is off', async () => {
    // Arrange
    prismaMock.notificationPreference.findUnique.mockResolvedValue({
      ...ALL_TRUE_PREFERENCES,
      onAccepted: false,
    });

    // Act
    const result = await service.notify(USER_ID, {
      type: 'BOOKING_ACCEPTED',
      title: 'Programare acceptată',
      body: 'Salonul a acceptat programarea',
    });

    // Assert
    expect(result).toBeNull();
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it('notify persists when the user has no preference row (defaults all true)', async () => {
    // Arrange
    prismaMock.notificationPreference.findUnique.mockResolvedValue(null);
    prismaMock.notification.create.mockResolvedValue({ id: 'n-2' });

    // Act
    await service.notify(USER_ID, {
      type: 'RESCHEDULED',
      title: 'Programare reprogramată',
      body: 'Ora s-a schimbat',
    });

    // Assert
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
  });

  it('notify always persists NEW_BOOKING without checking preferences', async () => {
    // Arrange
    prismaMock.notificationPreference.findUnique.mockResolvedValue(
      ALL_FALSE_PREFERENCES,
    );
    prismaMock.notification.create.mockResolvedValue({ id: 'n-3' });

    // Act
    await service.notify(USER_ID, {
      type: 'NEW_BOOKING',
      title: 'Programare nouă',
      body: 'Ana Pop — Unghii cu gel',
    });

    // Assert
    expect(prismaMock.notificationPreference.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
  });

  it('notify still persists when the preference lookup fails (fail open)', async () => {
    // Arrange
    prismaMock.notificationPreference.findUnique.mockRejectedValue(
      new Error('db down'),
    );
    prismaMock.notification.create.mockResolvedValue({ id: 'n-4' });

    // Act
    await service.notify(USER_ID, {
      type: 'REMINDER',
      title: 'Reamintire',
      body: 'Programare mâine la 10:00',
    });

    // Assert
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
  });

  it('getPreferences returns defaults without creating a row when none exists', async () => {
    // Arrange
    prismaMock.notificationPreference.findUnique.mockResolvedValue(null);

    // Act
    const preferences = await service.getPreferences(USER_ID);

    // Assert
    expect(preferences).toEqual(ALL_TRUE_PREFERENCES);
    expect(prismaMock.notificationPreference.upsert).not.toHaveBeenCalled();
  });

  it('updatePreferences upserts the caller row and returns the updated shape', async () => {
    // Arrange
    prismaMock.notificationPreference.upsert.mockResolvedValue({
      id: 'pref-1',
      userId: USER_ID,
      ...ALL_TRUE_PREFERENCES,
      onReminder: false,
      updatedAt: new Date(),
    });

    // Act
    const preferences = await service.updatePreferences(USER_ID, {
      onReminder: false,
    });

    // Assert
    expect(prismaMock.notificationPreference.upsert).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      create: { userId: USER_ID, onReminder: false },
      update: { onReminder: false },
    });
    expect(preferences).toEqual({
      ...ALL_TRUE_PREFERENCES,
      onReminder: false,
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
