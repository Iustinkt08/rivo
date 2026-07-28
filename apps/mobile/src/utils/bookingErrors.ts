// Typed booking-availability errors, kept free of API-client imports so the
// detection logic stays unit-testable.

/** The salon has no active staff able to perform the requested service. */
export class NoStaffAvailableError extends Error {
  readonly code = 'NO_STAFF';

  constructor() {
    super('No available staff for this service');
    this.name = 'NoStaffAvailableError';
  }
}

// The backend signals "salon has no bookable staff" as a 404 with this message
// (see apps/backend appointments.service getAvailability / resolveStaff).
const NO_STAFF_MESSAGE = 'No available staff';

export function isNoStaffResponse(status?: number, message?: unknown): boolean {
  if (status !== 404) return false;
  return String(message ?? '').includes(NO_STAFF_MESSAGE);
}
