import {
  isValidStoredStaffSession,
  mapStaffLoginResponse,
} from '../staffSession';

const VALID_RESPONSE = {
  accessToken: 'jwt-token',
  staff: {
    id: 'staff-1',
    firstName: 'Marinica',
    lastName: 'Gonel',
    specialty: 'Nails',
    avatarEmoji: '💅',
    avatarUrl: null,
    salonId: 'salon-1',
  },
  salon: { id: 'salon-1', name: 'Salon Prost' },
};

describe('mapStaffLoginResponse', () => {
  test('maps a valid login payload to a StaffSession', () => {
    // Act
    const session = mapStaffLoginResponse(VALID_RESPONSE);

    // Assert
    expect(session).toEqual({
      token: 'jwt-token',
      staff: {
        id: 'staff-1',
        firstName: 'Marinica',
        lastName: 'Gonel',
        specialty: 'Nails',
        avatarEmoji: '💅',
        avatarUrl: null,
        salonId: 'salon-1',
      },
      salon: { id: 'salon-1', name: 'Salon Prost' },
    });
  });

  test('unwraps an enveloped { data: ... } payload', () => {
    const session = mapStaffLoginResponse({ data: VALID_RESPONSE });
    expect(session.token).toBe('jwt-token');
  });

  test('fills display defaults for missing optional fields', () => {
    const session = mapStaffLoginResponse({
      accessToken: 't',
      staff: { id: 's1' },
      salon: { id: 'sal1' },
    });
    expect(session.staff.avatarEmoji).toBe('👤');
    expect(session.staff.specialty).toBe('');
    expect(session.staff.salonId).toBe('sal1');
  });

  test('throws on a malformed payload (missing token or ids)', () => {
    expect(() => mapStaffLoginResponse({})).toThrow();
    expect(() =>
      mapStaffLoginResponse({ accessToken: 't', staff: {}, salon: {} }),
    ).toThrow();
  });
});

describe('isValidStoredStaffSession', () => {
  test('accepts a well-formed persisted session', () => {
    const session = mapStaffLoginResponse(VALID_RESPONSE);
    expect(isValidStoredStaffSession(session)).toBe(true);
  });

  test('rejects null, partial and corrupt values', () => {
    expect(isValidStoredStaffSession(null)).toBe(false);
    expect(isValidStoredStaffSession({ token: 't' })).toBe(false);
    expect(isValidStoredStaffSession('garbage')).toBe(false);
  });
});
