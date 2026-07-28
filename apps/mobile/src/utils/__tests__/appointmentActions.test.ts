import { getAvailableStatusActions } from '../appointmentActions';

// Fixed reference time so tests are deterministic.
const NOW = new Date('2026-07-02T12:00:00.000Z');
const BEFORE_START = '2026-07-02T14:00:00.000Z'; // appointment 2h in the future
const AFTER_START = '2026-07-02T10:00:00.000Z';  // appointment started 2h ago

const statusesOf = (actions: ReturnType<typeof getAvailableStatusActions>) =>
  actions.map((a) => a.status);

describe('getAvailableStatusActions', () => {
  test('PENDING before start: accept, reject and cancel', () => {
    const actions = getAvailableStatusActions('PENDING', BEFORE_START, NOW);
    expect(statusesOf(actions)).toEqual(['CONFIRMED', 'REJECTED', 'CANCELLED']);
  });

  test('PENDING after start: still accept, reject and cancel', () => {
    const actions = getAvailableStatusActions('PENDING', AFTER_START, NOW);
    expect(statusesOf(actions)).toEqual(['CONFIRMED', 'REJECTED', 'CANCELLED']);
  });

  test('PENDING labels accept as "Acceptă" and reject as "Respinge"', () => {
    const actions = getAvailableStatusActions('PENDING', BEFORE_START, NOW);
    const labelByStatus = Object.fromEntries(
      actions.map((a) => [a.status, a.label]),
    );
    expect(labelByStatus.CONFIRMED).toBe('Acceptă');
    expect(labelByStatus.REJECTED).toBe('Respinge');
  });

  test('CONFIRMED before start: only cancel — no completed / no-show yet', () => {
    const actions = getAvailableStatusActions('CONFIRMED', BEFORE_START, NOW);
    expect(statusesOf(actions)).toEqual(['CANCELLED']);
  });

  test('CONFIRMED after start: completed, no-show and cancel', () => {
    const actions = getAvailableStatusActions('CONFIRMED', AFTER_START, NOW);
    expect(statusesOf(actions)).toEqual(['COMPLETED', 'NO_SHOW', 'CANCELLED']);
  });

  test('CONFIRMED exactly at start time counts as started', () => {
    const actions = getAvailableStatusActions(
      'CONFIRMED',
      NOW.toISOString(),
      NOW,
    );
    expect(statusesOf(actions)).toEqual(['COMPLETED', 'NO_SHOW', 'CANCELLED']);
  });

  test.each(['COMPLETED', 'CANCELLED', 'REJECTED', 'NO_SHOW'] as const)(
    'terminal status %s has no actions',
    (status) => {
      expect(getAvailableStatusActions(status, AFTER_START, NOW)).toEqual([]);
    },
  );

  test('invalid startAt is treated as not started (conservative gating)', () => {
    const actions = getAvailableStatusActions('CONFIRMED', 'not-a-date', NOW);
    expect(statusesOf(actions)).toEqual(['CANCELLED']);
  });

  test('every action exposes a label and a color for the UI', () => {
    const actions = getAvailableStatusActions('CONFIRMED', AFTER_START, NOW);
    for (const action of actions) {
      expect(action.label.length).toBeGreaterThan(0);
      expect(action.color).toMatch(/^#/);
    }
  });
});
