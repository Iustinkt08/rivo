import { api } from './client';
import { AppNotification } from '../../store/notificationStore';
import { mapServerNotifications } from '../../utils/notificationMapping';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Mirrors the backend's 8-boolean preference shape (GET/PATCH /notifications/preferences). */
export interface NotificationPreferences {
  onAccepted: boolean;
  onRejected: boolean;
  onCancelled: boolean;
  onRescheduled: boolean;
  onPriceChange: boolean;
  onDurationChange: boolean;
  onReview: boolean;
  onReminder: boolean;
}

export const PREFERENCE_KEYS: (keyof NotificationPreferences)[] = [
  'onAccepted',
  'onRejected',
  'onCancelled',
  'onRescheduled',
  'onPriceChange',
  'onDurationChange',
  'onReview',
  'onReminder',
];

// Defensive mapping: never trust the payload shape, default every flag to true
// (matches the backend defaults for users without a preference row).
function mapPreferences(raw: any): NotificationPreferences {
  const source = raw?.data ?? raw ?? {};
  return PREFERENCE_KEYS.reduce(
    (acc, key) => ({ ...acc, [key]: source[key] !== false }),
    {} as NotificationPreferences,
  );
}

// ── API ───────────────────────────────────────────────────────────────────────
// Server contract: GET /notifications/me → [{ id, title, body, data, isRead, sentAt }]

export const notificationsApi = {
  async getMine(): Promise<AppNotification[]> {
    const { data } = await api.get('/notifications/me');
    return mapServerNotifications(data);
  },

  async markRead(id: string): Promise<void> {
    await api.patch(`/notifications/${id}/read`);
  },

  async markAllRead(): Promise<void> {
    await api.patch('/notifications/read-all');
  },

  async getPreferences(): Promise<NotificationPreferences> {
    const { data } = await api.get('/notifications/preferences');
    return mapPreferences(data);
  },

  async updatePreferences(
    patch: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    const { data } = await api.patch('/notifications/preferences', patch);
    return mapPreferences(data);
  },
};
