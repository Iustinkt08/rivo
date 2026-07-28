import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Radius, Shadow, Spacing } from '../../theme';
import {
  NotificationPreferences,
  notificationsApi,
} from '../../services/api/notifications';

// ── Config ────────────────────────────────────────────────────────────────────

interface PreferenceRow {
  key: keyof NotificationPreferences;
  label: string;
  icon: string;
}

const PREFERENCE_ROWS: PreferenceRow[] = [
  { key: 'onAccepted',       label: 'Programare acceptată', icon: 'checkmark-circle-outline' },
  { key: 'onRejected',       label: 'Programare respinsă',  icon: 'remove-circle-outline' },
  { key: 'onCancelled',      label: 'Anulare',              icon: 'close-circle-outline' },
  { key: 'onRescheduled',    label: 'Programare mutată',    icon: 'swap-horizontal-outline' },
  { key: 'onPriceChange',    label: 'Modificare preț',      icon: 'pricetag-outline' },
  { key: 'onDurationChange', label: 'Modificare durată',    icon: 'timer-outline' },
  { key: 'onReview',         label: 'Recenzii',             icon: 'star-outline' },
  { key: 'onReminder',       label: 'Remindere',            icon: 'alarm-outline' },
];

// ── Screen ────────────────────────────────────────────────────────────────────

export default function NotificationSettingsScreen() {
  const router = useRouter();

  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [toggleError, setToggleError] = useState(false);

  const load = useCallback(() => {
    setLoadFailed(false);
    notificationsApi.getPreferences()
      .then(setPrefs)
      .catch(() => setLoadFailed(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Optimistic toggle: flip locally, PATCH the single flag, revert on failure.
  const handleToggle = useCallback(
    (key: keyof NotificationPreferences, value: boolean) => {
      setToggleError(false);
      setPrefs((prev) => (prev ? { ...prev, [key]: value } : prev));
      notificationsApi.updatePreferences({ [key]: value }).catch(() => {
        setPrefs((prev) => (prev ? { ...prev, [key]: !value } : prev));
        setToggleError(true);
      });
    },
    [],
  );

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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Primește notificări pentru</Text>

        {toggleError && (
          <View style={styles.errorBanner}>
            <Ionicons name="cloud-offline-outline" size={18} color={Colors.error} />
            <Text style={styles.errorBannerText}>
              Nu s-a putut salva preferința. Încearcă din nou.
            </Text>
          </View>
        )}

        {loadFailed ? (
          <TouchableOpacity style={styles.errorCard} onPress={load} activeOpacity={0.8}>
            <Ionicons name="cloud-offline-outline" size={36} color={Colors.gray300} />
            <Text style={styles.errorTitle}>Nu am putut încărca preferințele</Text>
            <Text style={styles.errorText}>Atinge pentru a reîncerca.</Text>
          </TouchableOpacity>
        ) : !prefs ? (
          <View style={styles.loaderCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <View style={styles.card}>
            {PREFERENCE_ROWS.map((row, i) => (
              <View
                key={row.key}
                style={[styles.row, i < PREFERENCE_ROWS.length - 1 && styles.rowBorder]}
              >
                <View style={styles.iconChip}>
                  <Ionicons name={row.icon as any} size={18} color={Colors.primary} />
                </View>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Switch
                  value={prefs[row.key]}
                  onValueChange={(value) => handleToggle(row.key, value)}
                  trackColor={{ false: Colors.gray300, true: Colors.primary }}
                  thumbColor={Colors.white}
                />
              </View>
            ))}
          </View>
        )}

        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
          <Text style={styles.infoText}>
            Dezactivarea unui tip oprește doar notificările din aplicație pentru
            acel tip — programările tale nu sunt afectate.
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

  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 130 },

  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black },

  card: {
    backgroundColor: Colors.white, borderRadius: Radius.xl,
    overflow: 'hidden', ...Shadow.sm,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.gray100,
  },
  iconChip: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: {
    flex: 1, fontSize: FontSize.md, color: Colors.ink,
    fontWeight: FontWeight.medium,
  },

  loaderCard: {
    backgroundColor: Colors.white, borderRadius: Radius.xl,
    padding: Spacing.xl, alignItems: 'center', ...Shadow.sm,
  },

  errorCard: {
    backgroundColor: Colors.white, borderRadius: Radius.xl,
    padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm, ...Shadow.sm,
  },
  errorTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gray500 },
  errorText: { fontSize: FontSize.sm, color: Colors.gray300, textAlign: 'center' },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEE2E2', borderRadius: Radius.lg, padding: Spacing.md,
  },
  errorBannerText: { flex: 1, fontSize: FontSize.xs, color: Colors.error, lineHeight: 17 },

  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.md,
  },
  infoText: { flex: 1, fontSize: FontSize.xs, color: Colors.primary, lineHeight: 18 },
});
