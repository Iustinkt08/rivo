import { buildBuckets, resolveWindow } from './analytics-buckets';

describe('analytics-buckets — buildBuckets', () => {
  const FROM = new Date(2026, 6, 6); // Monday, 6 July 2026 (local)
  const TO = new Date(2026, 6, 12);

  it('builds 7 daily buckets with Romanian weekday initials for a week', () => {
    // Act
    const { labels, assign } = buildBuckets('week', FROM, TO);

    // Assert
    expect(labels).toHaveLength(7);
    expect(labels[0]).toBe('L'); // Monday
    expect(assign(new Date(2026, 6, 6, 10))).toBe(0);
    expect(assign(new Date(2026, 6, 12, 10))).toBe(6);
  });

  it('builds 4 weekly buckets labelled S1-S4 for a month', () => {
    // Act
    const { labels, assign } = buildBuckets(
      'month',
      new Date(2026, 5, 13),
      new Date(2026, 6, 12),
    );

    // Assert
    expect(labels).toEqual(['S1', 'S2', 'S3', 'S4']);
    expect(assign(new Date(2026, 5, 14))).toBe(0);
    expect(assign(new Date(2026, 6, 12))).toBe(3);
  });

  it('builds daily dd.MM buckets for a custom range of up to 31 days', () => {
    // Act
    const { labels } = buildBuckets(
      'custom',
      new Date(2026, 0, 1),
      new Date(2026, 0, 10),
    );

    // Assert
    expect(labels).toHaveLength(10);
    expect(labels[0]).toBe('01.01');
    expect(labels[9]).toBe('10.01');
  });
});

describe('analytics-buckets — resolveWindow', () => {
  it('treats an explicit from/to pair as a custom full-day range', () => {
    // Arrange
    const from = new Date(2026, 0, 5, 14, 30);
    const to = new Date(2026, 0, 20, 9, 15);

    // Act
    const window = resolveWindow({ from, to });

    // Assert
    expect(window.range).toBe('custom');
    expect(window.from.getHours()).toBe(0);
    expect(window.to.getHours()).toBe(23);
  });

  it('defaults to the last 7 days when no options are given', () => {
    // Act
    const window = resolveWindow({});

    // Assert
    expect(window.range).toBe('week');
    const spanDays = Math.round(
      (window.to.getTime() - window.from.getTime()) / 86_400_000,
    );
    expect(spanDays).toBe(7);
  });
});
