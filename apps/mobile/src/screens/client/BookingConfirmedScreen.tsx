import React, { useEffect, useState } from 'react';
import {
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import Button from '../../components/common/Button';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';

// ── Visual constants (NAVIRA look — mirrors HomeScreen) ──────────────────────
const H_PAD = 28;                               // screen horizontal padding
const SUBTLE_BORDER = 'rgba(216,216,216,0.8)';  // hairline card border
const MUTED = 'rgba(34,34,34,0.65)';            // secondary text

export default function BookingConfirmedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [reminderScheduled, setReminderScheduled] = useState(false);

  const salonName = params.salonName as string;
  const service = params.service as string;
  const dateParam = params.date as string | undefined; // expected "YYYY-MM-DD"
  const time = params.time as string | undefined;      // expected "HH:MM"

  // Parse the appointment date ONCE, defensively. Passing an Invalid Date to
  // native modules (notifications) crashes the app, so everything downstream
  // must go through this guard.
  const parsedDate = dateParam ? new Date(`${dateParam}T12:00:00`) : null;
  const isDateValid = !!parsedDate && !Number.isNaN(parsedDate.getTime());
  const dateLabel = isDateValid
    ? parsedDate.toLocaleDateString('ro-RO', { weekday: 'long', day: '2-digit', month: 'long' })
    : dateParam ?? '—';

  // Schedule a local reminder 1h before the appointment
  useEffect(() => {
    (async () => {
      try {
        // Never schedule with an invalid/missing date or time.
        if (!isDateValid || !time) return;
        const [h, m] = time.split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return;

        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;

        const apptDate = new Date(parsedDate!);
        apptDate.setHours(h, m, 0, 0);
        const reminderTime = new Date(apptDate.getTime() - 60 * 60 * 1000); // 1h before

        if (Number.isNaN(reminderTime.getTime()) || reminderTime <= new Date()) return;

        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Programare în 1 oră! ⏰',
            body: `${service} la ${salonName} la ora ${time}`,
            data: { screen: 'bookings' },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderTime },
        });
        setReminderScheduled(true);
      } catch {
        // Notifications not available (simulator / denied) — skip silently
      }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Success Icon */}
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={80} color={Colors.success} />
        </View>

        {/* Title */}
        <Text style={styles.title}>Programare confirmată!</Text>
        <Text style={styles.subtitle}>Rezervarea ta a fost salvată cu succes</Text>

        {/* Booking Details */}
        <View style={styles.detailsCard}>
          <DetailRow label="Salon" value={salonName} />
          <DetailRow label="Serviciu" value={service} />
          <DetailRow label="Data" value={dateLabel} />
          <DetailRow label="Ora" value={time ?? '—'} />
        </View>

        {/* Reminders */}
        <View style={styles.reminderBox}>
          <Ionicons
            name={reminderScheduled ? 'alarm-outline' : 'information-circle'}
            size={20}
            color={Colors.warning}
          />
          <Text style={styles.reminderText}>
            {reminderScheduled
              ? 'Vei primi o notificare cu 1 oră înainte de programare.'
              : 'Activează notificările pentru a primi un reminder cu 1 oră înainte.'}
          </Text>
        </View>

        {/* Buttons */}
        <Button
          title="Mergi la programări"
          fullWidth
          onPress={() => router.navigate('/(client)/bookings')}
          style={{ marginTop: Spacing.xl }}
        />
        <Button
          title="Înapoi la acasă"
          variant="outline"
          fullWidth
          onPress={() => router.navigate('/(client)/')}
          style={{ marginTop: Spacing.md }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },

  content: {
    paddingHorizontal: H_PAD, paddingVertical: Spacing.lg,
    paddingBottom: Spacing.xl, alignItems: 'center',
  },

  // Success icon in a soft neutral circle
  successIcon: {
    width: 112, height: 112, borderRadius: 56,
    backgroundColor: Colors.gray50,
    alignItems: 'center', justifyContent: 'center',
    marginVertical: Spacing.xl,
  },
  title: { fontSize: 22, fontWeight: FontWeight.semibold, color: Colors.ink, marginBottom: 8 },
  subtitle: { fontSize: FontSize.md, color: MUTED, marginBottom: Spacing.lg },

  // Details — white pill card with hairline border (like Home ProCard)
  detailsCard: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: SUBTLE_BORDER,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderColor: Colors.gray50,
  },
  detailLabel: { fontSize: FontSize.sm, color: MUTED, fontWeight: FontWeight.medium },
  detailValue: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: '#222' },

  reminderBox: {
    width: '100%',
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: '#FEF3C7',
    borderRadius: Radius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
    alignItems: 'flex-start',
  },
  reminderText: { flex: 1, fontSize: FontSize.sm, color: Colors.gray700, lineHeight: 20 },
});
