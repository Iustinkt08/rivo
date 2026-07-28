import { AppNotification, NotificationType } from '../store/notificationStore';

// Known server notification types — anything else falls back to REMINDER so the
// UI always has an icon/color config to render.
const KNOWN_TYPES: NotificationType[] = [
  'NEW_BOOKING',
  'BOOKING_ACCEPTED',
  'BOOKING_REJECTED',
  'CANCELLATION',
  'RESCHEDULED',
  'PRICE_CHANGE',
  'DURATION_CHANGE',
  'NO_SHOW',
  'REVIEW',
  'REMINDER',
];

function coerceType(raw: unknown): NotificationType {
  return KNOWN_TYPES.includes(raw as NotificationType)
    ? (raw as NotificationType)
    : 'REMINDER';
}

/**
 * Maps one server notification (GET /notifications/me shape) to the local
 * AppNotification used by the notification store and screens.
 * Server shape: { id, title, body, data: { type, appointmentId } | null, isRead, sentAt }
 */
export function mapServerNotification(n: any): AppNotification {
  return {
    id: String(n.id),
    type: coerceType(n?.data?.type),
    title: n.title ?? 'Notificare',
    body: n.body ?? '',
    createdAt: n.sentAt ?? new Date().toISOString(),
    isRead: Boolean(n.isRead),
    appointmentId: n?.data?.appointmentId ?? undefined,
  };
}

/** Maps a server list response defensively (tolerates envelope or bad input). */
export function mapServerNotifications(payload: any): AppNotification[] {
  const list = Array.isArray(payload) ? payload : (payload?.data ?? []);
  if (!Array.isArray(list)) return [];
  return list.map(mapServerNotification);
}
