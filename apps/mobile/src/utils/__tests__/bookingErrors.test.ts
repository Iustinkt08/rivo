import { NoStaffAvailableError, isNoStaffResponse } from '../bookingErrors';

describe('isNoStaffResponse', () => {
  test('detects the backend no-staff 404 message', () => {
    // Arrange
    const status = 404;
    const message = 'No available staff for this service';

    // Act
    const result = isNoStaffResponse(status, message);

    // Assert
    expect(result).toBe(true);
  });

  test('returns false for a plain 404 (unknown salon or service)', () => {
    expect(isNoStaffResponse(404, 'Service not found or inactive')).toBe(false);
  });

  test('returns false for non-404 statuses even with a matching message', () => {
    expect(isNoStaffResponse(500, 'No available staff for this service')).toBe(false);
  });

  test('returns false when status or message is missing', () => {
    expect(isNoStaffResponse(undefined, undefined)).toBe(false);
    expect(isNoStaffResponse(404, undefined)).toBe(false);
  });
});

describe('NoStaffAvailableError', () => {
  test('is an Error with a stable code for instanceof-free checks', () => {
    // Arrange + Act
    const err = new NoStaffAvailableError();

    // Assert
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('NO_STAFF');
    expect(err.name).toBe('NoStaffAvailableError');
  });
});
