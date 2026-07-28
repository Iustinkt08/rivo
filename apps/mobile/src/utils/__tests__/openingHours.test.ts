import {
  EditableDayHours,
  findInvalidDays,
  isValidTime,
  toOpeningHoursPayload,
} from '../openingHours';

const day = (overrides: Partial<EditableDayHours> = {}): EditableDayHours => ({
  day: 'MONDAY',
  open: '09:00',
  close: '19:00',
  isOpen: true,
  ...overrides,
});

describe('isValidTime', () => {
  test('accepts valid HH:MM values', () => {
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('09:30')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
  });

  test('rejects malformed or out-of-range values', () => {
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('9:00')).toBe(false);
    expect(isValidTime('09:60')).toBe(false);
    expect(isValidTime('')).toBe(false);
    expect(isValidTime('abc')).toBe(false);
  });
});

describe('findInvalidDays', () => {
  test('returns empty array when all open days have valid times', () => {
    // Arrange
    const hours = [day(), day({ day: 'TUESDAY', open: '10:00' })];

    // Act + Assert
    expect(findInvalidDays(hours)).toEqual([]);
  });

  test('flags open days with invalid times', () => {
    // Arrange
    const hours = [
      day({ open: 'bad' }),
      day({ day: 'TUESDAY', close: '25:00' }),
    ];

    // Act + Assert
    expect(findInvalidDays(hours)).toEqual(['MONDAY', 'TUESDAY']);
  });

  test('ignores invalid times on closed days', () => {
    // Arrange
    const hours = [day({ isOpen: false, open: 'bad', close: 'bad' })];

    // Act + Assert
    expect(findInvalidDays(hours)).toEqual([]);
  });
});

describe('toOpeningHoursPayload', () => {
  test('maps editor rows to the backend payload shape', () => {
    // Arrange
    const hours = [day(), day({ day: 'SUNDAY', isOpen: false })];

    // Act
    const payload = toOpeningHoursPayload(hours);

    // Assert
    expect(payload).toEqual([
      { dayOfWeek: 'MONDAY', openTime: '09:00', closeTime: '19:00', isClosed: false },
      { dayOfWeek: 'SUNDAY', openTime: '09:00', closeTime: '19:00', isClosed: true },
    ]);
  });
});
