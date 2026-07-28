import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Switch,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, FontWeight, Gradients, Radius, Shadow, Spacing } from '../../theme';
import { useBusinessStore } from '../../store/businessStore';
import { businessApi } from '../../services/api/business';
import { discountsApi, DiscountCode } from '../../services/api/discounts';
import SettingsHeader from '../../components/business/SettingsHeader';

const CODE_FONT = Platform.select({ ios: 'Menlo', android: 'monospace' });

function formatRoDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ro-RO', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function validityLabel(code: DiscountCode): string {
  if (code.validFrom && code.validUntil) {
    return `${formatRoDate(code.validFrom)} – ${formatRoDate(code.validUntil)}`;
  }
  if (code.validUntil) return `Până la ${formatRoDate(code.validUntil)}`;
  if (code.validFrom) return `De la ${formatRoDate(code.validFrom)}`;
  return 'Fără limită de timp';
}

export default function DiscountCodesScreen() {
  const router = useRouter();
  const { salonProfile, setSalonProfile } = useBusinessStore();
  const salonId = salonProfile?.id ?? null;

  const [codes,     setCodes]     = useState<DiscountCode[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [savingId,  setSavingId]  = useState<string | null>(null);

  // Resolve the owner's real salon id — same pattern as ServicesScreen.
  useEffect(() => {
    if (salonProfile) return;
    businessApi.getSalonProfile().then(setSalonProfile).catch(() => setLoadError(true));
  }, []);

  const loadCodes = useCallback(() => {
    if (!salonId) return;
    discountsApi.list(salonId)
      .then((list) => { setCodes(list); setLoadError(false); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [salonId]);

  // Refresh on focus so codes created in the wizard show up immediately.
  useFocusEffect(useCallback(() => { loadCodes(); }, [loadCodes]));

  // ── Toggle active (optimistic PATCH) ─────────────────────────────────────────
  const handleToggle = async (code: DiscountCode) => {
    if (!salonId || savingId) return;
    const next = !code.isActive;
    setCodes((prev) => prev.map((c) => (c.id === code.id ? { ...c, isActive: next } : c)));
    setSavingId(code.id);
    try {
      const updated = await discountsApi.update(salonId, code.id, { isActive: next });
      setCodes((prev) => prev.map((c) => (c.id === code.id ? updated : c)));
    } catch {
      // Rollback
      setCodes((prev) => prev.map((c) => (c.id === code.id ? code : c)));
      Alert.alert('Eroare', 'Nu s-a putut schimba starea codului.');
    } finally {
      setSavingId(null);
    }
  };

  // ── Delete (hard-delete unused; retire redeemed) ────────────────────────────
  const handleDelete = (code: DiscountCode) => {
    Alert.alert(
      'Șterge codul',
      code.redemptionCount > 0
        ? `„${code.code}” a fost deja folosit de ${code.redemptionCount} ori, așa că va fi doar dezactivat definitiv.`
        : `Ești sigur că vrei să ștergi codul „${code.code}”?`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge',
          style: 'destructive',
          onPress: async () => {
            if (!salonId) return;
            try {
              const result = await discountsApi.remove(salonId, code.id);
              if (result === 'deleted') {
                setCodes((prev) => prev.filter((c) => c.id !== code.id));
              } else {
                setCodes((prev) =>
                  prev.map((c) => (c.id === code.id ? { ...c, isActive: false } : c)),
                );
              }
            } catch {
              Alert.alert('Eroare', 'Nu s-a putut șterge codul.');
            }
          },
        },
      ],
    );
  };

  const goToWizard = () => router.push('/(business)/discount-code-new');

  // The business tab bar is a floating capsule (GlassTabBar: bottom
  // max(insets.bottom-8, 6), height 69) — the CTA must sit ABOVE it.
  const insets = useSafeAreaInsets();
  const ctaBottom = Math.max(insets.bottom - 8, 6) + 69 + 12;

  const addButton = (
    <TouchableOpacity style={styles.addBtn} onPress={goToWizard} accessibilityLabel="Generează cod">
      <Ionicons name="add" size={22} color={Colors.white} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SettingsHeader title="Coduri de reducere" right={addButton} />

      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, paddingBottom: 210 }}
          showsVerticalScrollIndicator={false}
        >
          {loadError && codes.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cloud-offline-outline" size={40} color={Colors.gray300} />
              <Text style={styles.emptyText}>Nu am putut încărca codurile de reducere.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={loadCodes}>
                <Text style={styles.emptyBtnText}>Reîncearcă</Text>
              </TouchableOpacity>
            </View>
          ) : codes.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="pricetags-outline" size={40} color={Colors.gray300} />
              <Text style={styles.emptyText}>
                Niciun cod de reducere încă.{'\n'}Creează primul cod pentru clienții tăi.
              </Text>
            </View>
          ) : (
            codes.map((code) => (
              <CodeCard
                key={code.id}
                code={code}
                saving={savingId === code.id}
                onToggle={() => handleToggle(code)}
                onDelete={() => handleDelete(code)}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Bottom CTA — mirrors the gradient CTA pattern from SignUpWizard */}
      <View style={[styles.footer, { bottom: ctaBottom }]}>
        <TouchableOpacity activeOpacity={0.88} onPress={goToWizard} style={styles.ctaWrap}>
          <LinearGradient colors={Gradients.brand} start={Gradients.start} end={Gradients.end} style={styles.cta}>
            <Ionicons name="sparkles-outline" size={18} color={Colors.white} />
            <Text style={styles.ctaText}>Generează cod</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function CodeCard({
  code, saving, onToggle, onDelete,
}: {
  code: DiscountCode; saving: boolean;
  onToggle: () => void; onDelete: () => void;
}) {
  const valueLabel = code.type === 'PERCENT' ? `−${code.value}%` : `−${code.value} RON`;
  const usageLabel = `${code.redemptionCount}/${code.maxRedemptions ?? '∞'}`;

  return (
    <View style={[styles.card, !code.isActive && { opacity: 0.55 }]}>
      <View style={{ flex: 1 }}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardCode}>{code.code}</Text>
          <View style={styles.valuePill}>
            <Text style={styles.valuePillText}>{valueLabel}</Text>
          </View>
        </View>
        <Text style={styles.cardMeta}>{validityLabel(code)}</Text>
        <View style={styles.cardUsageRow}>
          <Ionicons name="ticket-outline" size={12} color={Colors.gray500} />
          <Text style={styles.cardMeta}>Utilizări: {usageLabel}</Text>
          <Text style={styles.cardMeta}>·</Text>
          <Text style={styles.cardMeta}>Max {code.maxPerClient}/client</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <Switch
          value={code.isActive}
          onValueChange={onToggle}
          disabled={saving}
          trackColor={{ true: Colors.primary, false: Colors.gray300 }}
          thumbColor={Colors.white}
        />
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={onDelete}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityLabel={`Șterge codul ${code.code}`}
        >
          <Ionicons name="trash-outline" size={17} color={Colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  addBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.white, borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    padding: Spacing.md, marginBottom: 10, ...Shadow.sm,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  cardCode: {
    fontFamily: CODE_FONT, fontSize: FontSize.md, fontWeight: FontWeight.bold,
    color: Colors.ink, letterSpacing: 1,
  },
  valuePill: {
    backgroundColor: Colors.primaryLight, borderRadius: Radius.full,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  valuePillText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.primary },
  cardMeta: { fontSize: FontSize.xs, color: Colors.gray500 },
  cardUsageRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  cardActions: { alignItems: 'center', gap: 8 },
  deleteBtn: { padding: 4 },

  emptyState: { alignItems: 'center', paddingTop: 70, gap: Spacing.md },
  emptyText: { fontSize: FontSize.md, color: Colors.gray500, textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg, paddingVertical: 12,
  },
  emptyBtnText: { color: Colors.white, fontWeight: FontWeight.bold },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0, // bottom overridden inline (above the floating tab bar)
    paddingHorizontal: Spacing.lg, paddingTop: 10,
    backgroundColor: Colors.background,
  },
  ctaWrap: { borderRadius: Radius.pill, ...Shadow.brand },
  cta: {
    flexDirection: 'row', gap: 8, borderRadius: Radius.pill, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
