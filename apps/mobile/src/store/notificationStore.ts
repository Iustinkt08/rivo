import { create } from 'zustand';
import { Colors } from '../theme';

export type NotificationType =
  | 'NEW_BOOKING'
  | 'BOOKING_ACCEPTED'
  | 'BOOKING_REJECTED'
  | 'CANCELLATION'
  | 'RESCHEDULED'
  | 'PRICE_CHANGE'
  | 'DURATION_CHANGE'
  | 'NO_SHOW'
  | 'REVIEW'
  | 'REMINDER';

export interface NotificationTypeConfig {
  /** Ionicons name rendered in the notification row. */
  icon: string;
  color: string;
  bg: string;
  /** Short Romanian label for the type. */
  label: string;
}

/**
 * Single source of truth for how each notification type is rendered
 * (business + client feeds). Adding a server type: extend the union above and
 * add an entry here — the Record type keeps the two in sync at compile time.
 */
export const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, NotificationTypeConfig> = {
  NEW_BOOKING:      { icon: 'calendar',         color: Colors.primary, bg: Colors.primaryLight, label: 'Programare nouă' },
  BOOKING_ACCEPTED: { icon: 'checkmark-circle', color: Colors.success, bg: '#DCFCE7',           label: 'Acceptată' },
  BOOKING_REJECTED: { icon: 'remove-circle',    color: Colors.error,   bg: '#FEE2E2',           label: 'Respinsă' },
  CANCELLATION:     { icon: 'close-circle',     color: Colors.error,   bg: '#FEE2E2',           label: 'Anulare' },
  RESCHEDULED:      { icon: 'swap-horizontal',  color: '#7C3AED',      bg: '#EDE9FE',           label: 'Mutată' },
  PRICE_CHANGE:     { icon: 'pricetag',         color: Colors.warning, bg: '#FEF3C7',           label: 'Preț modificat' },
  DURATION_CHANGE:  { icon: 'timer',            color: '#0EA5E9',      bg: '#E0F2FE',           label: 'Durată modificată' },
  NO_SHOW:          { icon: 'person-remove',    color: Colors.warning, bg: '#FEF3C7',           label: 'Neprezentare' },
  REVIEW:           { icon: 'star',             color: Colors.star,    bg: '#FFF9E6',           label: 'Recenzie' },
  REMINDER:         { icon: 'notifications',    color: '#0EA5E9',      bg: '#E0F2FE',           label: 'Reminder' },
};

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string; // ISO
  isRead: boolean;
  appointmentId?: string;
}

interface NotificationState {
  notifications: AppNotification[];
  pushToken: string | null;
  setNotifications: (n: AppNotification[]) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  addNotification: (n: AppNotification) => void;
  setPushToken: (token: string) => void;
  unreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  pushToken: null,

  setNotifications: (notifications) => set({ notifications }),
  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      ),
    })),
  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
    })),
  addNotification: (n) =>
    set((state) => ({ notifications: [n, ...state.notifications] })),
  setPushToken: (token) => set({ pushToken: token }),
  unreadCount: () => get().notifications.filter((n) => !n.isRead).length,
}));
