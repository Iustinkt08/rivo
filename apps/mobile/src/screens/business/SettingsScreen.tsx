import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Colors, FontSize, FontWeight, Gradients, Radius, Shadow, Spacing } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { useBusinessStore } from '../../store/businessStore';
import { businessApi } from '../../services/api/business';
import StaffSettingsView from './StaffSettingsView';

const DEPOSIT_PERCENTAGES = [20, 30, 50, 100];
const MIN_CANCELLATION_HOURS = 1;

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut, staffSession } = useAuthStore();
  const { salonProfile, setSalonProfile } = useBusinessStore();
  const [requiresDeposit, setRequiresDeposit] = useState(false);
  const [depositPct, setDepositPct] = useState(30);
  const [cancellationHours, setCancellationHours] = useState(24);
  const [notifNewBooking, setNotifNewBooking] = useState(true);
  const [notifCancellation, setNotifCancellation] = useState(true);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policyDirty, setPolicyDirty] = useState(false);

  // Load salon profile once on mount to pre-populate local state.
  // Staff accounts render their own view and must not hit the owner-only
  // /salons/my/salon endpoint.
  useEffect(() => {
    if (staffSession) return;
    const loadProfile = async () => {
      const p = salonProfile ?? await businessApi.getSalonProfile().catch(() => null);
      if (!p) return;
      if (!salonProfile) setSalonProfile(p);
      setRequiresDeposit(p.requiresDeposit);
      setDepositPct(p.depositPercentage ?? 30);
      setCancellationHours(p.cancellationHours);
    };
    loadProfile();
  }, []);

  const markPolicyDirty = () => setPolicyDirty(true);

  // Contextual save — persists ONLY the booking policy (no global save button).
  const handleSavePolicy = async () => {
    const id = salonProfile?.id;
    if (!id) {
      Alert.alert('Niciun salon', 'Nu am găsit salonul tău. Reîncarcă pagina și încearcă din nou.');
      return;
    }
    setSavingPolicy(true);
    try {
      await businessApi.updateSalonProfile(id, {
        requiresDeposit,
        depositPercentage: requiresDeposit ? depositPct : undefined,
        cancellationHours,
      });
      setSalonProfile({
        ...salonProfile!,
        requiresDeposit,
        depositPercentage: requiresDeposit ? depositPct : salonProfile!.depositPercentage,
        cancellationHours,
      });
      setPolicyDirty(false);
      Alert.alert('Salvat', 'Politica de rezervare a fost actualizată.');
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut salva politica. Încearcă din nou.');
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Deconectare',
      'Ești sigur că vrei să te deconectezi de la contul tău?',
      [
        {
          text: 'Anulează',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Deconectează',
          onPress: () => {
            signOut();
            router.replace('/(auth)');
          },
          style: 'destructive',
        },
      ],
      { cancelable: false }
    );
  };

  // Staff accounts get a scoped settings view: own profile + password + logout.
  if (staffSession) {
    return <StaffSettingsView session={staffSession} />;
  }

  const salonName = salonProfile?.name ?? 'Salonul tău';
  const salonAddress = [salonProfile?.addressLine1, salonProfile?.city].filter(Boolean).join(', ') || 'Adaugă adresa salonului';
  const initials = salonName
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
        <Text style={styles.screenTitle}>Setări</Text>

        {/* Brand-gradient salon identity header */}
        <LinearGradient
          colors={Gradients.brand}
          start={Gradients.start}
          end={Gradients.end}
          style={styles.headerCard}
        >
          <View style={styles.headerAvatar}>
            {salonProfile?.logoUrl ? (
              <Image source={{ uri: salonProfile.logoUrl }} style={styles.headerAvatarImg} />
            ) : (
              <Text style={styles.headerInitials}>{initials}</Text>
            )}
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName} numberOfLines={1}>{salonName}</Text>
            <View style={styles.headerAddrRow}>
              <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.9)" />
              <Text style={styles.headerAddr} numberOfLines={1}>{salonAddress}</Text>
            </View>
            <View style={styles.rolePill}>
              <Ionicons name="briefcase-outline" size={11} color={Colors.white} />
              <Text style={styles.rolePillText}>Cont business</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Salon data hub — identity/location/gallery/hours moved inside */}
        <Section title="Salon">
          <SettingRow
            first
            icon="business-outline"
            label="Datele salonului"
            subtitle="Identitate, locație, galerie & program"
            onPress={() => router.push('/(business)/salon-settings')}
          />
          <SettingRow
            icon="megaphone-outline"
            label="Marketing"
            subtitle="Coduri de reducere & card de fidelitate"
            onPress={() => router.push('/(business)/marketing')}
          />
        </Section>

        {/* Services & team */}
        <Section title="Servicii & echipă">
          <SettingRow first icon="cut-outline" label="Servicii & prețuri" subtitle="Gestionează oferta salonului" onPress={() => router.push('/(business)/services')} />
          <SettingRow icon="people-outline" label="Echipa (Staff)" subtitle="Membri și programe" onPress={() => router.push('/salon-staff')} />
          <SettingRow icon="star-outline" label="Recenzii" subtitle="Vezi și răspunde clienților" onPress={() => router.push('/(business)/reviews')} />
        </Section>

        {/* Booking policy — has its own contextual save */}
        <Section title="Politica de rezervare">
          <ToggleRow
            first
            icon="card-outline"
            label="Plată în avans"
            subtitle="Reduce no-show-urile cu ~60%"
            value={requiresDeposit}
            onValueChange={(v) => { setRequiresDeposit(v); markPolicyDirty(); }}
          />
          {requiresDeposit && (
            <View style={styles.chipRow}>
              {DEPOSIT_PERCENTAGES.map((pct) => (
                <TouchableOpacity key={pct} style={[styles.pctChip, depositPct === pct && styles.pctChipActive]}
                  onPress={() => { setDepositPct(pct); markPolicyDirty(); }}>
                  <Text style={[styles.pctText, depositPct === pct && { color: Colors.white }]}>{pct}%</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.iconCircle}>
              <Ionicons name="time-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Anulare gratuită</Text>
              <Text style={styles.rowSubtitle}>Ore înainte de programare</Text>
            </View>
            <View style={styles.counterRow}>
              <TouchableOpacity
                style={styles.counterBtn}
                onPress={() => { setCancellationHours(Math.max(MIN_CANCELLATION_HOURS, cancellationHours - 1)); markPolicyDirty(); }}
              >
                <Ionicons name="remove" size={16} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.counterValue}>{cancellationHours}h</Text>
              <TouchableOpacity
                style={styles.counterBtn}
                onPress={() => { setCancellationHours(cancellationHours + 1); markPolicyDirty(); }}
              >
                <Ionicons name="add" size={16} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Contextual save — persists to the backend, enabled only when dirty */}
          <TouchableOpacity
            style={[styles.policySaveBtn, (savingPolicy || !policyDirty) && styles.policySaveBtnDisabled]}
            onPress={handleSavePolicy}
            disabled={savingPolicy || !policyDirty}
            activeOpacity={0.85}
          >
            {savingPolicy
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.white} />
                  <Text style={styles.policySaveText}>Salvează politica</Text>
                </>
            }
          </TouchableOpacity>
        </Section>

        {/* Notifications */}
        <Section title="Notificări">
          <ToggleRow
            first
            icon="calendar-outline"
            label="Rezervare nouă"
            subtitle="Anunță-mă la fiecare rezervare"
            value={notifNewBooking}
            onValueChange={setNotifNewBooking}
          />
          <ToggleRow
            icon="close-circle-outline"
            label="Anulare rezervare"
            subtitle="Anunță-mă când un client anulează"
            value={notifCancellation}
            onValueChange={setNotifCancellation}
          />
        </Section>

        {/* Logout */}
        <TouchableOpacity activeOpacity={0.85} style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={Colors.error} />
          <Text style={styles.logoutText}>Deconectare</Text>
        </TouchableOpacity>

        <Text style={styles.version}>NAVIRA Business v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function SettingRow({ icon, label, subtitle, badge, badgeColor, onPress, first }: {
  icon: any; label: string; subtitle?: string; badge?: string; badgeColor?: string; onPress: () => void; first?: boolean;
}) {
  return (
    <TouchableOpacity activeOpacity={0.6} style={[styles.row, !first && styles.rowBorder]} onPress={onPress}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={18} color={Colors.primary} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.rowRight}>
        {badge && <Text style={[styles.badge, { color: badgeColor ?? Colors.gray500 }]}>{badge}</Text>}
        <Ionicons name="chevron-forward" size={18} color={Colors.gray300} />
      </View>
    </TouchableOpacity>
  );
}

function ToggleRow({ icon, label, subtitle, value, onValueChange, first }: {
  icon: any; label: string; subtitle?: string; value: boolean; onValueChange: (v: boolean) => void; first?: boolean;
}) {
  return (
    <View style={[styles.row, !first && styles.rowBorder]}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={18} color={Colors.primary} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      <Switch value={value} onValueChange={onValueChange}
        trackColor={{ true: Colors.primary, false: Colors.gray300 }} thumbColor={Colors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  screenTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.ink, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, marginBottom: Spacing.md },

  // Brand-gradient identity header
  headerCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.xl,
    padding: Spacing.lg, borderRadius: Radius.xl,
    ...Shadow.brand,
  },
  headerAvatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  headerAvatarImg: { width: '100%', height: '100%' },
  headerInitials: { color: Colors.white, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  headerInfo: { flex: 1 },
  headerName: { color: Colors.white, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  headerAddrRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  headerAddr: { flex: 1, color: 'rgba(255,255,255,0.92)', fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full,
  },
  rolePillText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  // Sections
  section: { marginHorizontal: Spacing.lg, marginBottom: Spacing.xl },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.primary, marginBottom: 12, marginLeft: 2 },
  card: { backgroundColor: Colors.white, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.md },

  // Rows (nav + toggle share the same shell)
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderColor: Colors.gray50 },
  iconCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: FontSize.md, color: Colors.black, fontWeight: FontWeight.semibold },
  rowSubtitle: { fontSize: FontSize.xs, color: Colors.gray500, marginTop: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  // Deposit chips (indented to align under the label)
  chipRow: { flexDirection: 'row', gap: 8, paddingLeft: Spacing.md + 38 + Spacing.md, paddingRight: Spacing.md, paddingBottom: 14 },
  pctChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white },
  pctChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pctText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gray700 },

  // Cancellation counter
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  counterBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  counterValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black, minWidth: 40, textAlign: 'center' },

  // Booking-policy contextual save
  policySaveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    marginHorizontal: Spacing.md, marginVertical: Spacing.sm + 4, paddingVertical: 12,
  },
  policySaveBtnDisabled: { opacity: 0.45 },
  policySaveText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  // Logout (destructive)
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: '#F3C9C7', borderRadius: Radius.lg, paddingVertical: 15, marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
  logoutText: { color: Colors.error, fontSize: FontSize.md, fontWeight: FontWeight.semibold },

  version: { textAlign: 'center', fontSize: FontSize.xs, color: Colors.gray300, marginBottom: Spacing.sm },
});
