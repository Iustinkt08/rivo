import { Colors } from '../../../theme';

// Appointment "source" → left-bar color (online booking vs walk-in vs phone).
export const SOURCE_COLORS: Record<string, string> = {
  ONLINE: Colors.primary,
  WALK_IN: '#2563EB',
  PHONE: '#7C3AED',
};

export const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: Colors.success,
  PENDING: Colors.warning,
  REJECTED: Colors.error,
  COMPLETED: Colors.gray500,
  CANCELLED: Colors.error,
  NO_SHOW: Colors.error,
};

export const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Confirmat',
  PENDING: 'În așteptare',
  REJECTED: 'Respinsă',
  COMPLETED: 'Finalizat',
  CANCELLED: 'Anulat',
  NO_SHOW: 'Neprezentare',
};

export const SOURCE_LABELS: Record<string, string> = {
  ONLINE: 'Online',
  WALK_IN: 'Walk-in',
  PHONE: 'Telefon',
};

// ── Timeline geometry ────────────────────────────────────────────────────────
export const START_HOUR = 8;
export const END_HOUR = 20;
export const DAY_START_MIN = START_HOUR * 60; // 480
export const DAY_END_MIN = END_HOUR * 60; // 1200
export const HOUR_HEIGHT = 64; // px per hour row
export const PX_PER_MIN = HOUR_HEIGHT / 60;
export const RAIL_WIDTH = 54; // width reserved for the hour labels
export const SLOT_SNAP_MIN = 15; // empty-slot taps snap to 15-min grid
export const MIN_BLOCK_HEIGHT = 26; // keep short appointments tappable
