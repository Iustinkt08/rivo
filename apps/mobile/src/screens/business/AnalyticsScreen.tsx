import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Colors, FontSize, FontWeight, Gradients, Radius, Shadow, Spacing,
} from '../../theme';
import { useBusinessStore } from '../../store/businessStore';
import { useIsStaffSession } from '../../store/authStore';
import {
  AnalyticsBar, AnalyticsQuery, businessApi, BusinessAnalytics,
} from '../../services/api/business';

// ── Types & constants ─────────────────────────────────────────────────────────

type Preset = 'week' | 'month' | 'year';
type Period = Preset | 'custom';

const H_PAD = Spacing.lg;      // 24 — mirror the client home gutters
const CHART_H = 150;
const CUSTOM_DEFAULT_SPAN_DAYS = 30;

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: 'week', label: 'Săptămână' },
  { key: 'month', label: 'Lună' },
  { key: 'year', label: 'An' },
  { key: 'custom', label: 'Personalizat' },
];

const PERIOD_TITLES: Record<Period, string> = {
  week: 'Săptămâna aceasta',
  month: 'Luna aceasta',
  year: 'Ultimele 12 luni',
  custom: 'Interval personalizat',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// Currency shown the Romanian way: grouped thousands + "lei" (e.g. 1.234 lei).
function formatRon(n: number): string {
  return `${Math.round(n).toLocaleString('ro-RO')} lei`;
}

// Local YYYY-MM-DD (what the analytics API expects for custom ranges).
function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Short human date, e.g. "3 iul. 2026".
function formatHumanDate(d: Date): string {
  return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });
}

// The resolved window subtitle from the server-provided ISO bounds.
function formatResolvedPeriod(fromIso?: string, toIso?: string): string {
  if (!fromIso || !toIso) return 'Privire de ansamblu';
  return `${formatHumanDate(new Date(fromIso))} – ${formatHumanDate(new Date(toIso))}`;
}

// ── Period selector (preset chips + custom) ────────────────────────────────────

function PeriodSelector({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <View style={styles.chipRow}>
      {PERIOD_OPTIONS.map((opt) => {
        const active = value === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[styles.chip, active && styles.chipActive]}
            activeOpacity={0.85}
            onPress={() => onChange(opt.key)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Custom date range fields ───────────────────────────────────────────────────

function CustomRange({
  from, to, invalid, onPickFrom, onPickTo,
}: {
  from: Date; to: Date; invalid: boolean;
  onPickFrom: () => void; onPickTo: () => void;
}) {
  return (
    <View>
      <View style={styles.dateRow}>
        <TouchableOpacity style={styles.dateField} activeOpacity={0.8} onPress={onPickFrom}>
          <Ionicons name="calendar-outline" size={16} color={Colors.gray500} />
          <View style={styles.dateFieldText}>
            <Text style={styles.dateFieldLabel}>De la</Text>
            <Text style={styles.dateFieldValue}>{formatHumanDate(from)}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dateField} activeOpacity={0.8} onPress={onPickTo}>
          <Ionicons name="calendar-outline" size={16} color={Colors.gray500} />
          <View style={styles.dateFieldText}>
            <Text style={styles.dateFieldLabel}>Până la</Text>
            <Text style={styles.dateFieldValue}>{formatHumanDate(to)}</Text>
          </View>
        </TouchableOpacity>
      </View>
      {invalid && (
        <Text style={styles.errorText}>
          Data de început trebuie să fie înainte de data de sfârșit.
        </Text>
      )}
    </View>
  );
}

// ── Hero (brand-gradient revenue summary) ─────────────────────────────────────

function HeroCard({ revenue, completedCount, appointmentCount, rangeLabel }: {
  revenue: number; completedCount: number; appointmentCount: number; rangeLabel: string;
}) {
  return (
    <LinearGradient
      colors={Gradients.brand}
      start={Gradients.start}
      end={Gradients.end}
      style={styles.hero}
    >
      <View style={styles.heroTopRow}>
        <View style={styles.heroChip}>
          <Ionicons name="trending-up" size={13} color={Colors.white} />
          <Text style={styles.heroChipText}>Venituri</Text>
        </View>
        <Text style={styles.heroRange}>{rangeLabel}</Text>
      </View>
      <Text style={styles.heroValue}>{formatRon(revenue)}</Text>
      <Text style={styles.heroSub}>
        {completedCount} finalizate · {appointmentCount} programări în total
      </Text>
    </LinearGradient>
  );
}

// ── KPI cards ─────────────────────────────────────────────────────────────────

function KpiCard({ icon, value, label, color }: {
  icon: any; value: string; label: string; color: string;
}) {
  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIcon, { backgroundColor: color + '1A' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

// ── Bar chart (server-provided labels + values) ────────────────────────────────

function BarChart({ bars }: { bars: AnalyticsBar[] }) {
  const hasBars = bars.length > 0;
  const values = bars.map((b) => b.value);
  const hasData = values.some((v) => v > 0);
  const maxVal = Math.max(...values, 1);
  const topIdx = hasData ? values.indexOf(Math.max(...values)) : -1;
  // Narrower bars as the bucket count grows (year = 12, custom daily up to 31).
  const barW = bars.length > 12 ? 10 : bars.length > 8 ? 16 : bars.length > 5 ? 22 : 36;

  if (!hasBars) {
    return (
      <View style={[styles.chartCard, styles.chartEmptyCard]}>
        <Text style={styles.emptyText}>Nicio dată încă</Text>
      </View>
    );
  }

  return (
    <View style={styles.chartCard}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={bars.length > 8 ? styles.chartScroll : styles.chartScrollFit}
      >
        <View style={styles.chartBars}>
          {bars.map((b, i) => {
            const barH = hasData ? Math.max(6, Math.round(CHART_H * (b.value / maxVal))) : 6;
            const isTop = i === topIdx;
            return (
              <View key={`${b.label}-${i}`} style={[styles.barCol, bars.length > 8 && styles.barColFixed]}>
                <Text style={styles.barValueSlot} numberOfLines={1}>
                  {isTop ? formatRon(b.value) : ''}
                </Text>
                <View style={styles.barTrack}>
                  {isTop ? (
                    <LinearGradient
                      colors={Gradients.brand}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={[styles.bar, { width: barW, height: barH }]}
                    />
                  ) : (
                    <View style={[styles.bar, styles.barIdle, { width: barW, height: barH }]} />
                  )}
                </View>
                <Text style={[styles.barLabel, isTop && styles.barLabelActive]} numberOfLines={1}>
                  {b.label}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
      {!hasData && (
        <View style={styles.chartOverlay} pointerEvents="none">
          <Text style={styles.emptyText}>Nicio dată încă</Text>
        </View>
      )}
    </View>
  );
}

// ── Top list (services / staff) ───────────────────────────────────────────────

interface TopRow { id: string; name: string; count: number; revenue: number; }

function TopList({ rows, emptyLabel }: { rows: TopRow[]; emptyLabel: string }) {
  if (rows.length === 0) {
    return (
      <View style={styles.listCard}>
        <View style={styles.emptyRow}>
          <Text style={styles.emptyText}>{emptyLabel}</Text>
        </View>
      </View>
    );
  }
  const maxCount = Math.max(...rows.map((r) => r.count), 1);
  return (
    <View style={styles.listCard}>
      {rows.map((r, i) => {
        const pct = Math.round((r.count / maxCount) * 100);
        const isFirst = i === 0;
        return (
          <View key={r.id} style={[styles.rankRow, i < rows.length - 1 && styles.rankRowBorder]}>
            {isFirst ? (
              <LinearGradient
                colors={Gradients.brand}
                start={Gradients.start}
                end={Gradients.end}
                style={styles.rankBadge}
              >
                <Text style={[styles.rankNum, styles.rankNumTop]}>1</Text>
              </LinearGradient>
            ) : (
              <View style={[styles.rankBadge, styles.rankBadgeIdle]}>
                <Text style={styles.rankNum}>{i + 1}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={styles.rankTop}>
                <Text style={styles.rankName} numberOfLines={1}>{r.name}</Text>
                <Text style={styles.rankRevenue}>{formatRon(r.revenue)}</Text>
              </View>
              <View style={styles.rankTrack}>
                <LinearGradient
                  colors={Gradients.brandSoft}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.rankFill, { width: `${pct}%` }]}
                />
              </View>
              <Text style={styles.rankCount}>{r.count} programări</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const { salonProfile, setSalonProfile } = useBusinessStore();
  const salonId = salonProfile?.id ?? null;
  // Staff mode: the backend scopes the same endpoint to the caller's own
  // appointments — the UI only adjusts labels and hides salon-wide sections.
  const isStaffSession = useIsStaffSession();

  const [period, setPeriod] = useState<Period>('week');
  const [customFrom, setCustomFrom] = useState<Date>(
    () => new Date(Date.now() - CUSTOM_DEFAULT_SPAN_DAYS * 86_400_000),
  );
  const [customTo, setCustomTo] = useState<Date>(() => new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const [data, setData] = useState<BusinessAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const isCustom = period === 'custom';
  const invalidRange = isCustom && toYmd(customFrom) > toYmd(customTo);

  // The query that drives the fetch — presets use `range`, custom uses `from/to`.
  const query = useMemo<AnalyticsQuery>(
    () => (isCustom ? { from: toYmd(customFrom), to: toYmd(customTo) } : { range: period }),
    [isCustom, period, customFrom, customTo],
  );

  // Resolve the owner's salon once — the analytics route needs the real UUID,
  // the literal 'my' won't work here (same resolution as the calendar).
  // Staff sessions already carry their salon (seeded at login) and must not
  // call the admin-only /salons/my/salon.
  useEffect(() => {
    if (!salonProfile && !isStaffSession) {
      businessApi.getSalonProfile().then(setSalonProfile).catch(() => {});
    }
  }, []);

  // Fetch analytics whenever the salon or the selected period changes.
  useEffect(() => {
    if (!salonId || invalidRange) return;
    let cancelled = false;
    setLoading(true);
    businessApi.getAnalytics(salonId, query)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [salonId, query, invalidRange]);

  // Honest zeros / empty state when there is no data — never invented numbers.
  const revenue = data?.revenue ?? 0;
  const appointmentCount = data?.appointmentCount ?? 0;
  const completedCount = data?.completedCount ?? 0;
  const bars = data?.bars ?? [];
  const topServices = data?.topServices ?? [];
  const topStaff = data?.topStaff ?? [];

  const completionRate = appointmentCount > 0
    ? Math.round((completedCount / appointmentCount) * 100)
    : 0;

  const rangeLabel = PERIOD_TITLES[period];
  const resolvedPeriod = formatResolvedPeriod(data?.from, data?.to);
  const showSpinner = loading && !data;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {isStaffSession ? 'Analizele mele' : 'Analize'}
              </Text>
              <Text style={styles.subtitle}>{resolvedPeriod}</Text>
            </View>
            {loading && data && <ActivityIndicator color={Colors.primary} size="small" />}
          </View>

          <PeriodSelector value={period} onChange={setPeriod} />

          {isCustom && (
            <View style={styles.customBlock}>
              <CustomRange
                from={customFrom}
                to={customTo}
                invalid={invalidRange}
                onPickFrom={() => setShowFromPicker(true)}
                onPickTo={() => setShowToPicker(true)}
              />
            </View>
          )}
        </View>

        {/* Date pickers (Android dialog; iOS spinner rendered inline) */}
        {showFromPicker && (
          <DateTimePicker
            value={customFrom}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={(_, d) => {
              if (Platform.OS === 'android') setShowFromPicker(false);
              if (d) setCustomFrom(d);
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
            value={customTo}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={(_, d) => {
              if (Platform.OS === 'android') setShowToPicker(false);
              if (d) setCustomTo(d);
            }}
          />
        )}
        {showToPicker && Platform.OS === 'ios' && (
          <TouchableOpacity style={styles.dateConfirmBtn} onPress={() => setShowToPicker(false)}>
            <Text style={styles.dateConfirmText}>Gata</Text>
          </TouchableOpacity>
        )}

        {showSpinner ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          <>
            {/* Revenue hero */}
            <HeroCard
              revenue={revenue}
              completedCount={completedCount}
              appointmentCount={appointmentCount}
              rangeLabel={rangeLabel}
            />

            {/* KPI row */}
            <View style={styles.kpiRow}>
              <KpiCard icon="calendar-outline" value={String(appointmentCount)} label="Programări" color={Colors.primary} />
              <KpiCard icon="checkmark-done-outline" value={String(completedCount)} label="Finalizate" color={Colors.success} />
              <KpiCard icon="pie-chart-outline" value={`${completionRate}%`} label="Rată finalizare" color={Colors.coral} />
            </View>

            {/* Bar chart */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Venituri</Text>
              <BarChart bars={bars} />
            </View>

            {/* Top services */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top servicii</Text>
              <TopList rows={topServices} emptyLabel="Niciun serviciu încă" />
            </View>

            {/* Top staff — salon-wide ranking, meaningless for a single staff
                member whose data is already scoped to themselves. */}
            {!isStaffSession && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Top specialiști</Text>
                <TopList rows={topStaff} emptyLabel="Niciun specialist încă" />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },

  // Header
  header: { paddingHorizontal: H_PAD, paddingTop: Spacing.sm, paddingBottom: Spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.ink },
  subtitle: { fontSize: FontSize.sm, color: Colors.gray500, marginTop: 2 },

  // Period selector (wrapping pill chips)
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.md },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full,
    backgroundColor: Colors.gray100,
  },
  chipActive: { backgroundColor: Colors.primary, ...Shadow.sm },
  chipText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.gray500 },
  chipTextActive: { color: Colors.white },

  // Custom range
  customBlock: { marginTop: Spacing.md },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateField: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10,
  },
  dateFieldText: { flex: 1 },
  dateFieldLabel: { fontSize: FontSize.xs, color: Colors.gray400 },
  dateFieldValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink, marginTop: 1 },
  errorText: { marginTop: 8, fontSize: FontSize.xs, color: Colors.coral, fontWeight: FontWeight.medium },

  // iOS date confirm button
  dateConfirmBtn: {
    alignSelf: 'flex-end', marginRight: H_PAD, marginTop: 8,
    paddingVertical: 8, paddingHorizontal: 20,
    backgroundColor: Colors.primary, borderRadius: Radius.full,
  },
  dateConfirmText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  loadingBlock: { paddingVertical: 80, alignItems: 'center', justifyContent: 'center' },

  // Hero
  hero: {
    marginHorizontal: H_PAD, marginTop: Spacing.sm,
    borderRadius: Radius.xl, padding: Spacing.lg, ...Shadow.brand,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  heroChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: Radius.full,
  },
  heroChipText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  heroRange: { color: 'rgba(255,255,255,0.85)', fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  heroValue: { color: Colors.white, fontSize: 40, lineHeight: 46, fontWeight: FontWeight.heavy, letterSpacing: -0.5 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: FontSize.sm, marginTop: 6 },

  // KPI row
  kpiRow: { flexDirection: 'row', gap: 10, paddingHorizontal: H_PAD, marginTop: Spacing.md },
  kpiCard: {
    flex: 1, backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing.md, ...Shadow.md,
  },
  kpiIcon: { width: 34, height: 34, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  kpiValue: { fontSize: FontSize.xl, fontWeight: FontWeight.heavy, color: Colors.ink },
  kpiLabel: { fontSize: FontSize.xs, color: Colors.gray500, marginTop: 3 },

  // Section
  section: { marginHorizontal: H_PAD, marginTop: Spacing.lg },
  sectionTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.semibold, color: Colors.primary, marginBottom: Spacing.sm },

  // Bar chart
  chartCard: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.md, ...Shadow.md },
  chartEmptyCard: { height: CHART_H + 40, alignItems: 'center', justifyContent: 'center' },
  chartScrollFit: { flexGrow: 1 },
  chartScroll: { paddingRight: 4 },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', flexGrow: 1 },
  barCol: { flex: 1, alignItems: 'center' },
  barColFixed: { flex: 0, width: 34 },
  barValueSlot: { height: 16, fontSize: 9, color: Colors.primary, fontWeight: FontWeight.bold },
  barTrack: { height: CHART_H, width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  bar: { borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  barIdle: { backgroundColor: Colors.primaryLight },
  barLabel: { fontSize: FontSize.xs, color: Colors.gray400, marginTop: 8 },
  barLabelActive: { color: Colors.primary, fontWeight: FontWeight.bold },
  chartOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },

  // Top lists
  listCard: { backgroundColor: Colors.white, borderRadius: Radius.xl, paddingHorizontal: Spacing.md, ...Shadow.md },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rankRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  rankBadge: { width: 30, height: 30, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  rankBadgeIdle: { backgroundColor: Colors.primaryLight },
  rankNum: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  rankNumTop: { color: Colors.white },
  rankTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rankName: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink, marginRight: 8 },
  rankRevenue: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  rankTrack: { height: 5, backgroundColor: Colors.gray100, borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  rankFill: { height: 5, borderRadius: 3 },
  rankCount: { fontSize: FontSize.xs, color: Colors.gray400, marginTop: 5 },

  // Empty states
  emptyRow: { paddingVertical: 28, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: FontSize.sm, color: Colors.gray400, fontWeight: FontWeight.medium },
});
