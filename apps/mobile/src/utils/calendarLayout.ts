// =============================================================================
// Calendar timeline layout — PURE functions (no React Native imports) so they
// can be unit-tested in a plain Node/ts-jest environment.
//
// `layoutAppointments` turns a flat list of items with start/end minutes into
// positioned blocks: vertical position (top/height in px) plus a lane
// assignment so that overlapping items sit side-by-side in equal-width columns.
// =============================================================================

export interface PositionedItem<T> {
  item: T;
  top: number;
  height: number;
  /** 0-based column within this item's overlap cluster. */
  laneIndex: number;
  /** Total columns in this item's overlap cluster (shared by all its members). */
  laneCount: number;
}

export interface LayoutOptions<T> {
  getStartMin: (t: T) => number;
  getEndMin: (t: T) => number;
  /** Minute value mapped to y = 0 (e.g. 08:00 -> 480). */
  dayStartMin: number;
  /** Vertical scale: pixels per minute. */
  pxPerMin: number;
  /** Floor for block height so very short appointments stay tappable. */
  minHeight?: number;
}

/**
 * Assign overlapping items to side-by-side lanes and compute pixel positions.
 *
 * Two items overlap when one starts strictly before the other ends. Items that
 * merely touch (A ends exactly when B starts) do NOT overlap and get full width.
 */
export function layoutAppointments<T>(items: T[], opts: LayoutOptions<T>): PositionedItem<T>[] {
  const { getStartMin, getEndMin, dayStartMin, pxPerMin, minHeight = 0 } = opts;
  if (items.length === 0) return [];

  // Sort by start, then by end — stable ordering for deterministic lanes.
  const sorted = [...items].sort((a, b) => {
    const sa = getStartMin(a);
    const sb = getStartMin(b);
    if (sa !== sb) return sa - sb;
    return getEndMin(a) - getEndMin(b);
  });

  const result: PositionedItem<T>[] = [];

  // An overlap cluster is a maximal run of items where each new item starts
  // before the running maximum end of the cluster. Lanes are computed per
  // cluster and laneCount is shared across the whole cluster.
  let cluster: T[] = [];
  let clusterMaxEnd = -Infinity;

  const flushCluster = () => {
    if (cluster.length === 0) return;

    // Greedy lane assignment: place each item in the first lane whose last
    // occupant has already ended (end <= this start); otherwise open a new lane.
    const laneEnds: number[] = [];
    const laneOf = new Map<T, number>();

    for (const it of cluster) {
      const s = getStartMin(it);
      let lane = -1;
      for (let i = 0; i < laneEnds.length; i++) {
        if (laneEnds[i] <= s) {
          lane = i;
          break;
        }
      }
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(getEndMin(it));
      } else {
        laneEnds[lane] = getEndMin(it);
      }
      laneOf.set(it, lane);
    }

    const laneCount = laneEnds.length;
    for (const it of cluster) {
      const s = getStartMin(it);
      const e = getEndMin(it);
      result.push({
        item: it,
        top: (s - dayStartMin) * pxPerMin,
        height: Math.max((e - s) * pxPerMin, minHeight),
        laneIndex: laneOf.get(it) as number,
        laneCount,
      });
    }

    cluster = [];
    clusterMaxEnd = -Infinity;
  };

  for (const it of sorted) {
    const s = getStartMin(it);
    const e = getEndMin(it);
    // If this item starts at/after everything seen in the cluster, the cluster
    // is complete — no overlap with the incoming item.
    if (cluster.length > 0 && s >= clusterMaxEnd) {
      flushCluster();
    }
    cluster.push(it);
    clusterMaxEnd = Math.max(clusterMaxEnd, e);
  }
  flushCluster();

  return result;
}

/** Minutes since local midnight for an ISO datetime string (0..1439). */
export function isoToMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Local calendar day key (YYYY-MM-DD). NEVER use `toISOString().split('T')[0]`
 * for calendar days: that truncates in UTC, so between local midnight and
 * ~03:00 (Romania, UTC+2/+3) it returns the PREVIOUS day.
 */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── Drag-to-reschedule helpers ────────────────────────────────────────────────

export interface DragSnapOptions {
  /** Vertical scale of the timeline: pixels per minute. */
  pxPerMin: number;
  /** Snap grid in minutes (e.g. 15). */
  snapMin: number;
  /** First minute visible on the timeline (e.g. 08:00 → 480). */
  dayStartMin: number;
  /** Last minute visible on the timeline (e.g. 20:00 → 1200). */
  dayEndMin: number;
  /** Appointment duration — keeps the whole block inside the day. */
  durationMin: number;
}

/**
 * Convert a vertical drag offset (px) into the appointment's new start minute:
 * snapped to the grid and clamped so the block never leaves the visible day.
 */
export function dragOffsetToStartMin(
  originalStartMin: number,
  offsetPx: number,
  opts: DragSnapOptions,
): number {
  const raw = originalStartMin + offsetPx / opts.pxPerMin;
  const snapped = Math.round(raw / opts.snapMin) * opts.snapMin;
  const latestStart = opts.dayEndMin - opts.durationMin;
  return Math.max(opts.dayStartMin, Math.min(snapped, latestStart));
}

/**
 * Return a new ISO string with the same local calendar date as `iso` but the
 * time-of-day replaced by `startMin` minutes since midnight.
 */
export function withStartMinutes(iso: string, startMin: number): string {
  const d = new Date(iso);
  d.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
  return d.toISOString();
}

/** Format minutes-since-midnight as "HH:MM". */
export function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
