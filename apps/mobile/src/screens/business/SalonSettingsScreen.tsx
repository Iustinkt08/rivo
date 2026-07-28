import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Switch,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSize, FontWeight, Radius, Shadow, Spacing } from '../../theme';
import SettingsHeader from '../../components/business/SettingsHeader';
import { useBusinessStore } from '../../store/businessStore';
import { businessApi } from '../../services/api/business';
import {
  DAY_LABELS_RO, EditableDayHours, WEEK_DAYS,
  findInvalidDays, toOpeningHoursPayload,
} from '../../utils/openingHours';

const DEFAULT_HOURS: EditableDayHours[] = WEEK_DAYS.map((day) => ({
  day,
  open: day === 'SATURDAY' ? '10:00' : '09:00',
  close: day === 'SATURDAY' ? '17:00' : '19:00',
  isOpen: day !== 'SUNDAY',
}));

/**
 * Hub screen "Datele salonului": groups every salon-data editor (identity,
 * location, gallery) and hosts the opening-hours editor with its own
 * contextual save — there is no global save button anymore.
 */
export default function SalonSettingsScreen() {
  const router = useRouter();
  const { salonProfile, setSalonProfile } = useBusinessStore();
  const [hours, setHours] = useState<EditableDayHours[]>(DEFAULT_HOURS);
  const [savingHours, setSavingHours] = useState(false);
  const [hoursDirty, setHoursDirty] = useState(false);

  // Load the salon profile (if missing) and pre-populate the hours editor.
  useEffect(() => {
    const load = async () => {
      const p = salonProfile ?? await businessApi.getSalonProfile().catch(() => null);
      if (!p) return;
      if (!salonProfile) setSalonProfile(p);
      if (p.openingHours.length > 0) {
        const byDay = Object.fromEntries(p.openingHours.map((h) => [h.dayOfWeek, h]));
        setHours(DEFAULT_HOURS.map((d) => {
          const h = byDay[d.day];
          return h ? { ...d, open: h.openTime, close: h.closeTime, isOpen: !h.isClosed } : d;
        }));
      }
    };
    load();
  }, []);

  const updateDay = (day: string, patch: Partial<EditableDayHours>) => {
    setHours((prev) => prev.map((h) => (h.day === day ? { ...h, ...patch } : h)));
    setHoursDirty(true);
  };

  const handleSaveHours = async () => {
    const id = salonProfile?.id;
    if (!id) {
      Alert.alert('Niciun salon', 'Nu am găsit salonul tău. Reîncarcă pagina și încearcă din nou.');
      return;
    }
    const invalid = findInvalidDays(hours);
    if (invalid.length > 0) {
      const days = invalid.map((d) => DAY_LABELS_RO[d] ?? d).join(', ');
      Alert.alert('Ore invalide', `Verifică formatul orelor (HH:MM) pentru: ${days}.`);
      return;
    }
    setSavingHours(true);
    try {
      const payload = toOpeningHoursPayload(hours);
      await businessApi.setOpeningHours(id, payload);
      setSalonProfile({ ...salonProfile!, openingHours: payload });
      setHoursDirty(false);
      Alert.alert('Salvat', 'Programul de lucru a fost actualizat.');
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut salva programul. Încearcă din nou.');
    } finally {
      setSavingHours(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SettingsHeader title="Datele salonului" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Editors — each opens a screen with its own contextual save ── */}
        <Text style={styles.groupTitle}>Profil</Text>
        <View style={styles.card}>
          <HubRow
            first
            icon="storefront-outline"
            label="Identitate"
            subtitle="Nume, descriere & date de contact"
            onPress={() => router.push('/salon-identity')}
          />
          <HubRow
            icon="location-outline"
            label="Locație & contact"
            subtitle="Adresă și poziție pe hartă"
            onPress={() => router.push('/salon-location')}
          />
          <HubRow
            icon="images-outline"
            label="Galerie foto"
            subtitle="Logo și pozele salonului"
            onPress={() => router.push('/salon-media')}
          />
        </View>

        {/* ── Opening hours editor (moved here from main settings) ── */}
        <Text style={styles.groupTitle}>Program de lucru</Text>
        <View style={styles.card}>
          {hours.map((h, i) => (
            <View key={h.day} style={[styles.dayRow, i > 0 && styles.rowBorder]}>
              <Switch
                value={h.isOpen}
                onValueChange={(v) => updateDay(h.day, { isOpen: v })}
                trackColor={{ true: Colors.primary, false: Colors.gray300 }}
                thumbColor={Colors.white}
                style={styles.daySwitch}
              />
              <Text style={[styles.dayLabel, !h.isOpen && { color: Colors.gray400 }]}>
                {DAY_LABELS_RO[h.day]}
              </Text>
              {h.isOpen ? (
                <View style={styles.timeInputs}>
                  <TimeInput value={h.open} onChange={(v) => updateDay(h.day, { open: v })} />
                  <Text style={styles.timeDash}>–</Text>
                  <TimeInput value={h.close} onChange={(v) => updateDay(h.day, { close: v })} />
                </View>
              ) : (
                <Text style={styles.dayClosed}>Închis</Text>
              )}
            </View>
          ))}
        </View>

        {/* Contextual save — persists ONLY the opening hours */}
        <TouchableOpacity
          style={[styles.saveBtn, (savingHours || !hoursDirty) && styles.saveBtnDisabled]}
          onPress={handleSaveHours}
          disabled={savingHours || !hoursDirty}
          activeOpacity={0.85}
        >
          {savingHours
            ? <ActivityIndicator color={Colors.white} />
            : <>
                <Ionicons name="checkmark-circle" size={18} color={Colors.white} />
                <Text style={styles.saveBtnText}>Salvează programul</Text>
              </>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────────

function HubRow({ icon, label, subtitle, onPress, first }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  onPress: () => void;
  first?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      style={[styles.row, !first && styles.rowBorder]}
      onPress={onPress}
    >
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={18} color={Colors.primary} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.gray300} />
    </TouchableOpacity>
  );
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <TextInput
      style={styles.timeInput}
      value={value}
      onChangeText={onChange}
      placeholder="09:00"
      placeholderTextColor={Colors.gray300}
      keyboardType="numbers-and-punctuation"
      maxLength={5}
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },

  groupTitle: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.gray500,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 8, marginTop: Spacing.sm, marginLeft: 2,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },

  // Hub rows
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
  },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  iconCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: FontSize.md, color: Colors.black, fontWeight: FontWeight.semibold },
  rowSubtitle: { fontSize: FontSize.xs, color: Colors.gray500, marginTop: 2 },

  // Hours editor
  dayRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 9,
  },
  daySwitch: { transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] },
  dayLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.black, width: 42 },
  timeInputs: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  timeInput: {
    width: 64, textAlign: 'center',
    fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.gray700,
    backgroundColor: Colors.gray50, borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    paddingVertical: 7,
  },
  timeDash: { fontSize: FontSize.sm, color: Colors.gray400 },
  dayClosed: { flex: 1, textAlign: 'right', fontSize: FontSize.sm, color: Colors.gray400, paddingVertical: 9 },

  // Contextual save
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 15,
    marginTop: Spacing.xs,
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
