import {
  mapAvailabilitySlots,
  isoToLocalHHMM,
  RawAvailabilitySlot,
} from '../bookingSlots';

// Build a local-time ISO string for a given HH:MM so tests are TZ-independent:
// the display time always matches the local wall clock used to build it.
const localIso = (h: number, m: number) => {
  const d = new Date(2026, 6, 10, h, m, 0, 0); // 2026-07-10 local
  return d.toISOString();
};

const raw = (over: Partial<RawAvailabilitySlot>): RawAvailabilitySlot => ({
  staffId: 'staff-1',
  staffName: 'Ana Pop',
  startAt: localIso(9, 0),
  endAt: localIso(9, 45),
  isLocked: false,
  ...over,
});

describe('isoToLocalHHMM', () => {
  test('formats an ISO datetime as local HH:MM with zero padding', () => {
    expect(isoToLocalHHMM(localIso(9, 5))).toBe('09:05');
    expect(isoToLocalHHMM(localIso(14, 30))).toBe('14:30');
  });
});

describe('mapAvailabilitySlots', () => {
  test('returns empty array for no slots', () => {
    expect(mapAvailabilitySlots([])).toEqual([]);
  });

  test('maps backend fields to UI slot shape', () => {
    const res = mapAvailabilitySlots([raw({ startAt: localIso(10, 15) })]);
    expect(res).toEqual([
      {
        time: '10:15',
        startAt: localIso(10, 15),
        staffId: 'staff-1',
        available: true,
      },
    ]);
  });

  test('available is the negation of isLocked', () => {
    const res = mapAvailabilitySlots([
      raw({ startAt: localIso(9, 0), isLocked: true }),
      raw({ startAt: localIso(9, 15), isLocked: false }),
    ]);
    expect(res[0].available).toBe(false);
    expect(res[1].available).toBe(true);
  });

  test('missing isLocked defaults to available', () => {
    const res = mapAvailabilitySlots([raw({ isLocked: undefined })]);
    expect(res[0].available).toBe(true);
  });

  test('dedupes same-time slots across staff, preferring an available one', () => {
    const res = mapAvailabilitySlots([
      raw({ staffId: 'staff-1', startAt: localIso(9, 0), isLocked: true }),
      raw({ staffId: 'staff-2', startAt: localIso(9, 0), isLocked: false }),
      raw({ staffId: 'staff-3', startAt: localIso(9, 0), isLocked: false }),
    ]);
    expect(res).toHaveLength(1);
    // The available slot replaces the locked placeholder; first available wins.
    expect(res[0].staffId).toBe('staff-2');
    expect(res[0].available).toBe(true);
  });

  test('keeps an unavailable slot when no staff is free at that time', () => {
    const res = mapAvailabilitySlots([
      raw({ staffId: 'staff-1', startAt: localIso(9, 0), isLocked: true }),
      raw({ staffId: 'staff-2', startAt: localIso(9, 0), isLocked: true }),
    ]);
    expect(res).toHaveLength(1);
    expect(res[0].available).toBe(false);
  });

  test('sorts slots chronologically regardless of input order', () => {
    const res = mapAvailabilitySlots([
      raw({ startAt: localIso(14, 0) }),
      raw({ startAt: localIso(9, 0) }),
      raw({ startAt: localIso(11, 30) }),
    ]);
    expect(res.map((s) => s.time)).toEqual(['09:00', '11:30', '14:00']);
  });

  test('skips malformed entries without startAt or staffId', () => {
    const res = mapAvailabilitySlots([
      raw({ startAt: localIso(9, 0) }),
      { staffId: '', startAt: localIso(10, 0) },
      { staffId: 'staff-9', startAt: '' },
    ]);
    expect(res).toHaveLength(1);
    expect(res[0].time).toBe('09:00');
  });
});
