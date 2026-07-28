import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSize, FontWeight, Radius, Shadow, Spacing } from '../../theme';
import { useBusinessStore, SalonProfile, SalonOpeningHour } from '../../store/businessStore';
import { businessApi } from '../../services/api/business';
import { backToSettings } from '../../components/business/SettingsHeader';

const DAYS_LABEL = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];
const DAY_KEYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export default function SalonProfileEditScreen() {
  const router = useRouter();
  const { salonProfile, setSalonProfile } = useBusinessStore();
  const [loading, setLoading] = useState(!salonProfile);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Identity fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  // Address fields
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');

  // Opening hours
  const [hours, setHours] = useState<SalonOpeningHour[]>([]);

  // Booking policy
  const [requiresDeposit, setRequiresDeposit] = useState(false);
  const [depositPct, setDepositPct] = useState(30);
  const [cancellationHours, setCancellationHours] = useState(24);

  // Track salonId for PATCH (can't use 'my' — endpoint needs UUID)
  const salonIdRef = useRef<string>('');

  useEffect(() => {
    const profile = salonProfile;
    if (profile) {
      populateForm(profile);
      setLoading(false);
    } else {
      // Resolve the owner's real salon (UUID needed for PATCH). Surface a
      // clean error state on rejection instead of spinning forever.
      businessApi.getSalonProfile()
        .then((p) => {
          setSalonProfile(p);
          populateForm(p);
        })
        .catch(() => setLoadError(true))
        .finally(() => setLoading(false));
    }
  }, []);

  const populateForm = (p: SalonProfile) => {
    salonIdRef.current = p.id;
    setName(p.name);
    setDescription(p.description ?? '');
    setPhone(p.phone ?? '');
    setEmail(p.email ?? '');
    setWebsiteUrl(p.websiteUrl ?? '');
    setAddressLine1(p.addressLine1);
    setCity(p.city);
    setRequiresDeposit(p.requiresDeposit);
    setDepositPct(p.depositPercentage ?? 30);
    setCancellationHours(p.cancellationHours);
    // Fill hours — ensure all 7 days present
    const hoursMap = Object.fromEntries(p.openingHours.map((h) => [h.dayOfWeek, h]));
    setHours(
      DAY_KEYS.map((key, i) =>
        hoursMap[key] ?? {
          dayOfWeek: key,
          openTime: i < 5 ? '09:00' : i === 5 ? '10:00' : '00:00',
          closeTime: i < 4 ? '19:00' : i === 4 ? '20:00' : i === 5 ? '17:00' : '00:00',
          isClosed: key === 'SUNDAY',
        },
      ),
    );
  };

  const toggleDay = (idx: number) => {
    setHours((prev) => prev.map((h, i) => (i === idx ? { ...h, isClosed: !h.isClosed } : h)));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Câmp obligatoriu', 'Numele salonului este obligatoriu.');
      return;
    }
    if (!addressLine1.trim() || !city.trim()) {
      Alert.alert('Câmp obligatoriu', 'Adresa și orașul sunt obligatorii.');
      return;
    }

    const id = salonIdRef.current;
    if (!id) {
      Alert.alert('Eroare', 'Salonul nu a fost încă încărcat. Încearcă din nou.');
      return;
    }

    setSaving(true);
    try {
      // 1. Update identity + address + booking policy
      const updated = await businessApi.updateSalonProfile(id, {
        name: name.trim(),
        description: description.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
        addressLine1: addressLine1.trim(),
        city: city.trim(),
        requiresDeposit,
        depositPercentage: requiresDeposit ? depositPct : undefined,
        cancellationHours,
      });
      // 2. Persist opening hours
      await businessApi.setOpeningHours(id, hours);

      setSalonProfile({ ...updated, openingHours: hours });
      backToSettings(router);
    } catch {
      Alert.alert('Eroare', 'Nu s-au putut salva modificările. Încearcă din nou.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => backToSettings(router)} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={22} color={Colors.black} />
          </TouchableOpacity>
          <Text style={styles.title}>Profil salon</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.loadingCenter}>
          <Text style={{ fontSize: 40 }}>🏪</Text>
          <Text style={styles.errorText}>Nu am putut încărca salonul tău.</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setLoadError(false);
              setLoading(true);
              businessApi.getSalonProfile()
                .then((p) => { setSalonProfile(p); populateForm(p); })
                .catch(() => setLoadError(true))
                .finally(() => setLoading(false));
            }}
          >
            <Text style={styles.retryBtnText}>Reîncearcă</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => backToSettings(router)} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={22} color={Colors.black} />
          </TouchableOpacity>
          <Text style={styles.title}>Profil salon</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* ── Identitate ───────────────────────────────────────────────────── */}
          <SectionLabel title="Identitate" />
          <View style={styles.card}>
            <Field label="Nume salon *" value={name} onChangeText={setName} placeholder="Studio Bella" />
            <Divider />
            <Field label="Descriere" value={description} onChangeText={setDescription}
              placeholder="Salonul nr. 1 din București..." multiline />
            <Divider />
            <Field label="Telefon" value={phone} onChangeText={setPhone}
              placeholder="+40712345678" keyboardType="phone-pad" />
            <Divider />
            <Field label="Email" value={email} onChangeText={setEmail}
              placeholder="contact@salon.ro" keyboardType="email-address" autoCapitalize="none" />
            <Divider />
            <Field label="Website" value={websiteUrl} onChangeText={setWebsiteUrl}
              placeholder="https://salon.ro" keyboardType="url" autoCapitalize="none" />
          </View>

          {/* ── Adresă ───────────────────────────────────────────────────────── */}
          <SectionLabel title="Adresă" />
          <View style={styles.card}>
            <Field label="Stradă & număr *" value={addressLine1} onChangeText={setAddressLine1}
              placeholder="Strada Florilor 12" />
            <Divider />
            <Field label="Oraș *" value={city} onChangeText={setCity} placeholder="București" />
          </View>

          {/* ── Program ──────────────────────────────────────────────────────── */}
          <SectionLabel title="Program de funcționare" />
          <View style={styles.card}>
            {hours.map((h, i) => (
              <View key={h.dayOfWeek} style={[styles.dayRow, i < hours.length - 1 && styles.dayBorder]}>
                <TouchableOpacity
                  style={[styles.dayToggle, !h.isClosed && styles.dayToggleActive]}
                  onPress={() => toggleDay(i)}
                >
                  <Text style={[styles.dayToggleText, !h.isClosed && styles.dayToggleTextActive]}>
                    {DAYS_LABEL[i]}
                  </Text>
                </TouchableOpacity>
                {h.isClosed ? (
                  <Text style={styles.closedText}>Închis</Text>
                ) : (
                  <View style={styles.timeRow}>
                    <TimeInput
                      value={h.openTime}
                      onChange={(v) =>
                        setHours((prev) => prev.map((x, j) => (j === i ? { ...x, openTime: v } : x)))
                      }
                    />
                    <Text style={styles.timeSep}>–</Text>
                    <TimeInput
                      value={h.closeTime}
                      onChange={(v) =>
                        setHours((prev) => prev.map((x, j) => (j === i ? { ...x, closeTime: v } : x)))
                      }
                    />
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* ── Politică rezervare ────────────────────────────────────────────── */}
          <SectionLabel title="Politică rezervare" />
          <View style={styles.card}>
            <View style={styles.policyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.policyLabel}>Plată în avans</Text>
                <Text style={styles.policyDesc}>Reduce no-show-urile cu ~60%</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle, requiresDeposit && styles.toggleActive]}
                onPress={() => setRequiresDeposit(!requiresDeposit)}
              >
                <View style={[styles.toggleThumb, requiresDeposit && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>
            {requiresDeposit && (
              <View style={styles.pctRow}>
                {[20, 30, 50, 100].map((pct) => (
                  <TouchableOpacity
                    key={pct}
                    style={[styles.pctChip, depositPct === pct && styles.pctChipActive]}
                    onPress={() => setDepositPct(pct)}
                  >
                    <Text style={[styles.pctText, depositPct === pct && { color: Colors.white }]}>{pct}%</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Divider />
            <View style={[styles.policyRow, { paddingTop: Spacing.sm }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.policyLabel}>Anulare gratuită</Text>
                <Text style={styles.policyDesc}>Ore înainte de programare</Text>
              </View>
              <View style={styles.counterRow}>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setCancellationHours(Math.max(1, cancellationHours - 1))}
                >
                  <Ionicons name="remove" size={16} color={Colors.primary} />
                </TouchableOpacity>
                <Text style={styles.counterValue}>{cancellationHours}h</Text>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setCancellationHours(cancellationHours + 1)}
                >
                  <Ionicons name="add" size={16} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={Colors.white} />
              : <>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
                  <Text style={styles.saveBtnText}>Salvează profilul</Text>
                </>
            }
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ title }: { title: string }) {
  return <Text style={styles.sectionLabel}>{title}</Text>;
}

function Divider() {
  return <View style={styles.divider} />;
}

function Field({
  label, value, onChangeText, placeholder, multiline, keyboardType, autoCapitalize,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; multiline?: boolean;
  keyboardType?: any; autoCapitalize?: any;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.gray300}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        textAlignVertical={multiline ? 'top' : 'auto'}
      />
    </View>
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
    />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg },
  errorText: { fontSize: FontSize.md, color: Colors.gray500, textAlign: 'center' },
  retryBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg, paddingVertical: 12 },
  retryBtnText: { color: Colors.white, fontWeight: FontWeight.bold },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderColor: Colors.border,
  },
  backBtn: {
    width: 38, height: 38, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.gray50, borderRadius: Radius.full,
  },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black },

  scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },

  sectionLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.gray500,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: Spacing.sm,
  },
  card: { backgroundColor: Colors.white, borderRadius: Radius.lg, overflow: 'hidden', marginBottom: Spacing.md, ...Shadow.sm },
  divider: { height: 1, backgroundColor: Colors.gray50, marginHorizontal: Spacing.md },

  field: { paddingHorizontal: Spacing.md, paddingVertical: 12 },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.gray500, marginBottom: 4 },
  fieldInput: { fontSize: FontSize.md, color: Colors.black, padding: 0 },
  fieldInputMulti: { minHeight: 64 },

  // Opening hours
  dayRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 10 },
  dayBorder: { borderBottomWidth: 1, borderColor: Colors.gray50 },
  dayToggle: {
    width: 44, paddingVertical: 5, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', marginRight: Spacing.sm,
  },
  dayToggleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayToggleText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.gray500 },
  dayToggleTextActive: { color: Colors.white },
  closedText: { flex: 1, fontSize: FontSize.sm, color: Colors.gray300, textAlign: 'right' },
  timeRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  timeInput: {
    width: 58, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm,
    paddingVertical: 5, paddingHorizontal: 8, fontSize: FontSize.sm, color: Colors.black,
    textAlign: 'center',
  },
  timeSep: { fontSize: FontSize.md, color: Colors.gray500 },

  // Booking policy
  policyRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 12 },
  policyLabel: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.black },
  policyDesc: { fontSize: FontSize.xs, color: Colors.gray500, marginTop: 2 },
  toggle: {
    width: 44, height: 26, borderRadius: 13, backgroundColor: Colors.gray300,
    justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleActive: { backgroundColor: Colors.primary },
  toggleThumb: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.white,
    alignSelf: 'flex-start',
  },
  toggleThumbActive: { alignSelf: 'flex-end' },
  pctRow: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.md, paddingBottom: 10 },
  pctChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  pctChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pctText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gray700 },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  counterBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  counterValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black, minWidth: 36, textAlign: 'center' },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: 16,
    marginTop: Spacing.sm,
  },
  saveBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
