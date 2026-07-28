// Pure helpers for the weekly opening-hours editor (business settings).
// Kept free of React Native imports so they run under the plain-node jest setup.

export interface EditableDayHours {
  day: string;      // MONDAY … SUNDAY
  open: string;     // HH:MM
  close: string;    // HH:MM
  isOpen: boolean;
}

export const WEEK_DAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

export const DAY_LABELS_RO: Record<string, string> = {
  MONDAY: 'Lun',
  TUESDAY: 'Mar',
  WEDNESDAY: 'Mie',
  THURSDAY: 'Joi',
  FRIDAY: 'Vin',
  SATURDAY: 'Sâm',
  SUNDAY: 'Dum',
};

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/; // HH:MM, mirrors the backend DTO

export function isValidTime(value: string): boolean {
  return TIME_REGEX.test(value);
}

/**
 * Validates a full week of editable hours. Closed days are skipped (their
 * times are irrelevant server-side). Returns the day keys that fail, so the
 * UI can point the user at the exact rows.
 */
export function findInvalidDays(hours: EditableDayHours[]): string[] {
  return hours
    .filter((h) => h.isOpen && (!isValidTime(h.open) || !isValidTime(h.close)))
    .map((h) => h.day);
}

/** Maps editor rows to the backend SetOpeningHours payload shape. */
export function toOpeningHoursPayload(hours: EditableDayHours[]): {
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}[] {
  return hours.map((h) => ({
    dayOfWeek: h.day,
    openTime: h.open,
    closeTime: h.close,
    isClosed: !h.isOpen,
  }));
}
