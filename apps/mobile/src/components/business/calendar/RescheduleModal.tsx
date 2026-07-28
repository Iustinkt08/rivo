import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../../theme';
import type { BusinessAppointment } from '../../../store/businessStore';
import { START_HOUR, END_HOUR, SLOT_SNAP_MIN } from './constants';
import { localDateKey } from '../../../utils/calendarLayout';

interface Props {
  appt: BusinessAppointment | null;
  onClose: () => void;
  /**
   * Attempt the reschedule; resolve `true` to close the modal, `false` to keep
   * it open (e.g. 409 slot taken → the owner picks another hour).
   */
  onConfirm: (appt: BusinessAppointment, dateStr: string, timeStr: string) => Promise<boolean>;
}

const DAYS_AHEAD = 14;

// Visual language mirrors the redesigned BookingScreen: hairline pill chips,
// selection = primaryLight surface + primary border.
const SUBTLE_BORDER = 'rgba(216,216,216,0.8)';

function buildNextDays(n = DAYS_AHEAD): { date: string; label: string; dayNum: string }[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      label: i === 0 ? 'Azi' : d.toLocaleDateString('ro-RO', { weekday: 'short' }),
      dayNum: String(d.getDate()).padStart(2, '0'),
    };
  });
}

function buildTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_SNAP_MIN) {
      if (h === END_HOUR && m > 0) break;
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
}
const TIME_SLOTS = buildTimeSlots();

function localTimeKey(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Bottom sheet for manually moving an appointment to another day/hour. */
export default function RescheduleModal({ appt, onClose, onConfirm }: Props) {
  const days = useMemo(() => buildNextDays(), []);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Preselect the appointment's current day/hour each time the sheet opens.
  useEffect(() => {
    if (appt) {
      setSelectedDay(localDateKey(new Date(appt.startAt)));
      setSelectedTime(localTimeKey(appt.startAt));
      setSaving(false);
    }
  }, [appt?.id, appt?.startAt]);

  if (!appt) return null;

  const unchanged =
    selectedDay === localDateKey(new Date(appt.startAt)) &&
    selectedTime === localTimeKey(appt.startAt);
  const canSave = !!selectedDay && !!selectedTime && !unchanged && !saving;

  const handleConfirm = async () => {
    if (!selectedDay || !selectedTime) return;
    setSaving(true);
    try {
      const shouldClose = await onConfirm(appt, selectedDay, selectedTime);
      if (shouldClose) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Modifică data/ora</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {appt.clientName} · {appt.serviceName}
        </Text>

        <Text style={styles.sectionLabel}>Ziua</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
          {days.map((d) => {
            const active = selectedDay === d.date;
            return (
              <TouchableOpacity
                key={d.date}
                style={[styles.dayChip, active && styles.chipActive]}
                onPress={() => setSelectedDay(d.date)}
              >
                <Text style={[styles.dayLabel, active && styles.textActive]}>{d.label}</Text>
                <Text style={[styles.dayNum, active && styles.textActive]}>{d.dayNum}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionLabel}>Ora</Text>
        <View style={styles.timeGridWrap}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.timeGrid}>
              {TIME_SLOTS.map((slot) => {
                const active = selectedTime === slot;
                return (
                  <TouchableOpacity
                    key={slot}
                    style={[styles.timeChip, active && styles.chipActive]}
                    onPress={() => setSelectedTime(slot)}
                  >
                    <Text style={[styles.timeText, active && styles.textActive]}>{slot}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, !canSave && { opacity: 0.4 }]}
          disabled={!canSave}
          onPress={handleConfirm}
        >
          {saving ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="calendar-outline" size={17} color={Colors.white} />
              <Text style={styles.saveBtnText}>
                Mută programarea{selectedTime ? ` la ${selectedTime}` : ''}
              </Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelBtnText}>Renunță</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, paddingBottom: 34, maxHeight: '88%',
  },
  handle: { width: 40, height: 4, backgroundColor: Colors.gray300, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.semibold, color: Colors.primary },
  subtitle: { fontSize: FontSize.sm, color: 'rgba(34,34,34,0.65)', marginTop: 2, marginBottom: Spacing.sm },

  sectionLabel: {
    fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.gray700,
    marginTop: Spacing.md, marginBottom: 8,
  },
  dayRow: { gap: 8, paddingBottom: 2 },
  dayChip: {
    width: 56, alignItems: 'center', paddingVertical: 10,
    borderRadius: Radius.xl, backgroundColor: Colors.white,
    borderWidth: 1, borderColor: SUBTLE_BORDER,
  },
  dayLabel: { fontSize: FontSize.xs, color: Colors.gray500, fontWeight: FontWeight.medium },
  dayNum: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black, marginTop: 2 },

  timeGridWrap: { maxHeight: 176 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 4 },
  timeChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.pill,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: SUBTLE_BORDER,
    minWidth: 62, alignItems: 'center',
  },
  timeText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.gray700 },

  chipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  textActive: { color: Colors.primary },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.pill, padding: 15, marginTop: Spacing.md,
  },
  saveBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  cancelBtn: { padding: 12, alignItems: 'center' },
  cancelBtnText: { fontSize: FontSize.md, color: Colors.gray500, fontWeight: FontWeight.medium },
});
