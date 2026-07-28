// =============================================================================
// Appointment status actions — PURE logic (type-only store import, no React
// Native imports) so it can be unit-tested in a plain Node/ts-jest environment.
//
// Business rule: "Marchează finalizat" (COMPLETED) and "Neprezentare" (NO_SHOW)
// must not be offered before the appointment's start time. Before start the
// salon can only accept/reject a pending request or cancel; once the start time
// has passed, the full set of transitions for the current status becomes
// available. REJECTED is terminal — no further actions.
// =============================================================================

import type { AppointmentStatus } from '../store/businessStore';
import { Colors } from '../theme';

export interface StatusAction {
  label: string;
  status: AppointmentStatus;
  color: string;
}

const ACCEPT_ACTION: StatusAction = {
  label: 'Acceptă',
  status: 'CONFIRMED',
  color: Colors.success,
};
const REJECT_ACTION: StatusAction = {
  label: 'Respinge',
  status: 'REJECTED',
  color: Colors.error,
};
const COMPLETE_ACTION: StatusAction = {
  label: 'Marchează finalizat',
  status: 'COMPLETED',
  color: Colors.success,
};
const NO_SHOW_ACTION: StatusAction = {
  label: 'Neprezentare',
  status: 'NO_SHOW',
  color: Colors.error,
};
const cancelAction = (color: string): StatusAction => ({
  label: 'Anulează',
  status: 'CANCELLED',
  color,
});

/**
 * Returns the status transitions the business UI may offer for an appointment,
 * given its current status and start time.
 *
 * An unparseable `startAt` is treated as "not started" so the time-gated
 * actions (complete / no-show) stay hidden on bad data.
 */
export function getAvailableStatusActions(
  status: AppointmentStatus,
  startAt: string,
  now: Date = new Date(),
): StatusAction[] {
  const startMs = new Date(startAt).getTime();
  const hasStarted = !Number.isNaN(startMs) && startMs <= now.getTime();

  if (status === 'PENDING') {
    return [ACCEPT_ACTION, REJECT_ACTION, cancelAction(Colors.gray500)];
  }

  if (status === 'CONFIRMED') {
    return hasStarted
      ? [COMPLETE_ACTION, NO_SHOW_ACTION, cancelAction(Colors.gray500)]
      : [cancelAction(Colors.gray500)];
  }

  // Terminal statuses (COMPLETED / CANCELLED / REJECTED / NO_SHOW) have no
  // transitions.
  return [];
}
