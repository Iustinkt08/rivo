import {
  mapServerNotification,
  mapServerNotifications,
} from '../notificationMapping';

describe('mapServerNotification', () => {
  test('maps a full server notification to AppNotification', () => {
    // Arrange
    const server = {
      id: 'n-1',
      title: 'Programare nouă',
      body: 'Ana Pop — Unghii cu gel, 3 iul. 09:00',
      data: { type: 'NEW_BOOKING', appointmentId: 'appt-1' },
      isRead: false,
      sentAt: '2026-07-02T10:00:00.000Z',
    };

    // Act
    const mapped = mapServerNotification(server);

    // Assert
    expect(mapped).toEqual({
      id: 'n-1',
      type: 'NEW_BOOKING',
      title: 'Programare nouă',
      body: 'Ana Pop — Unghii cu gel, 3 iul. 09:00',
      createdAt: '2026-07-02T10:00:00.000Z',
      isRead: false,
      appointmentId: 'appt-1',
    });
  });

  test('falls back to REMINDER when data is null', () => {
    // Arrange
    const server = {
      id: 'n-2',
      title: 'T',
      body: 'B',
      data: null,
      isRead: true,
      sentAt: '2026-07-01T08:00:00.000Z',
    };

    // Act
    const mapped = mapServerNotification(server);

    // Assert
    expect(mapped.type).toBe('REMINDER');
    expect(mapped.appointmentId).toBeUndefined();
    expect(mapped.isRead).toBe(true);
  });

  test.each([
    'BOOKING_ACCEPTED',
    'BOOKING_REJECTED',
    'RESCHEDULED',
    'PRICE_CHANGE',
    'DURATION_CHANGE',
  ] as const)('preserves the new server type %s', (type) => {
    // Act
    const mapped = mapServerNotification({
      id: 'n-x',
      title: 'T',
      body: 'B',
      data: { type, appointmentId: 'appt-9' },
      isRead: false,
      sentAt: '2026-07-01T08:00:00.000Z',
    });

    // Assert
    expect(mapped.type).toBe(type);
    expect(mapped.appointmentId).toBe('appt-9');
  });

  test('falls back to REMINDER for unknown types', () => {
    // Act
    const mapped = mapServerNotification({
      id: 'n-3',
      title: 'T',
      body: 'B',
      data: { type: 'SOMETHING_NEW' },
      isRead: false,
      sentAt: '2026-07-01T08:00:00.000Z',
    });

    // Assert
    expect(mapped.type).toBe('REMINDER');
  });
});

describe('mapServerNotifications', () => {
  test('maps a plain array response', () => {
    // Act
    const mapped = mapServerNotifications([
      { id: '1', title: 'A', body: '', data: null, isRead: false, sentAt: 'x' },
    ]);

    // Assert
    expect(mapped).toHaveLength(1);
    expect(mapped[0].id).toBe('1');
  });

  test('unwraps an enveloped { data: [...] } response', () => {
    // Act
    const mapped = mapServerNotifications({
      data: [
        { id: '1', title: 'A', body: '', data: null, isRead: false, sentAt: 'x' },
      ],
    });

    // Assert
    expect(mapped).toHaveLength(1);
  });

  test('returns empty array for malformed input', () => {
    expect(mapServerNotifications(null)).toEqual([]);
    expect(mapServerNotifications({ data: 'oops' })).toEqual([]);
    expect(mapServerNotifications(42)).toEqual([]);
  });
});
