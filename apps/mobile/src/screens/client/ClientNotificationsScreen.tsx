import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, RefreshControl, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { Colors, FontSize, FontWeight, Radius, Shadow, Spacing } from '../../theme';
import { AppNotification, NOTIFICATION_TYPE_CONFIG } from '../../store/notificationStore';
import { notificationsApi } from '../../services/api/notifications';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScheduledReminder {
  id: string;
  title: string;
  body: string;
  triggerDate: Date;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);
  if (mins < 1) return 'Chiar acum';
  if (mins < 60) return `Acum ${mins} min`;
  if (hours < 24) return `Acum ${hours}h`;
  if (days < 7) return `Acum ${days}z`;
  return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

function formatTrigger(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffH = Math.round(diffMs / 3_600_000);
  const diffD = Math.round(diffMs / 86_400_000);

  if (diffMs < 0) return 'Trecut';
  if (diffH < 1)  return 'În curând';
  if (diffH < 24) return `Peste ${diffH}h`;
  if (diffD === 1) return 'Mâine';
  return date.toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ClientNotificationsScreen() {
  const router = useRouter();
  const [reminders, setReminders] = useState<ScheduledReminder[]>([]);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [serverNotifs, setServerNotifs] = useState<AppNotification[]>([]);
  const [serverError, setServerError] = useState(false);

  const loadServerNotifications = useCallback(async () => {
    try {
      const fresh = await notificationsApi.getMine();
      setServerNotifs(fresh);
      setServerError(false);
    } catch {
      // Keep the last known list; show a visible error row instead of failing silently.
      setServerError(true);
    }
  }, []);

  const handleNotifPress = useCallback((n: AppNotification) => {
    if (!n.isRead) {
      setServerNotifs((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)),
      );
      notificationsApi.markRead(n.id).catch(() => {});
    }
    // Booking-related notification → open the appointment detail with live
    // data (the detail screen fetches by id).
    if (n.appointmentId) {
      router.push({
        pathname: '/appointment-detail',
        params: { id: n.appointmentId },
      });
    }
  }, [router]);

  const load = useCallback(async () => {
    loadServerNotifications();
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setPermissionGranted(status === 'granted');

      if (status === 'granted') {
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        const mapped: ScheduledReminder[] = scheduled
          .map((n) => {
            const trigger = n.trigger as any;
            const triggerDate = trigger?.value
              ? new Date(trigger.value * 1000)   // iOS: epoch seconds
              : trigger?.date
                ? new Date(trigger.date)          // Android: date object
                : null;
            if (!triggerDate) return null;
            return {
              id: n.identifier,
              title: n.content.title ?? 'Notificare',
              body: n.content.body ?? '',
              triggerDate,
            };
          })
          .filter((x): x is ScheduledReminder => x !== null)
          .sort((a, b) => a.triggerDate.getTime() - b.triggerDate.getTime());
        setReminders(mapped);
      }
    } catch {
      setPermissionGranted(false);
    }
  }, [loadServerNotifications]);

  useEffect(() => { load(); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleRequestPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setPermissionGranted(status === 'granted');
    if (status === 'granted') load();
  };

  const handleCancel = (id: string, title: string) => {
    Alert.alert(
      'Șterge reminder',
      `Ești sigur că vrei să anulezi "${title}"?`,
      [
        { text: 'Nu', style: 'cancel' },
        {
          text: 'Șterge',
          style: 'destructive',
          onPress: async () => {
            await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
            setReminders((prev) => prev.filter((r) => r.id !== id));
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={Colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notificări</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
        contentContainerStyle={styles.content}
      >
        {/* Permission banner */}
        {permissionGranted === false && (
          <TouchableOpacity style={styles.permBanner} onPress={handleRequestPermission} activeOpacity={0.85}>
            <Ionicons name="notifications-off-outline" size={22} color={Colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.permTitle}>Notificările sunt dezactivate</Text>
              <Text style={styles.permSub}>Atinge pentru a activa și a primi remindere pentru programări.</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.warning} />
          </TouchableOpacity>
        )}

        {/* Server notifications (booking confirmations, salon messages) */}
        <Text style={styles.sectionTitle}>
          Notificări
          {serverNotifs.length > 0 && (
            <Text style={styles.sectionCount}> ({serverNotifs.length})</Text>
          )}
        </Text>

        {serverError && (
          <TouchableOpacity style={styles.errorBanner} onPress={loadServerNotifications} activeOpacity={0.8}>
            <Ionicons name="cloud-offline-outline" size={18} color={Colors.error} />
            <Text style={styles.errorBannerText}>
              Nu am putut încărca notificările. Atinge pentru a reîncerca.
            </Text>
          </TouchableOpacity>
        )}

        {!serverError && serverNotifs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="notifications-off-outline" size={36} color={Colors.gray300} />
            <Text style={styles.emptyTitle}>Nicio notificare</Text>
            <Text style={styles.emptyText}>
              Aici vei vedea confirmările și mesajele legate de programările tale.
            </Text>
          </View>
        ) : serverNotifs.length > 0 ? (
          <View style={styles.list}>
            {serverNotifs.map((n) => {
              const typeCfg = NOTIFICATION_TYPE_CONFIG[n.type];
              return (
              <TouchableOpacity
                key={n.id}
                style={styles.row}
                activeOpacity={0.7}
                onPress={() => handleNotifPress(n)}
              >
                <View style={[styles.rowIcon, { backgroundColor: typeCfg.bg }]}>
                  <Ionicons
                    name={typeCfg.icon as any}
                    size={20}
                    color={typeCfg.color}
                  />
                </View>
                <View style={styles.rowContent}>
                  <View style={styles.notifTopRow}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {n.title}
                    </Text>
                    {!n.isRead && <View style={styles.notifUnreadDot} />}
                  </View>
                  <Text style={styles.rowBody} numberOfLines={2}>{n.body}</Text>
                  <View style={styles.rowMeta}>
                    <Ionicons name="time-outline" size={12} color={Colors.gray500} />
                    <Text style={styles.rowTime}>{formatRelative(n.createdAt)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {/* Upcoming reminders */}
        {permissionGranted && (
          <>
            <Text style={styles.sectionTitle}>
              Remindere programate
              {reminders.length > 0 && (
                <Text style={styles.sectionCount}> ({reminders.length})</Text>
              )}
            </Text>

            {reminders.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="alarm-outline" size={36} color={Colors.gray300} />
                <Text style={styles.emptyTitle}>Niciun reminder activ</Text>
                <Text style={styles.emptyText}>
                  Când faci o rezervare, vei primi automat un reminder cu 1 oră înainte.
                </Text>
              </View>
            ) : (
              <View style={styles.list}>
                {reminders.map((r) => (
                  <View key={r.id} style={styles.row}>
                    <View style={styles.rowIcon}>
                      <Ionicons name="alarm-outline" size={20} color={Colors.primary} />
                    </View>
                    <View style={styles.rowContent}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{r.title}</Text>
                      <Text style={styles.rowBody} numberOfLines={2}>{r.body}</Text>
                      <View style={styles.rowMeta}>
                        <Ionicons name="time-outline" size={12} color={Colors.gray500} />
                        <Text style={styles.rowTime}>{formatTrigger(r.triggerDate)}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleCancel(r.id, r.title)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.deleteBtn}
                    >
                      <Ionicons name="trash-outline" size={16} color={Colors.gray300} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* Info card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
          <Text style={styles.infoText}>
            Remindere locale sunt programate automat cu 1 oră înainte de fiecare programare.
            Confirmările și anulările de la salon apar în secțiunea „Notificări" de mai sus.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black },

  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },

  // Permission banner
  permBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: '#FEF3C7', borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: '#FDE68A',
  },
  permTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gray700 },
  permSub: { fontSize: FontSize.xs, color: Colors.gray500, marginTop: 2 },

  sectionTitle: {
    fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black,
  },
  sectionCount: { color: Colors.gray500, fontWeight: FontWeight.medium },

  // Empty state
  emptyCard: {
    backgroundColor: Colors.white, borderRadius: Radius.xl,
    padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm, ...Shadow.sm,
  },
  emptyTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gray500 },
  emptyText: { fontSize: FontSize.sm, color: Colors.gray300, textAlign: 'center', lineHeight: 20 },

  // List
  list: { backgroundColor: Colors.white, borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.sm },
  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.gray50,
  },
  rowIcon: {
    width: 40, height: 40, borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.sm, flexShrink: 0,
  },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.black, marginBottom: 2 },
  rowBody: { fontSize: FontSize.xs, color: Colors.gray500, lineHeight: 17, marginBottom: 5 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowTime: { fontSize: FontSize.xs, color: Colors.gray500 },
  deleteBtn: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.full, backgroundColor: Colors.gray50, marginLeft: 4,
  },

  // Server notifications
  notifTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notifUnreadDot: {
    width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary, flexShrink: 0,
  },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEE2E2', borderRadius: Radius.lg, padding: Spacing.md,
  },
  errorBannerText: { flex: 1, fontSize: FontSize.xs, color: Colors.error, lineHeight: 17 },

  // Info card
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.md,
  },
  infoText: { flex: 1, fontSize: FontSize.xs, color: Colors.primary, lineHeight: 18 },
});
