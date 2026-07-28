import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Radius, Shadow, Spacing } from '../../theme';
import SettingsHeader from '../../components/business/SettingsHeader';
import { useBusinessStore } from '../../store/businessStore';
import { businessApi } from '../../services/api/business';
import { loyaltyApi } from '../../services/api/loyalty';
import type { DiscountType } from '../../services/api/discounts';

const VISIT_PRESETS = [5, 8, 10];
const MIN_VISITS = 2;
const MAX_VISITS = 50;
const PERCENT_MAX = 100;

/**
 * Punch-card (loyalty) configuration — owner only. Loads the existing config
 * and saves the whole form via PUT (upsert on the backend).
 */
export default function PunchCardScreen() {
  const { salonProfile, setSalonProfile } = useBusinessStore();
  const [salonId, setSalonId] = useState<string | null>(salonProfile?.id ?? null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [isActive, setIsActive] = useState(false);
  const [requiredVisits, setRequiredVisits] = useState(5);
  const [rewardType, setRewardType] = useState<DiscountType>('PERCENT');
  const [rewardValueText, setRewardValueText] = useState('20');

  // Resolve the salon (store cache first) and load any existing config.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const sid = salonId
          ?? (await businessApi.getSalonProfile().then((p) => {
            if (!cancelled) setSalonProfile(p);
            return p.id;
          }));
        if (cancelled || !sid) return;
        setSalonId(sid);

        const config = await loyaltyApi.getPunchCardConfig(sid);
        if (cancelled || !config) return;
        setIsActive(config.isActive);
        setRequiredVisits(config.requiredVisits);
        setRewardType(config.rewardType);
        setRewardValueText(String(config.rewardValue));
      } catch {
        if (!cancelled) {
          Alert.alert('Eroare', 'Nu am putut încărca configurarea. Încearcă din nou.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markDirty = () => setDirty(true);
  const rewardValue = Number(rewardValueText.replace(',', '.'));
  const isRewardValid = Number.isFinite(rewardValue) && rewardValue > 0
    && (rewardType !== 'PERCENT' || rewardValue <= PERCENT_MAX);

  const adjustVisits = (delta: number) => {
    setRequiredVisits((v) => Math.min(MAX_VISITS, Math.max(MIN_VISITS, v + delta)));
    markDirty();
  };

  const handleSave = async () => {
    if (!salonId) {
      Alert.alert('Niciun salon', 'Nu am găsit salonul tău. Reîncarcă pagina și încearcă din nou.');
      return;
    }
    if (!isRewardValid) {
      Alert.alert(
        'Valoare invalidă',
        rewardType === 'PERCENT'
          ? 'Reducerea procentuală trebuie să fie între 1 și 100.'
          : 'Suma fixă trebuie să fie mai mare decât 0.',
      );
      return;
    }
    setSaving(true);
    try {
      await loyaltyApi.savePunchCardConfig(salonId, {
        isActive,
        requiredVisits,
        rewardType,
        rewardValue,
      });
      setDirty(false);
      Alert.alert('Salvat', 'Cardul de fidelitate a fost actualizat.');
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut salva configurarea. Încearcă din nou.');
    } finally {
      setSaving(false);
    }
  };

  const previewReward = rewardType === 'PERCENT'
    ? `${isRewardValid ? rewardValue : '—'}% reducere`
    : `${isRewardValid ? rewardValue : '—'} RON reducere`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SettingsHeader title="Card de fidelitate" />
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.explainer}>
              Recompensează automat clienții fideli: după un număr de vizite
              finalizate, primesc o reducere aplicată la următoarea programare.
            </Text>

            {/* Activation */}
            <View style={styles.card}>
              <View style={styles.toggleRow}>
                <View style={styles.iconCircle}>
                  <Ionicons name="ribbon-outline" size={18} color={Colors.primary} />
                </View>
                <Text style={styles.toggleLabel}>Activează cardul de fidelitate</Text>
                <Switch
                  value={isActive}
                  onValueChange={(v) => { setIsActive(v); markDirty(); }}
                  trackColor={{ true: Colors.primary, false: Colors.gray300 }}
                  thumbColor={Colors.white}
                />
              </View>
            </View>

            {/* Visits */}
            <Text style={styles.sectionTitle}>Număr de vizite</Text>
            <View style={styles.card}>
              <View style={styles.chipRow}>
                {VISIT_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={[styles.chip, requiredVisits === preset && styles.chipActive]}
                    onPress={() => { setRequiredVisits(preset); markDirty(); }}
                  >
                    <Text style={[styles.chipText, requiredVisits === preset && styles.chipTextActive]}>
                      {preset} vizite
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.stepperRow}>
                <Text style={styles.stepperLabel}>Personalizat ({MIN_VISITS}–{MAX_VISITS})</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustVisits(-1)}>
                    <Ionicons name="remove" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{requiredVisits}</Text>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustVisits(1)}>
                    <Ionicons name="add" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Reward */}
            <Text style={styles.sectionTitle}>Recompensă</Text>
            <View style={styles.card}>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, rewardType === 'PERCENT' && styles.chipActive]}
                  onPress={() => { setRewardType('PERCENT'); markDirty(); }}
                >
                  <Text style={[styles.chipText, rewardType === 'PERCENT' && styles.chipTextActive]}>Procent</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, rewardType === 'FIXED' && styles.chipActive]}
                  onPress={() => { setRewardType('FIXED'); markDirty(); }}
                >
                  <Text style={[styles.chipText, rewardType === 'FIXED' && styles.chipTextActive]}>Sumă fixă</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.valueRow}>
                <TextInput
                  style={styles.valueInput}
                  keyboardType="decimal-pad"
                  value={rewardValueText}
                  onChangeText={(t) => { setRewardValueText(t); markDirty(); }}
                  placeholder={rewardType === 'PERCENT' ? '20' : '50'}
                  placeholderTextColor={Colors.gray400}
                />
                <Text style={styles.valueUnit}>{rewardType === 'PERCENT' ? '%' : 'RON'}</Text>
              </View>
            </View>

            {/* Live preview */}
            <View style={styles.previewCard}>
              <Ionicons name="sparkles-outline" size={16} color={Colors.primary} />
              <Text style={styles.previewText}>
                La fiecare {requiredVisits} vizite finalizate, clientul primește{' '}
                {previewReward} la următoarea programare.
              </Text>
            </View>

            {/* Contextual save */}
            <TouchableOpacity
              style={[styles.saveBtn, (saving || !dirty) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving || !dirty}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.white} />
                    <Text style={styles.saveText}>Salvează</Text>
                  </>
              }
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, paddingBottom: 130 },

  explainer: { fontSize: FontSize.sm, color: Colors.gray500, lineHeight: 20, marginBottom: Spacing.lg },
  sectionTitle: {
    fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.gray700,
    marginBottom: Spacing.sm, marginTop: Spacing.md,
  },

  card: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.md },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconCircle: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  toggleLabel: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.black },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gray700 },
  chipTextActive: { color: Colors.white },

  stepperRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: Spacing.md, borderTopWidth: 1, borderColor: Colors.gray50, paddingTop: Spacing.md,
  },
  stepperLabel: { fontSize: FontSize.sm, color: Colors.gray500 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  stepperValue: {
    fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black,
    minWidth: 36, textAlign: 'center',
  },

  valueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md },
  valueInput: {
    flex: 1, backgroundColor: Colors.gray50, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: FontSize.md, color: Colors.black,
  },
  valueUnit: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gray700, minWidth: 36 },

  previewCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.primaryLight, borderRadius: Radius.lg,
    padding: Spacing.md, marginTop: Spacing.lg,
  },
  previewText: { flex: 1, fontSize: FontSize.sm, color: Colors.primary, lineHeight: 19, fontWeight: FontWeight.medium },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    marginTop: Spacing.lg, paddingVertical: 13,
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});
