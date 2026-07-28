import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Colors, FontSize, FontWeight, Gradients, Radius, Shadow, Spacing } from '../../theme';
import { useBusinessStore, BusinessClient } from '../../store/businessStore';
import { businessApi } from '../../services/api/business';
import ClientSheet, {
  getInitials,
  NO_SHOW_RISK_THRESHOLD,
  VIP_VISIT_THRESHOLD,
  VipBadge,
} from '../../components/business/ClientSheet';
import PunchProgressSection from '../../components/business/PunchProgressSection';
import { DraggableSheetRef } from '../../components/common/DraggableSheet';

// ── Constants ─────────────────────────────────────────────────────────────────
const ERR_SALON = 'Nu am putut încărca salonul. Încearcă din nou.';
const ERR_CLIENTS = 'Nu am putut încărca clienții. Verifică conexiunea și încearcă din nou.';

// Soft accent tint (not part of the core palette).
const TINT_DANGER = '#FDE7E7';

// ── Helpers ───────────────────────────────────────────────────────────────────
// Format an ISO date into a short ro-RO label ("12 mar."). Falls back to the raw
// value if it isn't parseable, and null when missing.
function formatVisitDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ClientsScreen() {
  const { clients, setClients, updateClient, salonProfile, setSalonProfile } = useBusinessStore();
  const router = useRouter();
  const salonId = salonProfile?.id ?? null;

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<BusinessClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const clientSheetRef = useRef<DraggableSheetRef>(null);

  // Resolve the owner's salon once — the clients route needs a real UUID, so
  // 'my' won't work here. Prefer the store cache (set by the calendar) and only
  // hit the network when it's missing.
  const resolveSalon = useCallback(() => {
    setLoading(true);
    setError(null);
    businessApi.getSalonProfile()
      .then(setSalonProfile)
      .catch(() => { setError(ERR_SALON); setLoading(false); });
  }, [setSalonProfile]);

  const loadClients = useCallback((sid: string) => {
    setLoading(true);
    setError(null);
    return businessApi.getClients(sid)
      .then(setClients)
      .catch(() => setError(ERR_CLIENTS))
      .finally(() => setLoading(false));
  }, [setClients]);

  useEffect(() => {
    if (!salonProfile) resolveSalon();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (salonId) loadClients(salonId);
  }, [salonId, loadClients]);

  const handleRetry = () => {
    if (salonId) loadClients(salonId);
    else resolveSalon();
  };

  const filtered = clients.filter((c) =>
    `${c.firstName} ${c.lastName} ${c.phone ?? ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const totalVisits = clients.reduce((sum, c) => sum + c.totalVisits, 0);
  const vipCount = clients.filter((c) => c.totalVisits >= VIP_VISIT_THRESHOLD).length;
  const noShowRisk = clients.filter((c) => c.noShowCount >= NO_SHOW_RISK_THRESHOLD).length;

  const count = clients.length;
  const subtitle = loading
    ? 'Se încarcă clienții...'
    : error
      ? 'Eroare la încărcare'
      : `${count} ${count === 1 ? 'client' : 'clienți'} în total`;

  const showList = !loading && !error && count > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Brand-gradient hero header */}
      <LinearGradient
        colors={Gradients.brand}
        start={Gradients.start}
        end={Gradients.end}
        style={styles.hero}
      >
        <Text style={styles.heroTitle}>Clienți</Text>
        <Text style={styles.heroSubtitle}>{subtitle}</Text>

        {showList && (
          <View style={styles.heroStats}>
            <HeroStat value={String(totalVisits)} label="Vizite" />
            <View style={styles.heroDivider} />
            <HeroStat value={String(vipCount)} label="VIP" />
            <View style={styles.heroDivider} />
            <HeroStat value={String(noShowRisk)} label="Risc no-show" />
          </View>
        )}
      </LinearGradient>

      {/* Search pill — shown once there are clients to filter */}
      {showList && (
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.gray500} />
          <TextInput
            style={styles.searchInput}
            placeholder="Caută după nume sau telefon..."
            placeholderTextColor={Colors.gray400}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={Colors.gray300} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Body states */}
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={handleRetry} />}
      {!loading && !error && count === 0 && <EmptyState />}

      {showList && (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {filtered.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onPress={() => {
                setSelected(client);
                clientSheetRef.current?.present();
              }}
            />
          ))}
          {filtered.length === 0 && (
            <View style={styles.noResults}>
              <Ionicons name="search-outline" size={28} color={Colors.gray300} />
              <Text style={styles.noResultsText}>Niciun client găsit</Text>
            </View>
          )}
        </ScrollView>
      )}

      <ClientSheet
        ref={clientSheetRef}
        client={selected}
        salonId={salonId}
        onDismiss={() => setSelected(null)}
        onClientUpdate={(updated) => {
          updateClient(updated);
          setSelected(updated);
        }}
        onViewAppointments={() => {
          clientSheetRef.current?.dismiss();
          router.push('/(business)');
        }}
      >
        {/* Loyalty punch-card progress — fetched lazily when the sheet opens */}
        {selected && salonId && (
          <PunchProgressSection salonId={salonId} clientId={selected.id} />
        )}
      </ClientSheet>
    </SafeAreaView>
  );
}

// ── Hero stat ─────────────────────────────────────────────────────────────────
function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

// ── Body states ───────────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <View style={styles.centerState}>
      <ActivityIndicator color={Colors.primary} size="large" />
      <Text style={styles.centerStateText}>Se încarcă clienții...</Text>
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.centerState}>
      <View style={styles.stateIconCircle}>
        <Ionicons name="cloud-offline-outline" size={34} color={Colors.error} />
      </View>
      <Text style={styles.stateTitle}>Ceva n-a mers</Text>
      <Text style={styles.stateSubtitle}>{message}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.85}>
        <Ionicons name="refresh" size={18} color={Colors.white} />
        <Text style={styles.retryBtnText}>Reîncearcă</Text>
      </TouchableOpacity>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.centerState}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="people-outline" size={40} color={Colors.primary} />
      </View>
      <Text style={styles.stateTitle}>Încă niciun client</Text>
      <Text style={styles.stateSubtitle}>
        Clienții apar aici automat după prima programare.
      </Text>
    </View>
  );
}

// ── Client card ───────────────────────────────────────────────────────────────
function ClientCard({ client, onPress }: { client: BusinessClient; onPress: () => void }) {
  const initials = getInitials(client);
  const isVip = client.totalVisits >= VIP_VISIT_THRESHOLD;
  const isRisk = client.noShowCount >= NO_SHOW_RISK_THRESHOLD;
  const lastVisit = formatVisitDate(client.lastVisitAt);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <LinearGradient
        colors={Gradients.brand}
        start={Gradients.start}
        end={Gradients.end}
        style={styles.avatar}
      >
        <Text style={styles.avatarInitials}>{initials}</Text>
      </LinearGradient>

      <View style={styles.cardBody}>
        <View style={styles.cardNameRow}>
          <Text style={styles.cardName} numberOfLines={1}>
            {client.firstName} {client.lastName}
          </Text>
          {isVip && <VipBadge />}
          {client.isBlocked && (
            <View style={styles.blockedBadge}>
              <Text style={styles.blockedBadgeText}>Blocat</Text>
            </View>
          )}
        </View>

        <Text style={styles.cardPhone} numberOfLines={1}>
          {client.phone ?? 'Fără telefon'}
        </Text>

        <View style={styles.statsRow}>
          <StatChip icon="calendar-outline" label={`${client.totalVisits} vizite`} />
          {client.noShowCount > 0 && (
            <StatChip
              icon="alert-circle-outline"
              label={`${client.noShowCount} absențe`}
              danger={isRisk}
            />
          )}
          {lastVisit && <StatChip icon="time-outline" label={lastVisit} />}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={Colors.gray300} />
    </TouchableOpacity>
  );
}

function StatChip({ icon, label, danger }: { icon: any; label: string; danger?: boolean }) {
  return (
    <View style={[styles.statChip, danger && styles.statChipDanger]}>
      <Ionicons name={icon} size={12} color={danger ? Colors.error : Colors.gray500} />
      <Text style={[styles.statChipText, danger && { color: Colors.error }]}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // Hero
  hero: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    ...Shadow.brand,
  },
  heroTitle: { fontSize: FontSize.xxxl, fontWeight: FontWeight.heavy, color: Colors.white },
  heroSubtitle: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  heroStats: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.lg, paddingVertical: Spacing.sm, marginTop: Spacing.md,
  },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontSize: FontSize.xl, fontWeight: FontWeight.heavy, color: Colors.white },
  heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 2, textAlign: 'center' },
  heroDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.25)' },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.white, borderRadius: Radius.pill,
    marginHorizontal: Spacing.lg, paddingHorizontal: Spacing.md, paddingVertical: 12,
    marginBottom: Spacing.sm, ...Shadow.sm,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.black },

  // List
  list: { flex: 1 },
  listContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xs, paddingBottom: 100 },

  // Client card
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + 2,
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    padding: Spacing.md, marginBottom: Spacing.sm + 2, ...Shadow.md,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.white },
  cardBody: { flex: 1 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardName: { flexShrink: 1, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.black },
  cardPhone: { fontSize: FontSize.xs, color: Colors.gray500, marginTop: 2 },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  statChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.gray50, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  statChipDanger: { backgroundColor: TINT_DANGER },
  statChipText: { fontSize: 11, color: Colors.gray700, fontWeight: FontWeight.medium },

  // Badges
  blockedBadge: {
    backgroundColor: TINT_DANGER, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  blockedBadgeText: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.error },

  // Center states (loading / error / empty)
  centerState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing.xl, paddingBottom: 80,
  },
  centerStateText: { fontSize: FontSize.sm, color: Colors.gray500, marginTop: Spacing.md },
  emptyIconCircle: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
  },
  stateIconCircle: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: TINT_DANGER,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
  },
  stateTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black, marginBottom: 6 },
  stateSubtitle: { fontSize: FontSize.sm, color: Colors.gray500, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg, paddingVertical: 12, marginTop: Spacing.lg, ...Shadow.brand,
  },
  retryBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },

  noResults: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  noResultsText: { fontSize: FontSize.sm, color: Colors.gray500 },
});
