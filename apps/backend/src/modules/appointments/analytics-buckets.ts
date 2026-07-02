// Pure window/bucket math for salon analytics — no I/O, fully unit-testable.
// Extracted from appointments.service.ts (which only orchestrates the query).

export const DAY_MS = 86_400_000;
export const MAX_BUCKETS = 31; // sane upper bound for a single chart

// Indexed by Date.getDay() (0 = Sunday … 6 = Saturday).
export const RO_WEEKDAY_INITIALS = ['D', 'L', 'Ma', 'Mi', 'J', 'V', 'S'];
// Indexed by Date.getMonth() (0 = January … 11 = December).
export const RO_MONTHS = [
  'Ian',
  'Feb',
  'Mar',
  'Apr',
  'Mai',
  'Iun',
  'Iul',
  'Aug',
  'Sep',
  'Oct',
  'Noi',
  'Dec',
];

export type AnalyticsRange = 'week' | 'month' | 'year' | 'custom';
export type BucketPlan = { labels: string[]; assign: (d: Date) => number };

export function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// First day of the month `n` months after `d`.
export function monthStart(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

// Whole-month distance from `a` to `b` (calendar months, sign-aware).
export function monthDiff(a: Date, b: Date): number {
  return (
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  );
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// "dd.MM" — used for daily / weekly custom-range labels.
export function formatDayMonth(d: Date): string {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`;
}

// Resolve the [from, to] window and effective range from the request options.
export function resolveWindow(opts: {
  range?: 'week' | 'month' | 'year';
  from?: Date;
  to?: Date;
}): { range: AnalyticsRange; from: Date; to: Date } {
  if (opts.from && opts.to) {
    return {
      range: 'custom',
      from: startOfDay(opts.from),
      to: endOfDay(opts.to),
    };
  }

  const range = opts.range ?? 'week';
  const to = endOfDay(new Date());

  if (range === 'year') {
    // Last 12 calendar months, current month included as the final bucket.
    return { range, from: startOfDay(monthStart(new Date(), -11)), to };
  }

  const days = range === 'month' ? 30 : 7;
  return { range, from: startOfDay(addDays(new Date(), -(days - 1))), to };
}

// Build bucket labels + an appointment→bucket-index mapping for the window.
export function buildBuckets(
  range: AnalyticsRange,
  from: Date,
  to: Date,
): BucketPlan {
  if (range === 'week') {
    const labels = Array.from(
      { length: 7 },
      (_, i) => RO_WEEKDAY_INITIALS[addDays(from, i).getDay()],
    );
    return {
      labels,
      assign: (d) =>
        clamp(Math.floor((d.getTime() - from.getTime()) / DAY_MS), 0, 6),
    };
  }

  if (range === 'month') {
    return {
      labels: ['S1', 'S2', 'S3', 'S4'],
      assign: (d) =>
        clamp(
          Math.floor(Math.floor((d.getTime() - from.getTime()) / DAY_MS) / 7),
          0,
          3,
        ),
    };
  }

  if (range === 'year') {
    const labels = Array.from(
      { length: 12 },
      (_, i) => RO_MONTHS[monthStart(from, i).getMonth()],
    );
    return { labels, assign: (d) => clamp(monthDiff(from, d), 0, 11) };
  }

  return buildCustomBuckets(from, to);
}

// Custom range: pick daily / weekly / monthly granularity by span length.
export function buildCustomBuckets(from: Date, to: Date): BucketPlan {
  const spanDays =
    Math.floor(
      (startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS,
    ) + 1;

  if (spanDays <= 31) {
    const count = clamp(spanDays, 1, MAX_BUCKETS);
    const labels = Array.from({ length: count }, (_, i) =>
      formatDayMonth(addDays(from, i)),
    );
    return {
      labels,
      assign: (d) =>
        clamp(
          Math.floor((d.getTime() - from.getTime()) / DAY_MS),
          0,
          count - 1,
        ),
    };
  }

  if (spanDays <= 168) {
    const count = clamp(Math.ceil(spanDays / 7), 1, MAX_BUCKETS);
    const labels = Array.from({ length: count }, (_, i) =>
      formatDayMonth(addDays(from, i * 7)),
    );
    return {
      labels,
      assign: (d) =>
        clamp(
          Math.floor(Math.floor((d.getTime() - from.getTime()) / DAY_MS) / 7),
          0,
          count - 1,
        ),
    };
  }

  const count = clamp(monthDiff(from, to) + 1, 1, MAX_BUCKETS);
  const labels = Array.from(
    { length: count },
    (_, i) => RO_MONTHS[monthStart(from, i).getMonth()],
  );
  return {
    labels,
    assign: (d) => clamp(monthDiff(from, d), 0, count - 1),
  };
}
