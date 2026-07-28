// Pure helpers for the client booking flow — no React Native imports so they
// stay testable under the node-scoped jest config.

/** Raw slot shape returned by GET /salons/:salonId/availability */
export interface RawAvailabilitySlot {
  staffId: string;
  staffName?: string;
  startAt: string; // ISO datetime
  endAt?: string;
  isLocked?: boolean;
}

/** Slot shape consumed by the booking UI */
export interface AvailableSlot {
  time: string;    // "HH:MM" in local time — display only
  startAt: string; // exact ISO from the backend — used for lock/create
  staffId: string;
  available: boolean;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format an ISO datetime as local "HH:MM" without locale dependence. */
export function isoToLocalHHMM(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Map raw availability slots to UI slots:
 * - `available` = !isLocked
 * - dedupe by display time: several staff can share a slot; prefer an
 *   available one so "any staff" bookings adopt a free staffId
 * - sorted chronologically by startAt
 */
export function mapAvailabilitySlots(raw: RawAvailabilitySlot[]): AvailableSlot[] {
  const byTime = new Map<string, AvailableSlot>();

  for (const s of raw) {
    if (!s?.startAt || !s?.staffId) continue;
    const slot: AvailableSlot = {
      time: isoToLocalHHMM(s.startAt),
      startAt: s.startAt,
      staffId: s.staffId,
      available: !(s.isLocked ?? false),
    };
    const existing = byTime.get(slot.time);
    // Keep the first available slot for a given time; an available slot
    // always replaces an unavailable placeholder.
    if (!existing || (!existing.available && slot.available)) {
      byTime.set(slot.time, slot);
    }
  }

  return [...byTime.values()].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );
}
