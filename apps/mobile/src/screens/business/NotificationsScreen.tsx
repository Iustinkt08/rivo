import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSize, FontWeight, Radius, Shadow, Spacing } from '../../theme';
import {
  AppNotification,
  NOTIFICATION_TYPE_CONFIG,
  useNotificationStore,
} from '../../store/notificationStore';
import { notificationsApi } from '../../services/api/notifications';
import { localDateKey } from '../../utils/calendarLayout';
import { backToSettings } from '../../components/business/SettingsHeader';

// ── Config ────────────────────────────────────────────────────────────────────
// Icons / colors per notification type live in the notification store so the
// business and client feeds render every server type consistently.

const TYPE_CONFIG = NOTIFICATION_TYPE_CONFIG;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days  = Math.floor(diffMs / 86_400_000);
  if (mins  < 1)  return 'Chiar acum';
  if (mins  < 60) return `Acum ${mins} min`;
  if (hours < 24) return `Acum ${hours}h`;
  if (days  < 7)  return `Acum ${days}z`;
  return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

// ── Notification row ──────────────────────────────────────────────────────────

function NotifRow({ notif, onPress }: { notif: AppNotification; onPress: () => void }) {
  const cfg = TYPE_CONFIG[notif.type];
  return (
    <TouchableOpacity
      style={[styles.row, !notif.isRead && styles.rowUnread]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Unread dot */}
      {!notif.isRead && <View style={styles.unreadDot} />}

      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
      </View>

      {/* Content */}
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowTitle, !notif.isRead && styles.rowTitleBold]} numberOfLines={1}>
            {notif.title}
          </Text>
          <Text style={styles.rowTime}>{formatRelative(notif.createdAt)}</Text>
        </View>
        <Text style={styles.rowBody} numberOfLines={2}>{notif.body}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="notifications-off-outline" size={40} color={Colors.gray300} />
      </View>
      <Text style={styles.emptyTitle}>Nicio notificare</Text>
      <Text style={styles.emptySubtitle}>Vei fi notificat când primești rezervări sau anulări.</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const router = useRouter();
  const { notifications, setNotifications, markRead, markAllRead } = useNotificationStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const load = useCallback(async () => {
    try {
      const fresh = await notificationsApi.getMine();
      setNotifications(fresh);
      setLoadError(false);
    } catch {
      // Keep whatever is already in the store; surface the failure visibly.
      setLoadError(true);
    }
  }, [setNotifications]);

  // Screen is pushed on demand, so mount ≈ focus.
  useEffect(() => { load(); }, [load]);

  const handlePress = useCallback((n: AppNotification) => {
    if (!n.isRead) {
      markRead(n.id);
      notificationsApi.markRead(n.id).catch(() => {});
    }
  }, [markRead]);

  const handleMarkAllRead = () => {
    markAllRead();
    notificationsApi.markAllRead().catch(() => {});
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  // Group: today vs earlier — compared on LOCAL calendar days (createdAt is UTC ISO).
  const todayKey = localDateKey(new Date());
  const isToday = (n: { createdAt: string }) =>
    localDateKey(new Date(n.createdAt)) === todayKey;
  const todayNotifs = notifications.filter(isToday);
  const earlierNotifs = notifications.filter((n) => !isToday(n));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => backToSettings(router)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.black} />
        </TouchableOpacity>

        <View>
          <Text style={styles.headerTitle}>Notificări</Text>
          {unreadCount > 0 && (
            <Text style={styles.headerSub}>{unreadCount} necitite</Text>
          )}
        </View>

        {unreadCount > 0 ? (
          <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllRead}>
            <Text style={styles.markAllText}>Marchează toate</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 90 }} />
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {loadError && (
          <TouchableOpacity style={styles.errorBanner} onPress={load} activeOpacity={0.8}>
            <Ionicons name="cloud-offline-outline" size={18} color={Colors.error} />
            <Text style={styles.errorText}>
              Nu am putut încărca notificările. Atinge pentru a reîncerca.
            </Text>
          </TouchableOpacity>
        )}

        {notifications.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {todayNotifs.length > 0 && (
              <View style={styles.group}>
                <Text style={styles.groupLabel}>Astăzi</Text>
                <View style={styles.groupCard}>
                  {todayNotifs.map((n, i) => (
                    <React.Fragment key={n.id}>
                      <NotifRow notif={n} onPress={() => handlePress(n)} />
                      {i < todayNotifs.length - 1 && <View style={styles.separator} />}
                    </React.Fragment>
                  ))}
                </View>
              </View>
            )}

            {earlierNotifs.length > 0 && (
              <View style={styles.group}>
                <Text style={styles.groupLabel}>Mai devreme</Text>
                <View style={styles.groupCard}>
                  {earlierNotifs.map((n, i) => (
                    <React.Fragment key={n.id}>
                      <NotifRow notif={n} onPress={() => handlePress(n)} />
                      {i < earlierNotifs.length - 1 && <View style={styles.separator} />}
                    </React.Fragment>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: 14,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderColor: Colors.border,
  },
  backBtn: {
    width: 38, height: 38, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.gray50, borderRadius: Radius.full,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black },
  headerSub: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold, marginTop: 1 },
  markAllBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  markAllText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    backgroundColor: '#FEE2E2', borderRadius: Radius.md, padding: Spacing.sm,
  },
  errorText: { flex: 1, fontSize: FontSize.xs, color: Colors.error, lineHeight: 17 },

  group: { marginHorizontal: Spacing.lg, marginTop: Spacing.md },
  groupLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.gray500,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  groupCard: {
    backgroundColor: Colors.white, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.sm,
  },

  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    position: 'relative',
  },
  rowUnread: { backgroundColor: Colors.primaryLight + '55' },
  unreadDot: {
    position: 'absolute', top: 18, left: 8,
    width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.sm, flexShrink: 0,
  },
  rowContent: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 3 },
  rowTitle: { flex: 1, fontSize: FontSize.sm, color: Colors.black, fontWeight: FontWeight.medium },
  rowTitleBold: { fontWeight: FontWeight.bold },
  rowTime: { fontSize: FontSize.xs, color: Colors.gray300, flexShrink: 0 },
  rowBody: { fontSize: FontSize.sm, color: Colors.gray500, lineHeight: 18 },
  separator: { height: 1, backgroundColor: Colors.gray50, marginLeft: 56 },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: Spacing.xl },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.gray50, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
  },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gray500, marginBottom: 8 },
  emptySubtitle: { fontSize: FontSize.sm, color: Colors.gray300, textAlign: 'center', lineHeight: 20 },
});
