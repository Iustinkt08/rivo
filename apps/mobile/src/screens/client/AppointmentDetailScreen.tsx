import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { Colors, FontSize, FontWeight, Radius, Shadow, Spacing } from '../../theme';
import { bookingsApi, AppointmentStatus, MyAppointment } from '../../services/api/bookings';
import { salonsApi } from '../../services/api/salons';
import { SalonProfile } from '../../store/salonStore';

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; color: string; bg: string; icon: string }> = {
  CONFIRMED: { label: 'Confirmat',    color: Colors.success, bg: '#DCFCE7', icon: 'checkmark-circle-outline' },
  PENDING:   { label: 'În așteptare', color: Colors.warning, bg: '#FEF3C7', icon: 'time-outline'             },
  REJECTED:  { label: 'Respinsă',     color: Colors.error,   bg: '#FEE2E2', icon: 'remove-circle-outline'    },
  COMPLETED: { label: 'Finalizat',    color: Colors.gray500, bg: Colors.gray100, icon: 'checkmark-done-outline' },
  NO_SHOW:   { label: 'Neprezentare', color: Colors.error,   bg: '#FEE2E2', icon: 'close-circle-outline'     },
  CANCELLED: { label: 'Anulat',       color: Colors.error,   bg: '#FEE2E2', icon: 'ban-outline'              },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('ro-RO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

type DetailParams = Partial<{
  id: string;
  salonId: string;
  salonName: string;
  salonSlug: string;
  serviceId: string;
  serviceName: string;
  staffName: string;
  date: string;
  time: string;
  durationMin: string;
  price: string;
  status: AppointmentStatus;
  hasReview: string;
  notes: string;
}>;

/**
 * Builds the appointment from navigation params when the caller passed the
 * full payload (Bookings list). Notification taps only carry an id — then this
 * returns null and the screen fetches live data instead.
 */
function paramsToDetail(params: DetailParams): MyAppointment | null {
  if (!params.id || !params.serviceName || !params.date || !params.time) {
    return null;
  }
  return {
    id: params.id,
    salonId: params.salonId ?? '',
    salonName: params.salonName ?? '',
    salonSlug: params.salonSlug ?? '',
    serviceId: params.serviceId ?? '',
    serviceName: params.serviceName,
    staffName: params.staffName ?? '',
    date: params.date,
    time: params.time,
    durationMin: Number(params.durationMin ?? 0),
    price: Number(params.price ?? 0),
    status: params.status ?? 'PENDING',
    hasReview: params.hasReview === 'true',
    notes: params.notes || undefined,
  };
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AppointmentDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<DetailParams>();

  const paramDetail = useMemo(() => paramsToDetail(params), [params.id]);
  const [fetched, setFetched] = useState<MyAppointment | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const [salon, setSalon] = useState<SalonProfile | null>(null);
  const [loadingSalon, setLoadingSalon] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  // Live data wins over (possibly stale) navigation params.
  const appt = fetched ?? paramDetail;

  // Always refresh from the API: notification taps arrive with only an id, and
  // list taps may carry a stale status. Params (when present) render instantly.
  const loadAppointment = useCallback(() => {
    if (!params.id) { setLoadFailed(true); return; }
    setLoadFailed(false);
    bookingsApi.getAppointmentById(params.id)
      .then(setFetched)
      .catch(() => {
        // Params still render the detail; only id-only opens show the error state.
        setLoadFailed(true);
      });
  }, [params.id]);

  useEffect(() => { loadAppointment(); }, [loadAppointment]);

  const status      = appt?.status ?? 'PENDING';
  const cfg         = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  const isUpcoming  = status === 'PENDING' || status === 'CONFIRMED';
  const isCompleted = status === 'COMPLETED';
  const isCancelled =
    status === 'CANCELLED' || status === 'NO_SHOW' || status === 'REJECTED';
  const hasReview   = appt?.hasReview ?? false;

  // Fetch salon profile for phone, address, map
  useEffect(() => {
    if (!appt?.salonSlug) { setLoadingSalon(false); return; }
    salonsApi.getProfile(appt.salonSlug)
      .then(setSalon)
      .catch(() => {})
      .finally(() => setLoadingSalon(false));
  }, [appt?.salonSlug]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleCall = () => {
    if (!salon?.phone) return;
    Linking.openURL(`tel:${salon.phone}`);
  };

  const handleDirections = () => {
    if (!salon) return;
    const q = salon.latitude && salon.longitude
      ? `${salon.latitude},${salon.longitude}`
      : encodeURIComponent(`${salon.addressLine1}, ${salon.city}`);
    Linking.openURL(`https://maps.google.com/?q=${q}`);
  };

  const handleCancel = () => {
    if (!appt) return;
    Alert.alert(
      'Anulează programarea',
      `Ești sigur că vrei să anulezi ${appt.serviceName} la ${appt.salonName} din ${formatDate(appt.date)} ora ${appt.time}?`,
      [
        { text: 'Nu', style: 'cancel' },
        {
          text: 'Anulează',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await bookingsApi.cancelAppointment(appt.id);
              router.back();
            } catch {
              Alert.alert('Eroare', 'Nu s-a putut anula programarea. Încearcă din nou.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  const handleRebook = () => {
    if (!appt) return;
    router.push({
      pathname: '/(client)/booking',
      params: { salonId: appt.salonId, salonName: appt.salonName, serviceId: appt.serviceId },
    });
  };

  const handleReview = () => {
    if (!appt) return;
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

  // ── Render ─────────────────────────────────────────────────────────────────

  // Id-only opens (notification taps) have nothing to show until the live
  // fetch resolves — render an explicit loading / error state instead.
  if (!appt) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={24} color={Colors.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalii programare</Text>
          <View style={{ width: 24 }} />
        </View>
        {loadFailed ? (
          <View style={styles.stateWrap}>
            <Ionicons name="cloud-offline-outline" size={40} color={Colors.gray300} />
            <Text style={styles.stateTitle}>Nu am putut încărca programarea</Text>
            <Text style={styles.stateText}>Verifică conexiunea la internet și încearcă din nou.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadAppointment} activeOpacity={0.8}>
              <Text style={styles.retryBtnText}>Reîncearcă</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.stateWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalii programare</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Status hero */}
        <View style={[styles.heroCard, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon as any} size={40} color={cfg.color} />
          <View style={styles.heroText}>
            <Text style={[styles.heroStatus, { color: cfg.color }]}>{cfg.label}</Text>
            <Text style={styles.heroSalon} numberOfLines={1}>{appt.salonName}</Text>
            <Text style={styles.heroService} numberOfLines={1}>{appt.serviceName}</Text>
          </View>
        </View>

        {/* Details card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Detalii rezervare</Text>
          <Row icon="calendar-outline"  label="Data"        value={formatDate(appt.date)} />
          <Row icon="time-outline"      label="Ora"         value={appt.time} />
          <Row icon="person-outline"    label="Specialist"  value={appt.staffName} />
          <Row icon="timer-outline"     label="Durată"      value={`${appt.durationMin} min`} />
          <Row icon="pricetag-outline"  label="Preț"        value={`${appt.price} RON`} valueStyle={styles.priceValue} />

          {appt.notes ? (
            <Row icon="chatbubble-ellipses-outline" label="Mențiuni" value={appt.notes} />
          ) : null}
        </View>

        {/* Map + Salon contact */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Salon</Text>

          {/* Map */}
          {!loadingSalon && salon?.latitude && salon?.longitude ? (
            <View style={styles.mapWrap}>
              <MapView
                provider={PROVIDER_DEFAULT}
                style={styles.map}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
                initialRegion={{
                  latitude: salon.latitude,
                  longitude: salon.longitude,
                  latitudeDelta: 0.008,
                  longitudeDelta: 0.008,
                }}
              >
                <Marker
                  coordinate={{ latitude: salon.latitude, longitude: salon.longitude }}
                  title={salon.name}
                  description={salon.addressLine1}
                />
              </MapView>
              <TouchableOpacity style={styles.mapOverlay} onPress={handleDirections} activeOpacity={0.85}>
                <Ionicons name="expand-outline" size={16} color={Colors.white} />
                <Text style={styles.mapOverlayText}>Deschide în Maps</Text>
              </TouchableOpacity>
            </View>
          ) : loadingSalon ? (
            <View style={styles.mapPlaceholder}>
              <Ionicons name="map-outline" size={28} color={Colors.gray300} />
            </View>
          ) : (
            <View style={styles.mapPlaceholder}>
              <Ionicons name="location-outline" size={24} color={Colors.gray300} />
              <Text style={styles.mapPlaceholderText}>Harta indisponibilă</Text>
            </View>
          )}

          {/* Address row */}
          {salon && (
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={16} color={Colors.primary} />
              <Text style={styles.addressText} numberOfLines={2}>
                {salon.addressLine1}, {salon.city}
              </Text>
            </View>
          )}

          {/* Call + Directions buttons */}
          <View style={styles.contactRow}>
            <TouchableOpacity
              style={[styles.contactBtn, !salon?.phone && styles.contactBtnDisabled]}
              onPress={handleCall}
              disabled={!salon?.phone}
              activeOpacity={0.8}
            >
              <Ionicons name="call-outline" size={18} color={salon?.phone ? Colors.primary : Colors.gray300} />
              <Text style={[styles.contactBtnText, !salon?.phone && { color: Colors.gray300 }]}>
                Sună salonul
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.contactBtn, styles.contactBtnFilled]}
              onPress={handleDirections}
              disabled={!salon}
              activeOpacity={0.8}
            >
              <Ionicons name="navigate-outline" size={18} color={Colors.white} />
              <Text style={[styles.contactBtnText, { color: Colors.white }]}>
                Obține direcții
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Actions */}
        {isUpcoming && (
          <TouchableOpacity
            style={[styles.cancelBtn, cancelling && { opacity: 0.6 }]}
            onPress={handleCancel}
            disabled={cancelling}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle-outline" size={18} color={Colors.error} />
            <Text style={styles.cancelBtnText}>
              {cancelling ? 'Se anulează...' : 'Anulează programarea'}
            </Text>
          </TouchableOpacity>
        )}

        {isCompleted && (
          <View style={styles.actionsRow}>
            {!hasReview && (
              <TouchableOpacity style={[styles.actionBtn, styles.reviewBtn]} onPress={handleReview} activeOpacity={0.8}>
                <Ionicons name="star-outline" size={18} color={Colors.star} />
                <Text style={[styles.actionBtnText, { color: Colors.star }]}>Lasă o recenzie</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.actionBtn, styles.rebookBtn]} onPress={handleRebook} activeOpacity={0.8}>
              <Ionicons name="refresh-outline" size={18} color={Colors.white} />
              <Text style={[styles.actionBtnText, { color: Colors.white }]}>Rebook</Text>
            </TouchableOpacity>
          </View>
        )}

        {isCancelled && (
          <TouchableOpacity style={[styles.actionBtn, styles.rebookBtn, { alignSelf: 'stretch' }]} onPress={handleRebook} activeOpacity={0.8}>
            <Ionicons name="refresh-outline" size={18} color={Colors.white} />
            <Text style={[styles.actionBtnText, { color: Colors.white }]}>Rezervă din nou</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Row({ icon, label, value, valueStyle }: {
  icon: any; label: string; value: string; valueStyle?: object;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={16} color={Colors.primary} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Text style={[styles.rowValue, valueStyle]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black },

  content: { padding: Spacing.lg, gap: Spacing.md },

  // Hero
  heroCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderRadius: Radius.xl, padding: Spacing.lg,
  },
  heroText: { flex: 1 },
  heroStatus: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginBottom: 3 },
  heroSalon: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black, marginBottom: 2 },
  heroService: { fontSize: FontSize.md, color: Colors.gray500 },

  // Generic card
  card: {
    backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.lg, ...Shadow.sm,
  },
  cardTitle: {
    fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black, marginBottom: Spacing.md,
  },

  // Row
  row: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.gray50,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  rowLabel: { fontSize: FontSize.sm, color: Colors.gray500 },
  rowValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.black, flex: 1, textAlign: 'right' },
  priceValue: { fontSize: FontSize.lg, color: Colors.primary, fontWeight: FontWeight.bold },

  // Map
  mapWrap: { borderRadius: Radius.lg, overflow: 'hidden', marginBottom: Spacing.md, position: 'relative' },
  map: { width: '100%', height: 180 },
  mapOverlay: {
    position: 'absolute', bottom: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  mapOverlayText: { color: Colors.white, fontSize: 11, fontWeight: FontWeight.semibold },
  mapPlaceholder: {
    height: 120, borderRadius: Radius.lg, backgroundColor: Colors.gray50,
    alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: Spacing.md,
  },
  mapPlaceholderText: { fontSize: FontSize.xs, color: Colors.gray300 },

  // Address
  addressRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: Spacing.md,
  },
  addressText: { fontSize: FontSize.sm, color: Colors.gray700, flex: 1, lineHeight: 20 },

  // Contact buttons
  contactRow: { flexDirection: 'row', gap: Spacing.sm },
  contactBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  contactBtnFilled: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  contactBtnDisabled: { borderColor: Colors.border },
  contactBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.primary },

  // Loading / error states (id-only opens)
  stateWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingHorizontal: Spacing.xl,
  },
  stateTitle: {
    fontSize: FontSize.md, fontWeight: FontWeight.bold,
    color: Colors.black, textAlign: 'center',
  },
  stateText: {
    fontSize: FontSize.sm, color: Colors.gray500,
    textAlign: 'center', lineHeight: 20,
  },
  retryBtn: {
    marginTop: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: 11,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.primary,
  },
  retryBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },

  // Cancel
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: Radius.lg,
    backgroundColor: '#FEE2E2',
  },
  cancelBtnText: { fontSize: FontSize.md, color: Colors.error, fontWeight: FontWeight.semibold },

  // Bottom actions
  actionsRow: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: Radius.lg,
  },
  actionBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  reviewBtn: { backgroundColor: '#FEF3C7', borderWidth: 1.5, borderColor: Colors.star },
  rebookBtn: { backgroundColor: Colors.primary },
});
