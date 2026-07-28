// Pure mapping for the backend staff-login response (POST /auth/staff/login).
// No API-client imports so the module stays unit-testable.

export interface StaffSessionStaff {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  avatarEmoji: string;
  avatarUrl: string | null;
  salonId: string;
}

export interface StaffSession {
  token: string;
  staff: StaffSessionStaff;
  salon: { id: string; name: string };
}

/** Maps the raw login payload to a StaffSession; throws on malformed data. */
export function mapStaffLoginResponse(data: any): StaffSession {
  const body = data?.data ?? data;
  const token = body?.accessToken;
  const staff = body?.staff;
  const salon = body?.salon;

  if (typeof token !== 'string' || !token || !staff?.id || !salon?.id) {
    throw new Error('Malformed staff login response');
  }

  return {
    token,
    staff: {
      id: String(staff.id),
      firstName: staff.firstName ?? '',
      lastName: staff.lastName ?? '',
      specialty: staff.specialty ?? '',
      avatarEmoji: staff.avatarEmoji ?? '👤',
      avatarUrl: staff.avatarUrl ?? null,
      salonId: staff.salonId ?? String(salon.id),
    },
    salon: { id: String(salon.id), name: salon.name ?? '' },
  };
}

/** Type guard for a persisted (AsyncStorage) staff session. */
export function isValidStoredStaffSession(value: unknown): value is StaffSession {
  const s = value as StaffSession | null;
  return (
    !!s &&
    typeof s.token === 'string' &&
    !!s.token &&
    !!s.staff?.id &&
    !!s.salon?.id
  );
}
