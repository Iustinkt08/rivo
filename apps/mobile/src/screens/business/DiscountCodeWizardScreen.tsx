import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Clipboard from 'expo-clipboard';
import { Colors, FontSize, FontWeight, Gradients, Radius, Shadow, Spacing } from '../../theme';
import { useBusinessStore } from '../../store/businessStore';
import { businessApi } from '../../services/api/business';
import {
  discountsApi, discountErrorMessage, DiscountCode, DiscountType,
} from '../../services/api/discounts';

const TOTAL_STEPS = 2;
const CODE_FONT = Platform.select({ ios: 'Menlo', android: 'monospace' });
const CUSTOM_CODE_PATTERN = /^[A-Z0-9-]{3,24}$/;
const PERCENT_MAX = 100;

function formatRoDate(d: Date): string {
  return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Full-day bounds so a "până la" date stays valid through that entire day. */
const startOfDay = (d: Date) => { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; };
const endOfDay   = (d: Date) => { const c = new Date(d); c.setHours(23, 59, 59, 999); return c; };

export default function DiscountCodeWizardScreen() {
  const router = useRouter();
  const { salonProfile, setSalonProfile } = useBusinessStore();
  const salonId = salonProfile?.id ?? null;

  const [step,    setStep]    = useState(0);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [created, setCreated] = useState<DiscountCode | null>(null);
  const [copied,  setCopied]  = useState(false);

  // ── Step 1 fields ────────────────────────────────────────────────────────────
  const [type,       setType]       = useState<DiscountType>('PERCENT');
  const [value,      setValue]      = useState('');
  const [validFrom,  setValidFrom]  = useState<Date | null>(null);
  const [validUntil, setValidUntil] = useState<Date | null>(null);
  const [maxTotal,   setMaxTotal]   = useState('');
  const [maxPerClient, setMaxPerClient] = useState('1');
  const [customCode, setCustomCode] = useState('');
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker,   setShowToPicker]   = useState(false);

  // Same fallback as the other business screens: resolve the salon id lazily.
  useEffect(() => {
    if (salonProfile) return;
    businessApi.getSalonProfile().then(setSalonProfile).catch(() => {});
  }, []);

  // ── Validation ───────────────────────────────────────────────────────────────
  const numericValue = Number(value.replace(',', '.'));
  const isValueValid =
    value.trim().length > 0 &&
    Number.isFinite(numericValue) &&
    numericValue > 0 &&
    (type === 'FIXED' || numericValue <= PERCENT_MAX);

  const normalizedCustomCode = customCode.trim().toUpperCase();
  const isCodeValid =
    normalizedCustomCode.length === 0 || CUSTOM_CODE_PATTERN.test(normalizedCustomCode);

  const isWindowValid =
    !validFrom || !validUntil || endOfDay(validUntil).getTime() > startOfDay(validFrom).getTime();

  const maxTotalNum = maxTotal.trim() ? parseInt(maxTotal, 10) : null;
  const maxPerClientNum = maxPerClient.trim() ? parseInt(maxPerClient, 10) : 1;
  const areLimitsValid =
    (maxTotalNum === null || (Number.isInteger(maxTotalNum) && maxTotalNum >= 1)) &&
    Number.isInteger(maxPerClientNum) && maxPerClientNum >= 1;

  const isStepOneValid = isValueValid && isCodeValid && isWindowValid && areLimitsValid;

  // ── Navigation ───────────────────────────────────────────────────────────────
  const handleBack = () => {
    if (step === 0 || created) { router.back(); return; }
    setError(null);
    setStep(0);
  };

  // ── Create ───────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!salonId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const code = await discountsApi.create(salonId, {
        code: normalizedCustomCode.length > 0 ? normalizedCustomCode : undefined,
        type,
        value: numericValue,
        validFrom: validFrom ? startOfDay(validFrom).toISOString() : undefined,
        validUntil: validUntil ? endOfDay(validUntil).toISOString() : undefined,
        maxRedemptions: maxTotalNum ?? undefined,
        maxPerClient: maxPerClientNum,
      });
      setCreated(code);
    } catch (err: any) {
      setError(discountErrorMessage(err, 'Codul nu a putut fi creat. Încearcă din nou.'));
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!created) return;
    try {
      await Clipboard.setStringAsync(created.code);
      setCopied(true);
    } catch {
      setError('Nu am putut copia codul.');
    }
  };

  // ── Success view ─────────────────────────────────────────────────────────────
  if (created) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.doneContainer}>
          <View style={{ flex: 1 }} />
          <LinearGradient colors={Gradients.brand} start={Gradients.start} end={Gradients.end} style={styles.doneCircle}>
            <Ionicons name="pricetag" size={38} color={Colors.white} />
          </LinearGradient>
          <Text style={styles.doneTitle}>Codul tău e gata</Text>
          <Text style={styles.doneSubtitle}>Distribuie-l clienților tăi pentru{'\n'}a-l folosi la rezervare</Text>

          <View style={styles.codeBox}>
            <Text style={styles.codeBig}>{created.code}</Text>
            <Text style={styles.codeBoxMeta}>
              {created.type === 'PERCENT' ? `−${created.value}% reducere` : `−${created.value} RON reducere`}
            </Text>
          </View>

          <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} activeOpacity={0.85}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={17} color={Colors.primary} />
            <Text style={styles.copyBtnText}>{copied ? 'Copiat!' : 'Copiază codul'}</Text>
          </TouchableOpacity>
          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={{ flex: 1.3 }} />
          <TouchableOpacity activeOpacity={0.88} onPress={() => router.back()} style={[styles.ctaWrap, { alignSelf: 'stretch' }]}>
            <LinearGradient colors={Gradients.brand} start={Gradients.start} end={Gradients.end} style={styles.cta}>
              <Text style={styles.ctaText}>Gata</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Wizard ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleBack} disabled={saving} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={step === 0 ? 'close' : 'chevron-back'} size={26} color={Colors.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cod de reducere</Text>
          <View style={{ width: 26 }} />
        </View>

        {/* Progress dots */}
        <View style={styles.dotsRow}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
          ))}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 0 && (
            <View>
              <Text style={styles.question}>Detalii reducere</Text>

              {/* Type */}
              <Text style={styles.fieldLabel}>Tipul reducerii</Text>
              <View style={styles.typeRow}>
                {([
                  { key: 'PERCENT' as const, label: 'Procent',   icon: 'trending-down-outline' },
                  { key: 'FIXED'   as const, label: 'Sumă fixă', icon: 'cash-outline' },
                ]).map((opt) => {
                  const active = type === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.typeChip, active && styles.typeChipActive]}
                      onPress={() => setType(opt.key)}
                    >
                      <Ionicons name={opt.icon as any} size={16} color={active ? Colors.white : Colors.gray700} />
                      <Text style={[styles.typeChipText, active && { color: Colors.white }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Value with suffix */}
              <Text style={styles.fieldLabel}>Valoarea reducerii</Text>
              <View style={styles.valueRow}>
                <TextInput
                  style={styles.valueInput}
                  placeholder={type === 'PERCENT' ? '10' : '25'}
                  placeholderTextColor={Colors.gray300}
                  keyboardType="decimal-pad"
                  value={value}
                  onChangeText={setValue}
                  maxLength={6}
                />
                <Text style={styles.valueSuffix}>{type === 'PERCENT' ? '%' : 'RON'}</Text>
              </View>
              {value.trim().length > 0 && !isValueValid && (
                <Text style={styles.errorText}>
                  {type === 'PERCENT'
                    ? 'Procentul trebuie să fie între 1 și 100.'
                    : 'Suma trebuie să fie mai mare decât 0.'}
                </Text>
              )}

              {/* Validity (optional) */}
              <Text style={styles.fieldLabel}>Valabilitate (opțional)</Text>
              <View style={styles.dateRow}>
                <DateField
                  label="De la"
                  date={validFrom}
                  onPress={() => { setShowFromPicker(true); setShowToPicker(false); }}
                  onClear={() => setValidFrom(null)}
                />
                <DateField
                  label="Până la"
                  date={validUntil}
                  onPress={() => { setShowToPicker(true); setShowFromPicker(false); }}
                  onClear={() => setValidUntil(null)}
                />
              </View>
              {!isWindowValid && (
                <Text style={styles.errorText}>Data de sfârșit trebuie să fie după data de început.</Text>
              )}

              {/* Date pickers (Android dialog; iOS spinner rendered inline) */}
              {showFromPicker && (
                <DateTimePicker
                  value={validFrom ?? new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={new Date()}
                  onChange={(_, d) => {
                    if (Platform.OS === 'android') setShowFromPicker(false);
                    if (d) setValidFrom(d);
                  }}
                />
              )}
              {showFromPicker && Platform.OS === 'ios' && (
                <TouchableOpacity style={styles.dateConfirmBtn} onPress={() => setShowFromPicker(false)}>
                  <Text style={styles.dateConfirmText}>Gata</Text>
                </TouchableOpacity>
              )}
              {showToPicker && (
                <DateTimePicker
                  value={validUntil ?? validFrom ?? new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={validFrom ?? new Date()}
                  onChange={(_, d) => {
                    if (Platform.OS === 'android') setShowToPicker(false);
                    if (d) setValidUntil(d);
                  }}
                />
              )}
              {showToPicker && Platform.OS === 'ios' && (
                <TouchableOpacity style={styles.dateConfirmBtn} onPress={() => setShowToPicker(false)}>
                  <Text style={styles.dateConfirmText}>Gata</Text>
                </TouchableOpacity>
              )}

              {/* Limits (optional) */}
              <Text style={styles.fieldLabel}>Limite (opțional)</Text>
              <View style={styles.limitsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.limitLabel}>Utilizări totale</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Nelimitat"
                    placeholderTextColor={Colors.gray300}
                    keyboardType="number-pad"
                    value={maxTotal}
                    onChangeText={setMaxTotal}
                    maxLength={6}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.limitLabel}>Per client</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="1"
                    placeholderTextColor={Colors.gray300}
                    keyboardType="number-pad"
                    value={maxPerClient}
                    onChangeText={setMaxPerClient}
                    maxLength={4}
                  />
                </View>
              </View>
              {!areLimitsValid && (
                <Text style={styles.errorText}>Limitele trebuie să fie numere de minim 1.</Text>
              )}

              {/* Custom code (optional) */}
              <Text style={styles.fieldLabel}>Cod personalizat (opțional)</Text>
              <TextInput
                style={[styles.fieldInput, { fontFamily: CODE_FONT, letterSpacing: 1 }]}
                placeholder="Lasă gol pentru generare automată"
                placeholderTextColor={Colors.gray300}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={24}
                value={customCode}
                onChangeText={setCustomCode}
              />
              {customCode.trim().length > 0 && !isCodeValid && (
                <Text style={styles.errorText}>
                  Codul poate conține doar litere, cifre și cratime (3-24 de caractere).
                </Text>
              )}
            </View>
          )}

          {step === 1 && (
            <View>
              <Text style={styles.question}>Verifică și generează</Text>

              <View style={styles.reviewCard}>
                <ReviewRow label="Tip" value={type === 'PERCENT' ? 'Procent' : 'Sumă fixă'} />
                <ReviewRow label="Valoare" value={type === 'PERCENT' ? `−${numericValue}%` : `−${numericValue} RON`} />
                <ReviewRow
                  label="Cod"
                  value={normalizedCustomCode || 'Generat automat'}
                  mono={normalizedCustomCode.length > 0}
                />
                <ReviewRow
                  label="Valabilitate"
                  value={
                    validFrom || validUntil
                      ? `${validFrom ? formatRoDate(validFrom) : 'oricând'} – ${validUntil ? formatRoDate(validUntil) : 'oricând'}`
                      : 'Fără limită de timp'
                  }
                />
                <ReviewRow label="Utilizări totale" value={maxTotalNum ? String(maxTotalNum) : 'Nelimitat'} />
                <ReviewRow label="Per client" value={String(maxPerClientNum)} last />
              </View>

              {error && <Text style={styles.errorText}>{error}</Text>}
            </View>
          )}

          {/* CTA */}
          <View style={styles.progressBlock}>
            <TouchableOpacity
              activeOpacity={0.88}
              disabled={(step === 0 && !isStepOneValid) || saving || (step === 1 && !salonId)}
              onPress={step === 0 ? () => { setError(null); setStep(1); } : handleCreate}
              style={[
                styles.ctaWrap,
                ((step === 0 && !isStepOneValid) || saving) && { opacity: 0.5 },
              ]}
            >
              <LinearGradient colors={Gradients.brand} start={Gradients.start} end={Gradients.end} style={styles.cta}>
                {saving ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.ctaText}>{step === 0 ? 'Continuă' : 'Generează codul'}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Small pieces ──────────────────────────────────────────────────────────────

function DateField({
  label, date, onPress, onClear,
}: { label: string; date: Date | null; onPress: () => void; onClear: () => void }) {
  return (
    <TouchableOpacity style={styles.dateField} onPress={onPress} activeOpacity={0.8}>
      <View style={{ flex: 1 }}>
        <Text style={styles.dateFieldLabel}>{label}</Text>
        <Text style={[styles.dateFieldValue, !date && { color: Colors.gray300 }]}>
          {date ? formatRoDate(date) : 'Oricând'}
        </Text>
      </View>
      {date ? (
        <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={18} color={Colors.gray400} />
        </TouchableOpacity>
      ) : (
        <Ionicons name="calendar-outline" size={17} color={Colors.gray500} />
      )}
    </TouchableOpacity>
  );
}

function ReviewRow({
  label, value, mono, last,
}: { label: string; value: string; mono?: boolean; last?: boolean }) {
  return (
    <View style={[styles.reviewRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={[styles.reviewValue, mono && { fontFamily: CODE_FONT, letterSpacing: 1 }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },

  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.sm,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.ink },

  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.gray100 },
  dotActive: { backgroundColor: Colors.primary },

  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },

  question: {
    fontSize: 26, fontWeight: FontWeight.heavy, color: Colors.ink,
    letterSpacing: -0.5, marginTop: Spacing.lg, marginBottom: Spacing.sm,
  },

  fieldLabel: {
    fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.gray700,
    marginTop: Spacing.lg, marginBottom: 8,
  },
  fieldInput: {
    backgroundColor: Colors.gray50, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 13,
    fontSize: FontSize.md, color: Colors.black,
  },

  typeRow: { flexDirection: 'row', gap: 10 },
  typeChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 13, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.gray700 },

  valueRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.gray50, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md,
  },
  valueInput: { flex: 1, paddingVertical: 13, fontSize: FontSize.xl, color: Colors.black },
  valueSuffix: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gray500 },

  dateRow: { flexDirection: 'row', gap: 10 },
  dateField: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.gray50, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  dateFieldLabel: { fontSize: FontSize.xs, color: Colors.gray500 },
  dateFieldValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink, marginTop: 2 },
  dateConfirmBtn: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 4 },
  dateConfirmText: { color: Colors.primary, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  limitsRow: { flexDirection: 'row', gap: 10 },
  limitLabel: { fontSize: FontSize.xs, color: Colors.gray500, marginBottom: 5 },

  reviewCard: {
    backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.lg,
    marginTop: Spacing.md, ...Shadow.md,
  },
  reviewRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderColor: Colors.gray50, gap: Spacing.sm,
  },
  reviewLabel: { fontSize: FontSize.sm, color: Colors.gray500 },
  reviewValue: {
    fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink,
    flexShrink: 1, textAlign: 'right',
  },

  errorText: { fontSize: FontSize.xs, color: Colors.error, marginTop: 8, lineHeight: 16 },

  progressBlock: { marginTop: Spacing.xxl },
  ctaWrap: { borderRadius: Radius.pill, ...Shadow.brand },
  cta: { borderRadius: Radius.pill, paddingVertical: 17, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },

  // Success view
  doneContainer: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  doneCircle: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.lg, ...Shadow.brand,
  },
  doneTitle: { fontSize: 28, fontWeight: FontWeight.heavy, color: Colors.ink, marginBottom: 8 },
  doneSubtitle: { fontSize: FontSize.md, color: Colors.gray500, textAlign: 'center', lineHeight: 22 },
  codeBox: {
    alignSelf: 'stretch', alignItems: 'center',
    backgroundColor: Colors.gray50, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: Spacing.lg, marginTop: Spacing.xl,
  },
  codeBig: {
    fontFamily: CODE_FONT, fontSize: 30, fontWeight: FontWeight.bold,
    color: Colors.ink, letterSpacing: 3,
  },
  codeBoxMeta: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold, marginTop: 6 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginTop: Spacing.md, paddingVertical: 10, paddingHorizontal: 18,
    borderRadius: Radius.full, backgroundColor: Colors.primaryLight,
  },
  copyBtnText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});
