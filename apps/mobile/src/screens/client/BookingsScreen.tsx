import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, FontWeight, Gradients, Radius, Shadow, Spacing } from '../../theme';
import { bookingsApi, MyAppointment, AppointmentStatus } from '../../services/api/bookings';
import PunchCardsStrip from '../../components/client/PunchCardsStrip';

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; color: string; bg: string }> = {
  CONFIRMED: { label: 'Confirmat',     color: Colors.success, bg: '#DCFCE7' },
  PENDING:   { label: 'În așteptare',  color: Colors.warning, bg: '#FEF3C7' },
  REJECTED:  { label: 'Respinsă',      color: Colors.error,   bg: '#FEE2E2' },
  COMPLETED: { label: 'Finalizat',     color: Colors.gray500, bg: Colors.gray100 },
  NO_SHOW:   { label: 'Neprezentare',  color: Colors.error,   bg: '#FEE2E2' },
  CANCELLED: { label: 'Anulat',        color: Colors.error,   bg: '#FEE2E2' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const UPCOMING_STATUSES: AppointmentStatus[] = ['PENDING', 'CONFIRMED'];
const PAST_STATUSES:     AppointmentStatus[] = ['COMPLETED', 'NO_SHOW', 'CANCELLED', 'REJECTED'];

type MainTab = 'appointments' | 'giftcards' | 'abonamente' | 'produse';

const MAIN_TABS: { key: MainTab; label: string }[] = [
  { key: 'appointments', label: 'Programări' },
  { key: 'giftcards',    label: 'Gift Cards' },
  { key: 'abonamente',   label: 'Abonamente' },
  { key: 'produse',      label: 'Produse' },
];

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('ro-RO', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ── Shared empty/coming-soon layout ─────────────────────────────────────────────
// Both the appointments EmptyState and the ComingSoon blocks must start at the same
// vertical Y and use the same icon-box size so switching tabs never causes a jump.
// EmptyState renders inside the padded list (Spacing.lg), so ComingSoon — rendered
// directly under the header — adds that same amount to land at the identical Y.

const EMPTY_BLOCK_TOP = 72;

const EMPTY_ICON_BOX = {
  width: 96,
  height: 96,
  borderRadius: Radius.xl,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  marginBottom: Spacing.lg,
};

// ── ComingSoon ─────────────────────────────────────────────────────────────────

function ComingSoon({
  icon, title, subtitle,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
}) {
  return (
    <View style={cs.wrap}>
      <LinearGradient
        colors={Gradients.brand}
        start={Gradients.start}
        end={Gradients.end}
        style={cs.iconBox}
      >
        <Ionicons name={icon} size={44} color={Colors.white} />
      </LinearGradient>
      <View style={cs.soonPill}>
        <Text style={cs.soonText}>Soon</Text>
      </View>
      <Text style={cs.title}>{title}</Text>
      <Text style={cs.subtitle}>{subtitle}</Text>
    </View>
  );
}

const cs = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: Spacing.lg + EMPTY_BLOCK_TOP,
    paddingHorizontal: Spacing.lg + Spacing.xl,
  },
  iconBox: EMPTY_ICON_BOX,
  soonPill: {
    backgroundColor: Colors.coral,
    paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: Radius.full, marginBottom: Spacing.md,
  },
  soonText: {
    color: Colors.white, fontSize: FontSize.xs,
    fontWeight: FontWeight.bold, letterSpacing: 1.5,
  },
  title: {
    fontSize: FontSize.xl, fontWeight: FontWeight.bold,
    color: Colors.black, textAlign: 'center', marginBottom: 8,
  },
  subtitle: {
    fontSize: FontSize.sm, color: Colors.gray500,
    textAlign: 'center', lineHeight: 20,
  },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function BookingsScreen() {
  const router = useRouter();

  const [appointments, setAppointments] = useState<MyAppointment[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [error,        setError]        = useState(false);
  const [mainTab,      setMainTab]      = useState<MainTab>('appointments');
  const [cancelling,   setCancelling]   = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAppointments = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await bookingsApi.getMyAppointments();
      data.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
      setAppointments(data);
      setError(false);
    } catch {
      // No fake data — surface an error state instead of mock appointments.
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAppointments(); }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAppointments(true);
    }, [fetchAppointments]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAppointments(true);
  };

  // ── Cancel ─────────────────────────────────────────────────────────────────
  const handleCancel = (appt: MyAppointment) => {
    Alert.alert(
      'Anulează programarea',
      `Ești sigur că vrei să anulezi ${appt.serviceName} la ${appt.salonName} din ${formatDate(appt.date)} ora ${appt.time}?`,
      [
        { text: 'Nu', style: 'cancel' },
        {
          text: 'Anulează', style: 'destructive',
          onPress: async () => {
            setCancelling(appt.id);
            setAppointments((prev) =>
              prev.map((a) => a.id === appt.id ? { ...a, status: 'CANCELLED' } : a),
            );
            try {
              await bookingsApi.cancelAppointment(appt.id);
            } catch {
              setAppointments((prev) =>
                prev.map((a) => a.id === appt.id ? { ...a, status: appt.status } : a),
              );
              Alert.alert('Eroare', 'Nu s-a putut anula programarea. Încearcă din nou.');
            } finally {
              setCancelling(null);
            }
          },
        },
      ],
    );
  };

  // ── Detail ────────────────────────────────────────────────────────────────
  const handleDetail = (appt: MyAppointment) => {
    router.push({
      pathname: '/appointment-detail',
      params: {
        id:               appt.id,
        salonId:          appt.salonId,
        salonName:        appt.salonName,
        salonSlug:        appt.salonSlug,
        serviceId:        appt.serviceId,
        serviceName:      appt.serviceName,
        staffName:        appt.staffName,
        date:             appt.date,
        time:             appt.time,
        durationMin:      String(appt.durationMin),
        price:            String(appt.price),
        status:           appt.status,
        hasReview:        String(appt.hasReview),
        ...(appt.notes ? { notes: appt.notes } : {}),
      },
    });
  };

  // ── Rebook ────────────────────────────────────────────────────────────────
  const handleRebook = (appt: MyAppointment) => {
    router.push({
      pathname: '/(client)/booking',
      params: { salonId: appt.salonId, salonName: appt.salonName, serviceId: appt.serviceId },
    });
  };

  // ── Review ────────────────────────────────────────────────────────────────
  const handleReview = (appt: MyAppointment) => {
    router.push({
      pathname: '/(client)/review',
      params: {
        appointmentId: appt.id,
        salonName: appt.salonName,
        serviceName: appt.serviceName,
        date: appt.date,
      },
    });
  };

  // ── Derived lists ─────────────────────────────────────────────────────────
  // Upcoming: ascending by date/time (already sorted from fetch)
  const upcoming = appointments.filter((a) => UPCOMING_STATUSES.includes(a.status));
  // Past: most recent first (reverse of ascending)
  const past     = appointments
    .filter((a) => PAST_STATUSES.includes(a.status))
    .reverse();

  const hasAny = upcoming.length > 0 || past.length > 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Programările mele</Text>
      </View>

      {/* ── Top 4-segment scrollable pill row ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.segScrollView}
        contentContainerStyle={styles.segRow}
      >
        {MAIN_TABS.map(({ key, label }) => {
          const active = mainTab === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.segPill, active ? styles.segPillActive : styles.segPillInactive]}
              onPress={() => setMainTab(key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.segLabel, active ? styles.segLabelActive : styles.segLabelInactive]}>
                {label}
              </Text>
              {key === 'appointments' && !loading && upcoming.length > 0 && (
                <View style={[styles.segBadge, active ? styles.segBadgeOnActive : styles.segBadgeOnInactive]}>
                  <Text style={[styles.segBadgeText, active ? styles.segBadgeTextActive : styles.segBadgeTextInactive]}>
                    {upcoming.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Appointments segment ── */}
      {mainTab === 'appointments' && (
        loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={Colors.primary}
                colors={[Colors.primary]}
              />
            }
          >
            {error && !hasAny ? (
              <ErrorState onRetry={() => fetchAppointments()} />
            ) : !hasAny ? (
              <EmptyState onAction={() => router.push('/search')} />
            ) : (
              <>
                {/* Upcoming appointments (ascending) */}
                {upcoming.map((a) => (
                  <AppointmentCard
                    key={a.id}
                    appt={a}
                    isCancelling={cancelling === a.id}
                    onPress={() => handleDetail(a)}
                    onCancel={() => handleCancel(a)}
                    onRebook={() => handleRebook(a)}
                    onReview={() => handleReview(a)}
                  />
                ))}

                {/* Past appointments section */}
                {past.length > 0 && (
                  <>
                    <View style={styles.sectionDivider}>
                      <View style={styles.sectionLine} />
                      <Text style={styles.sectionLabel}>Trecute</Text>
                      <View style={styles.sectionLine} />
                    </View>
                    {past.map((a) => (
                      <AppointmentCard
                        key={a.id}
                        appt={a}
                        isCancelling={false}
                        onPress={() => handleDetail(a)}
                        onCancel={() => {}}
                        onRebook={() => handleRebook(a)}
                        onReview={() => handleReview(a)}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </ScrollView>
        )
      )}

      {/* ── Gift Cards segment ── */}
      {mainTab === 'giftcards' && (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Loyalty punch cards — self-hiding when the user has none */}
          <PunchCardsStrip />
          <ComingSoon
            icon="gift-outline"
            title="Gift Cards"
            subtitle="Oferă sau primește experiențe beauty. Cardurile cadou vor fi disponibile în curând."
          />
        </ScrollView>
      )}

      {/* ── Abonamente segment ── */}
      {mainTab === 'abonamente' && (
        <ComingSoon
          icon="card-outline"
          title="Abonamente"
          subtitle="Planuri recurente la saloanele tale preferate. Disponibil în curând."
        />
      )}

      {/* ── Produse segment ── */}
      {mainTab === 'produse' && (
        <ComingSoon
          icon="bag-handle-outline"
          title="Produse"
          subtitle="Cumpără produse recomandate de salonul tău. Disponibil în curând."
        />
      )}
    </SafeAreaView>
  );
}

// ── Appointment card ──────────────────────────────────────────────────────────

function AppointmentCard({
  appt: a, isCancelling, onPress, onCancel, onRebook, onReview,
}: {
  appt: MyAppointment;
  isCancelling: boolean;
  onPress: () => void;
  onCancel: () => void;
  onRebook: () => void;
  onReview: () => void;
}) {
  const cfg        = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.PENDING;
  // Only PENDING/CONFIRMED are cancellable — rejected/cancelled/finished never
  // offer "Anulează" again.
  const isUpcoming = UPCOMING_STATUSES.includes(a.status);
  const isCompleted = a.status === 'COMPLETED';
  const isCancelled =
    a.status === 'CANCELLED' || a.status === 'NO_SHOW' || a.status === 'REJECTED';

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[styles.card, isCancelled && styles.cardMuted]}
    >
      {/* ── Card header: salon + status pill ── */}
      <View style={styles.cardHead}>
        <View style={styles.cardHeadLeft}>
          <Text style={styles.salonName} numberOfLines={1}>{a.salonName}</Text>
          <Text style={styles.serviceName} numberOfLines={1}>{a.serviceName}</Text>
        </View>
        <View style={styles.cardHeadRight}>
          <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color={Colors.gray300} style={{ marginLeft: 4 }} />
        </View>
      </View>

      {/* ── Hairline divider ── */}
      <View style={styles.cardDivider} />

      {/* ── Details: date / time / staff ── */}
      <View style={styles.detailStrip}>
        <DetailCell icon="calendar-outline" value={formatDate(a.date)} />
        <DetailCell icon="time-outline"     value={a.time} />
        <DetailCell icon="person-outline"   value={a.staffName} />
      </View>

      {/* ── Footer: price + action buttons ── */}
      <View style={styles.cardFoot}>
        <Text style={styles.price}>{a.price} RON</Text>
        <View style={styles.actions}>
          {isUpcoming && a.status !== 'CANCELLED' && (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              disabled={isCancelling}
            >
              {isCancelling
                ? <ActivityIndicator size="small" color={Colors.error} />
                : <Text style={styles.cancelBtnText}>Anulează</Text>
              }
            </TouchableOpacity>
          )}

          {isCompleted && (
            <>
              {!a.hasReview && (
                <TouchableOpacity style={styles.reviewBtn} onPress={onReview}>
                  <Ionicons name="star-outline" size={13} color={Colors.star} />
                  <Text style={styles.reviewBtnText}>Recenzie</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.rebookBtn} onPress={onRebook}>
                <Ionicons name="refresh-outline" size={13} color={Colors.white} />
                <Text style={styles.rebookBtnText}>Rebook</Text>
              </TouchableOpacity>
            </>
          )}

          {isCancelled && (
            <TouchableOpacity style={styles.rebookBtn} onPress={onRebook}>
              <Ionicons name="refresh-outline" size={13} color={Colors.white} />
              <Text style={styles.rebookBtnText}>Rebook</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function DetailCell({ icon, value }: { icon: any; value: string }) {
  return (
    <View style={styles.detailCell}>
      <Ionicons name={icon} size={12} color={Colors.gray400} />
      <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function EmptyState({ onAction }: { onAction: () => void }) {
  return (
    <View style={styles.empty}>
      <LinearGradient
        colors={Gradients.brand}
        start={Gradients.start}
        end={Gradients.end}
        style={styles.emptyIconBox}
      >
        <Ionicons name="calendar" size={44} color={Colors.white} />
      </LinearGradient>
      <Text style={styles.emptyTitle}>Nicio programare</Text>
      <Text style={styles.emptySubtitle}>
        Programările tale viitoare și trecute vor apărea aici.
      </Text>
      <TouchableOpacity style={styles.emptyAction} onPress={onAction} activeOpacity={0.75}>
        <Text style={styles.emptyActionText}>Caută saloane</Text>
      </TouchableOpacity>
    </View>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIconBox, styles.errorIconBox]}>
        <Ionicons name="cloud-offline-outline" size={44} color={Colors.gray400} />
      </View>
      <Text style={styles.emptyTitle}>Nu am putut încărca programările</Text>
      <Text style={styles.emptySubtitle}>
        Verifică conexiunea la internet și încearcă din nou.
      </Text>
      <TouchableOpacity style={styles.emptyAction} onPress={onRetry} activeOpacity={0.75}>
        <Text style={styles.emptyActionText}>Reîncearcă</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // ── Header ──
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.black,
    letterSpacing: -0.5,
  },

  // ── Top 4-segment scrollable pill row ──
  segScrollView: { flexGrow: 0, marginBottom: Spacing.sm },
  segRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    alignItems: 'center',
    paddingVertical: 4,
  },
  segPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing.md, paddingVertical: 9,
    borderRadius: Radius.full,
  },
  segPillActive: {
    backgroundColor: Colors.primary,
  },
  segPillInactive: {
    backgroundColor: Colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  segLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  segLabelActive:   { color: Colors.white,  fontWeight: FontWeight.bold },
  segLabelInactive: { color: Colors.gray700 },

  // Badge: translucent white on active red pill; red on inactive white pill
  segBadge: {
    borderRadius: Radius.full,
    minWidth: 17, height: 17,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  segBadgeOnActive:   { backgroundColor: 'rgba(255,255,255,0.28)' },
  segBadgeOnInactive: { backgroundColor: Colors.primary },
  segBadgeText:         { fontSize: 9, fontWeight: FontWeight.bold },
  segBadgeTextActive:   { color: Colors.white },
  segBadgeTextInactive: { color: Colors.white },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.lg, paddingBottom: 130 },

  // ── Section divider ("Trecute") ──
  sectionDivider: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: Spacing.md, gap: Spacing.sm,
  },
  sectionLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  sectionLabel: {
    fontSize: FontSize.xs, color: Colors.gray400,
    fontWeight: FontWeight.semibold, letterSpacing: 0.5,
  },

  // ── Appointment card ──
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: 12,
    ...Shadow.md,
  },
  cardMuted: { opacity: 0.58 },

  cardHead: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: Spacing.sm,
  },
  cardHeadLeft: { flex: 1, paddingRight: 8 },
  cardHeadRight: { flexDirection: 'row', alignItems: 'center' },

  salonName: {
    fontSize: FontSize.md, fontWeight: FontWeight.bold,
    color: Colors.black, marginBottom: 2,
  },
  serviceName: { fontSize: FontSize.sm, color: Colors.gray500 },

  statusPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full,
  },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginBottom: Spacing.sm,
  },

  detailStrip: { flexDirection: 'row', marginBottom: Spacing.sm },
  detailCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailValue: { fontSize: FontSize.xs, color: Colors.gray700, flex: 1 },

  cardFoot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  price: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },

  cancelBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.error, minWidth: 44, alignItems: 'center',
  },
  cancelBtnText: { fontSize: FontSize.xs, color: Colors.error, fontWeight: FontWeight.semibold },

  reviewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.star,
  },
  reviewBtnText: { fontSize: FontSize.xs, color: Colors.star, fontWeight: FontWeight.semibold },

  rebookBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  rebookBtnText: { fontSize: FontSize.xs, color: Colors.white, fontWeight: FontWeight.semibold },

  // ── Empty state ──
  empty: {
    alignItems: 'center', paddingTop: EMPTY_BLOCK_TOP, paddingHorizontal: Spacing.xl,
  },
  emptyIconBox: EMPTY_ICON_BOX,
  errorIconBox: { backgroundColor: Colors.gray100 },
  emptyTitle: {
    fontSize: FontSize.xl, fontWeight: FontWeight.bold,
    color: Colors.black, marginBottom: 8, textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FontSize.sm, color: Colors.gray500,
    textAlign: 'center', lineHeight: 20, marginBottom: Spacing.lg,
  },
  emptyAction: {
    paddingHorizontal: Spacing.lg, paddingVertical: 11,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.primary,
  },
  emptyActionText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
});
