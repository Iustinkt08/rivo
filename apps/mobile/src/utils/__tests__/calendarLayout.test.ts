import {
  layoutAppointments, isoToMinutes, minutesToHHMM,
  dragOffsetToStartMin, withStartMinutes, localDateKey,
} from '../calendarLayout';

describe('localDateKey', () => {
  test('uses the LOCAL calendar date, not UTC truncation', () => {
    // 01:00 local, just after midnight — in any TZ ahead of UTC the ISO string
    // would still carry the previous day; the local key must not.
    const justAfterMidnight = new Date(2026, 6, 2, 1, 0);
    expect(localDateKey(justAfterMidnight)).toBe('2026-07-02');
  });

  test('keeps late-evening times on the same local day', () => {
    const lateEvening = new Date(2026, 11, 31, 23, 59);
    expect(localDateKey(lateEvening)).toBe('2026-12-31');
  });

  test('zero-pads single-digit month and day', () => {
    expect(localDateKey(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05');
  });
});

// Simple test item: minutes-based interval with an id.
interface Slot {
  id: string;
  start: number; // minutes since midnight
  end: number;
}

const layout = (slots: Slot[], opts?: { dayStartMin?: number; pxPerMin?: number; minHeight?: number }) =>
  layoutAppointments(slots, {
    getStartMin: (s) => s.start,
    getEndMin: (s) => s.end,
    dayStartMin: opts?.dayStartMin ?? 480,
    pxPerMin: opts?.pxPerMin ?? 1,
    minHeight: opts?.minHeight ?? 0,
  });

const byId = (res: ReturnType<typeof layout>, id: string) => res.find((r) => r.item.id === id)!;

describe('layoutAppointments', () => {
  test('returns empty array for no items', () => {
    expect(layout([])).toEqual([]);
  });

  test('single appointment occupies one full-width lane', () => {
    const res = layout([{ id: 'a', start: 540, end: 600 }]); // 09:00–10:00
    expect(res).toHaveLength(1);
    expect(res[0].laneIndex).toBe(0);
    expect(res[0].laneCount).toBe(1);
  });

  test('computes top and height from dayStart and pxPerMin', () => {
    // 09:00–09:45 with day starting 08:00 and 2 px/min
    const res = layout([{ id: 'a', start: 540, end: 585 }], { dayStartMin: 480, pxPerMin: 2 });
    expect(res[0].top).toBe((540 - 480) * 2); // 120
    expect(res[0].height).toBe((585 - 540) * 2); // 90
  });

  test('non-overlapping appointments each get one lane', () => {
    const res = layout([
      { id: 'a', start: 540, end: 570 },
      { id: 'b', start: 600, end: 630 },
    ]);
    expect(byId(res, 'a').laneCount).toBe(1);
    expect(byId(res, 'b').laneCount).toBe(1);
  });

  test('adjacent appointments (A ends when B starts) do NOT overlap', () => {
    const res = layout([
      { id: 'a', start: 600, end: 630 }, // 10:00–10:30
      { id: 'b', start: 630, end: 660 }, // 10:30–11:00
    ]);
    expect(byId(res, 'a').laneCount).toBe(1);
    expect(byId(res, 'b').laneCount).toBe(1);
  });

  test('two overlapping appointments split into two lanes', () => {
    const res = layout([
      { id: 'a', start: 540, end: 600 }, // 09:00–10:00
      { id: 'b', start: 570, end: 630 }, // 09:30–10:30
    ]);
    expect(byId(res, 'a').laneCount).toBe(2);
    expect(byId(res, 'b').laneCount).toBe(2);
    const lanes = [byId(res, 'a').laneIndex, byId(res, 'b').laneIndex].sort();
    expect(lanes).toEqual([0, 1]);
  });

  test('three mutually overlapping appointments use three lanes', () => {
    const res = layout([
      { id: 'a', start: 540, end: 600 },
      { id: 'b', start: 545, end: 605 },
      { id: 'c', start: 550, end: 610 },
    ]);
    expect(byId(res, 'a').laneCount).toBe(3);
    expect(byId(res, 'b').laneCount).toBe(3);
    expect(byId(res, 'c').laneCount).toBe(3);
    const lanes = [byId(res, 'a').laneIndex, byId(res, 'b').laneIndex, byId(res, 'c').laneIndex].sort();
    expect(lanes).toEqual([0, 1, 2]);
  });

  test('a fully nested appointment overlaps its container', () => {
    const res = layout([
      { id: 'outer', start: 540, end: 660 }, // 09:00–11:00
      { id: 'inner', start: 570, end: 600 }, // 09:30–10:00
    ]);
    expect(byId(res, 'outer').laneCount).toBe(2);
    expect(byId(res, 'inner').laneCount).toBe(2);
  });

  test('reuses a freed lane after an appointment ends within a cluster', () => {
    // a & b overlap (2 lanes). c starts after a ends but still overlaps b,
    // so the cluster stays open; c should reuse a's freed lane -> laneCount 2.
    const res = layout([
      { id: 'a', start: 540, end: 570 }, // 09:00–09:30  lane 0
      { id: 'b', start: 550, end: 640 }, // 09:10–10:40  lane 1
      { id: 'c', start: 575, end: 605 }, // 09:35–10:05  reuse lane 0
    ]);
    expect(byId(res, 'a').laneCount).toBe(2);
    expect(byId(res, 'c').laneCount).toBe(2);
    expect(byId(res, 'c').laneIndex).toBe(0);
  });

  test('applies minHeight floor to very short appointments', () => {
    const res = layout([{ id: 'a', start: 540, end: 545 }], { pxPerMin: 1, minHeight: 22 });
    expect(res[0].height).toBe(22);
  });
});

describe('isoToMinutes', () => {
  test('converts local time to minutes since midnight', () => {
    // Construct a local Date so the assertion is timezone-independent.
    const d = new Date(2026, 6, 1, 9, 30, 0);
    expect(isoToMinutes(d.toISOString())).toBe(9 * 60 + 30);
  });
});

describe('minutesToHHMM', () => {
  test('formats minutes as zero-padded HH:MM', () => {
    expect(minutesToHHMM(540)).toBe('09:00');
    expect(minutesToHHMM(615)).toBe('10:15');
    expect(minutesToHHMM(0)).toBe('00:00');
  });
});

describe('dragOffsetToStartMin', () => {
  // Timeline geometry mirrors constants.ts: 08:00–20:00, ~1.067 px/min.
  const opts = {
    pxPerMin: 64 / 60,
    snapMin: 15,
    dayStartMin: 480,
    dayEndMin: 1200,
    durationMin: 60,
  };

  test('returns the original start for a zero offset', () => {
    expect(dragOffsetToStartMin(540, 0, opts)).toBe(540);
  });

  test('snaps the dragged position to the 15-min grid', () => {
    // 09:00 dragged down ~20 min of pixels → snaps to 09:15.
    expect(dragOffsetToStartMin(540, 20 * opts.pxPerMin, opts)).toBe(555);
    // ~8 min of pixels rounds to the nearest slot (09:15 → 555).
    expect(dragOffsetToStartMin(540, 8 * opts.pxPerMin, opts)).toBe(555);
    // ~7 min of pixels rounds back down to 09:00.
    expect(dragOffsetToStartMin(540, 7 * opts.pxPerMin, opts)).toBe(540);
  });

  test('supports dragging upwards with negative offsets', () => {
    expect(dragOffsetToStartMin(600, -30 * opts.pxPerMin, opts)).toBe(570);
  });

  test('clamps at the top of the day', () => {
    expect(dragOffsetToStartMin(510, -500 * opts.pxPerMin, opts)).toBe(480);
  });

  test('clamps at the bottom so the block stays inside the day', () => {
    // Latest allowed start = 20:00 − 60 min = 19:00 (1140).
    expect(dragOffsetToStartMin(1000, 900 * opts.pxPerMin, opts)).toBe(1140);
  });
});

describe('withStartMinutes', () => {
  test('replaces the time-of-day but keeps the local calendar date', () => {
    const original = new Date(2026, 6, 3, 9, 0, 0); // local 3 Jul, 09:00
    const moved = new Date(withStartMinutes(original.toISOString(), 615));

    expect(moved.getFullYear()).toBe(2026);
    expect(moved.getMonth()).toBe(6);
    expect(moved.getDate()).toBe(3);
    expect(moved.getHours()).toBe(10);
    expect(moved.getMinutes()).toBe(15);
    expect(moved.getSeconds()).toBe(0);
  });
});
