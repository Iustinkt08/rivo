import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';
import { useBusinessStore, BusinessAppointment, BusinessStaff } from '../../store/businessStore';
import { useAuthStore, useIsStaffSession } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { businessApi } from '../../services/api/business';
import { notificationsApi } from '../../services/api/notifications';
import Timeline from '../../components/business/calendar/Timeline';
import WeekStrip from '../../components/business/calendar/WeekStrip';
import RescheduleModal from '../../components/business/calendar/RescheduleModal';
import AppointmentSheet from '../../components/business/AppointmentSheet';
import { DraggableSheetRef } from '../../components/common/DraggableSheet';
import { minutesToHHMM, withStartMinutes, localDateKey } from '../../utils/calendarLayout';

// ── Helpers ───────────────────────────────────────────────────────────────────
// The public staff listing includes each member's performable services
// (staffServices relation). BusinessStaff doesn't declare the field yet, so
// read it defensively; a missing/malformed relation means "no filter".
type StaffServiceLink = { serviceId?: string; service?: { id?: string } };
function getStaffServiceIds(member: BusinessStaff | undefined): string[] | null {
  const links = (member as (BusinessStaff & { staffServices?: StaffServiceLink[] }) | undefined)
    ?.staffServices;
  if (!Array.isArray(links)) return null;
  return links
    .map((link) => link.serviceId ?? link.service?.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

// 15-min slots from 08:00 to 20:00 for the walk-in time picker.
function buildTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 8; h <= 20; h++) {
    for (const m of [0, 15, 30, 45]) {
      if (h === 20 && m > 0) break;
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
}
const TIME_SLOTS = buildTimeSlots();

// ── Push notification setup ───────────────────────────────────────────────────
async function registerForPushNotifications(setPushToken: (t: string) => void) {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    const { status } = existing === 'granted'
      ? { status: existing }
      : await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'NAVIRA Business',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    setPushToken(token);
    businessApi.registerPushToken(token, Platform.OS).catch(() => {});
  } catch {
    // Simulator / permissions denied — silently skip
  }
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CalendarScreen() {
  const router = useRouter();
  const {
    appointments, selectedDate, staff, services, salonProfile,
    setAppointments, setSelectedDate, setStaff, setServices, setSalonProfile,
    updateAppointmentStatus, addAppointment, replaceAppointment,
  } = useBusinessStore();
  const { notifications, setNotifications, setPushToken } = useNotificationStore();
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const isStaffSession = useIsStaffSession();

  const [showAddModal, setShowAddModal] = useState(false);
  const [prefillTime, setPrefillTime] = useState<string | null>(null);
  const [selectedAppt, setSelectedAppt] = useState<BusinessAppointment | null>(null);
  const [rescheduleAppt, setRescheduleAppt] = useState<BusinessAppointment | null>(null);
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const apptSheetRef = useRef<DraggableSheetRef>(null);

  const salonId = salonProfile?.id ?? null;

  // Resolve the owner's salon once (real UUID needed for appointment fetch/create).
  useEffect(() => {
    if (!salonProfile) {
      businessApi.getSalonProfile().then(setSalonProfile).catch(() => {});
    }
  }, []);

  // Load staff + services for this salon — filter chips + walk-in modal need
  // real UUIDs so a walk-in actually persists to the backend.
  useEffect(() => {
    if (!salonId) return;
    businessApi.getStaff(salonId).then(setStaff).catch(() => {});
    businessApi.getServices(salonId).then(setServices).catch(() => {});
  }, [salonId]);

  // Fetch real appointments whenever the salon or selected day changes.
  // `reloadTick` lets the error banner retry the same fetch.
  const [loadError, setLoadError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  useEffect(() => {
    if (!salonId) return;
    let cancelled = false;
    setLoading(true);
    businessApi.getAppointments(salonId, selectedDate)
      .then((data) => {
        if (cancelled) return;
        setAppointments(data);
        setLoadError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setAppointments([]);
        setLoadError(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [salonId, selectedDate, reloadTick]);

  useEffect(() => { registerForPushNotifications(setPushToken); }, []);

  // Feed the header bell badge with real unread notifications.
  useEffect(() => {
    notificationsApi.getMine()
      .then(setNotifications)
      .catch(() => {}); // badge is passive — the notifications screen surfaces errors
  }, [setNotifications]);

  const handleSaveWalkIn = async (data: {
    clientName: string; clientPhone: string;
    serviceId: string; serviceName: string; servicePrice: number; serviceDuration: number;
    staffId: string; staffName: string; timeSlot: string;
  }) => {
    setShowAddModal(false);

    const startAt = `${selectedDate}T${data.timeSlot}:00`;
    const startAtISO = new Date(startAt).toISOString();
    const endAtISO = new Date(new Date(startAt).getTime() + data.serviceDuration * 60000).toISOString();

    // Optimistic local add so the block appears immediately.
    const optimisticId = `walkin-opt-${Date.now()}`;
    addAppointment({
      id: optimisticId,
      clientName: data.clientName,
      clientPhone: data.clientPhone || undefined,
      serviceName: data.serviceName,
      serviceDuration: data.serviceDuration,
      servicePrice: data.servicePrice,
      staffId: data.staffId,
      staffName: data.staffName,
      startAt: startAtISO,
      endAt: endAtISO,
      status: 'CONFIRMED',
      source: 'WALK_IN',
    });

    try {
      const realAppt = await businessApi.createWalkIn({
        salonId: salonId ?? '',
        serviceId: data.serviceId,
        staffId: data.staffId,
        startAt: startAtISO,
        guestName: data.clientName,
        guestPhone: data.clientPhone || undefined,
        serviceName: data.serviceName,
        serviceDuration: data.serviceDuration,
        servicePrice: data.servicePrice,
        staffName: data.staffName,
      });
      replaceAppointment(optimisticId, realAppt);
    } catch {
      // Keep the optimistic entry if the server call fails.
    }
  };

  // Apply a reschedule optimistically, call the API, revert with a clear
  // message on rejection. Returns true on success so modal callers can close.
  const performReschedule = async (
    appt: BusinessAppointment,
    newStartISO: string,
  ): Promise<boolean> => {
    const durMs = new Date(appt.endAt).getTime() - new Date(appt.startAt).getTime();
    const optimistic: BusinessAppointment = {
      ...appt,
      startAt: newStartISO,
      endAt: new Date(new Date(newStartISO).getTime() + durMs).toISOString(),
    };
    replaceAppointment(appt.id, optimistic);
    try {
      const real = await businessApi.rescheduleAppointment(appt.id, newStartISO);
      // The reschedule response has no client relation — keep the local
      // client/service fields and take the authoritative timing/staff/status.
      replaceAppointment(appt.id, {
        ...optimistic,
        startAt: real.startAt,
        endAt: real.endAt,
        staffId: real.staffId || optimistic.staffId,
        staffName: real.staffName || optimistic.staffName,
        status: real.status,
      });
      return true;
    } catch (err: any) {
      replaceAppointment(appt.id, appt);
      const httpStatus = err?.response?.status;
      const serverMessage = err?.response?.data?.message;
      Alert.alert(
        'Mutare respinsă',
        httpStatus === 409
          ? 'Slotul este ocupat. Alege altă oră.'
          : typeof serverMessage === 'string' && serverMessage.length > 0
            ? serverMessage
            : 'Programarea nu a putut fi mutată. Încearcă din nou.',
      );
      return false;
    }
  };

  // Long-press drag on a timeline block → confirm, then persist.
  const handleBlockDragEnd = (appt: BusinessAppointment, newStartMin: number) => {
    const newStartISO = withStartMinutes(appt.startAt, newStartMin);
    Alert.alert(
      'Mută programarea',
      `Muți programarea lui ${appt.clientName} la ${minutesToHHMM(newStartMin)}?`,
      [
        { text: 'Renunță', style: 'cancel' },
        { text: 'Mută', onPress: () => { performReschedule(appt, newStartISO); } },
      ],
    );
  };

  // Manual pick from the reschedule sheet: local wall-clock date+time → ISO.
  const handleManualReschedule = (
    appt: BusinessAppointment,
    dateStr: string,
    timeStr: string,
  ): Promise<boolean> => {
    const newStartISO = new Date(`${dateStr}T${timeStr}:00`).toISOString();
    return performReschedule(appt, newStartISO);
  };

  // Compare LOCAL calendar days — `startAt` is a UTC ISO string, so a plain
  // startsWith(selectedDate) drops late-evening appointments into the wrong day.
  const dayAppts = appointments.filter(
    (a) => localDateKey(new Date(a.startAt)) === selectedDate,
  );
  const filtered = activeStaffId ? dayAppts.filter((a) => a.staffId === activeStaffId) : dayAppts;
  // Staff accounts only ever see their own appointments (scoped server-side),
  // so the "which colleague" filter is meaningless and would leak coworkers.
  const showStaffFilter = staff.length > 1 && !isStaffSession;

  const dateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('ro-RO', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Minimalist header — salon name + date, bell, add */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{salonProfile?.name ?? 'Calendar'}</Text>
          <Text style={styles.subtitle}>{dateLabel}</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/notifications')}>
          <Ionicons name="notifications-outline" size={22} color={Colors.black} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => { setPrefillTime(null); setShowAddModal(true); }}
        >
          <Ionicons name="add" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <WeekStrip selectedDate={selectedDate} onSelect={setSelectedDate} />

      {loadError && (
        <TouchableOpacity
          style={styles.loadErrorBanner}
          onPress={() => setReloadTick((t) => t + 1)}
          activeOpacity={0.8}
        >
          <Ionicons name="cloud-offline-outline" size={16} color={Colors.error} />
          <Text style={styles.loadErrorText}>
            Nu am putut încărca programările. Atinge pentru a reîncerca.
          </Text>
        </TouchableOpacity>
      )}

      {showStaffFilter && (
        <StaffFilter staff={staff} activeStaffId={activeStaffId} onSelect={setActiveStaffId} />
      )}

      <View style={styles.timelineWrap}>
        <Timeline
          appointments={filtered}
          selectedDate={selectedDate}
          onBlockPress={(appt) => { setSelectedAppt(appt); apptSheetRef.current?.present(); }}
          onEmptySlotPress={(hhmm) => { setPrefillTime(hhmm); setShowAddModal(true); }}
          onBlockDragEnd={handleBlockDragEnd}
        />
        {loading && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator color={Colors.primary} />
          </View>
        )}
        {!loading && dayAppts.length === 0 && (
          <View style={styles.emptyHint} pointerEvents="none">
            <Text style={styles.emptyHintText}>Nicio programare azi</Text>
            <Text style={styles.emptyHintSub}>Atinge un interval liber ca să adaugi una</Text>
          </View>
        )}
      </View>

      <AppointmentSheet
        ref={apptSheetRef}
        appt={selectedAppt}
        onDismiss={() => setSelectedAppt(null)}
        onReschedule={(appt) => {
          setRescheduleAppt(appt);
          apptSheetRef.current?.dismiss();
        }}
        onStatusChange={(appt, status) => {
          const previousStatus = appt.status;
          // Optimistic update; reverted with a clear message if the server
          // rejects the transition (e.g. time-gated complete/no-show → 400).
          updateAppointmentStatus(appt.id, status);
          businessApi.updateAppointmentStatus(appt.id, status).catch((err: any) => {
            updateAppointmentStatus(appt.id, previousStatus);
            const serverMessage = err?.response?.data?.message;
            Alert.alert(
              'Acțiune respinsă',
              typeof serverMessage === 'string' && serverMessage.length > 0
                ? serverMessage
                : 'Statusul nu a putut fi actualizat. Încearcă din nou.',
            );
          });
          apptSheetRef.current?.dismiss();
        }}
      />

      {rescheduleAppt && (
        <RescheduleModal
          appt={rescheduleAppt}
          onClose={() => setRescheduleAppt(null)}
          onConfirm={handleManualReschedule}
        />
      )}

      <WalkInModal
        visible={showAddModal}
        selectedDate={selectedDate}
        initialTime={prefillTime}
        onClose={() => setShowAddModal(false)}
        onSave={handleSaveWalkIn}
      />
    </SafeAreaView>
  );
}

// ── Staff filter chips ──────────────────────────────────────────────────────────
function StaffFilter({ staff, activeStaffId, onSelect }: {
  staff: BusinessStaff[];
  activeStaffId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.staffScroll}
      contentContainerStyle={styles.staffFilter}
    >
      <TouchableOpacity
        style={[styles.staffChip, activeStaffId === null && styles.staffChipActive]}
        onPress={() => onSelect(null)}
      >
        <Text style={[styles.staffChipText, activeStaffId === null && { color: Colors.white }]}>Toți</Text>
      </TouchableOpacity>
      {staff.map((s) => (
        <TouchableOpacity
          key={s.id}
          style={[styles.staffChip, activeStaffId === s.id && styles.staffChipActive]}
          onPress={() => onSelect(s.id)}
        >
          {!!s.avatarEmoji && <Text style={styles.staffEmoji}>{s.avatarEmoji}</Text>}
          <Text style={[styles.staffChipText, activeStaffId === s.id && { color: Colors.white }]}>
            {s.firstName}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ── Walk-in modal ────────────────────────────────────────────────────────────────
function WalkInModal({ visible, selectedDate, initialTime, onClose, onSave }: {
  visible: boolean;
  selectedDate: string;
  initialTime: string | null;
  onClose: () => void;
  onSave: (data: {
    clientName: string; clientPhone: string;
    serviceId: string; serviceName: string; servicePrice: number; serviceDuration: number;
    staffId: string; staffName: string; timeSlot: string;
  }) => void;
}) {
  const { services, staff } = useBusinessStore();
  const staffSession = useAuthStore((s) => s.staffSession);

  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset on open; preselect the tapped slot when provided.
  useEffect(() => {
    if (visible) {
      setClientName(''); setPhone('');
      setSelectedServiceId(null); setSelectedStaffId(null);
      setSelectedTime(initialTime ?? null);
    }
  }, [visible, initialTime]);

  // Staff sessions only offer the services that member actually performs
  // (from the staffServices relation on the loaded staff list); owners see all.
  const sessionServiceIds = staffSession
    ? getStaffServiceIds(staff.find((s) => s.id === staffSession.staff.id))
    : null;
  const activeServices = services.filter(
    (s) => s.isActive && (sessionServiceIds === null || sessionServiceIds.includes(s.id)),
  );
  const activeStaff = staff.filter((s) => s.isActive);
  const selectedService = activeServices.find((s) => s.id === selectedServiceId);
  const selectedStaff = activeStaff.find((s) => s.id === selectedStaffId);
  const canSave = clientName.trim().length > 0 && selectedServiceId && selectedStaffId && selectedTime;

  const handleSave = async () => {
    if (!canSave || !selectedService || !selectedStaff || !selectedTime) return;
    setSaving(true);
    try {
      onSave({
        clientName: clientName.trim(),
        clientPhone: phone.trim(),
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        servicePrice: selectedService.price,
        serviceDuration: selectedService.durationMin,
        staffId: selectedStaff.id,
        staffName: `${selectedStaff.firstName} ${selectedStaff.lastName}`,
        timeSlot: selectedTime,
      });
    } finally {
      setSaving(false);
    }
  };

  const dateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('ro-RO', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose} />
      <View style={[styles.modalSheet, { maxHeight: '92%' }]}>
        <View style={styles.handle} />
        <View style={styles.walkInHeader}>
          <Text style={styles.modalTitle}>Adaugă Walk-in</Text>
          <View style={styles.dateBadge}>
            <Ionicons name="calendar-outline" size={13} color={Colors.primary} />
            <Text style={styles.dateBadgeText}>{dateLabel}</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          <Text style={styles.fieldLabel}>Nume client *</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="Ex: Ion Popescu"
            placeholderTextColor={Colors.gray300}
            value={clientName}
            onChangeText={setClientName}
            autoCapitalize="words"
          />

          <Text style={styles.fieldLabel}>Telefon (opțional)</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="+40 7XX XXX XXX"
            placeholderTextColor={Colors.gray300}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          <Text style={styles.fieldLabel}>Serviciu *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {activeServices.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.serviceChip, selectedServiceId === s.id && styles.serviceChipActive]}
                onPress={() => setSelectedServiceId(s.id)}
              >
                <Text style={[styles.serviceChipText, selectedServiceId === s.id && { color: Colors.white }]}>
                  {s.name}
                </Text>
                <Text style={[styles.serviceChipMeta, selectedServiceId === s.id && { color: 'rgba(255,255,255,0.75)' }]}>
                  {s.durationMin}min · {s.price}RON
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Specialist *</Text>
          <View style={styles.chipRow}>
            {activeStaff.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.serviceChip, selectedStaffId === s.id && styles.serviceChipActive]}
                onPress={() => setSelectedStaffId(s.id)}
              >
                <Text style={[styles.serviceChipText, selectedStaffId === s.id && { color: Colors.white }]}>
                  {s.avatarEmoji ? `${s.avatarEmoji} ` : ''}{s.firstName}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Ora *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {TIME_SLOTS.map((slot) => (
              <TouchableOpacity
                key={slot}
                style={[styles.timeChip, selectedTime === slot && styles.timeChipActive]}
                onPress={() => setSelectedTime(slot)}
              >
                <Text style={[styles.timeChipText, selectedTime === slot && { color: Colors.white }]}>{slot}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </ScrollView>

        <TouchableOpacity
          style={[styles.saveBtn, !canSave && { opacity: 0.4 }]}
          disabled={!canSave || saving}
          onPress={handleSave}
        >
          {saving ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={18} color={Colors.white} />
              <Text style={styles.saveBtnText}>Adaugă programarea</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.sm,
  },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.black },
  subtitle: { fontSize: FontSize.sm, color: Colors.gray500, marginTop: 2, textTransform: 'capitalize' },
  iconBtn: { width: 42, height: 42, borderRadius: Radius.full, backgroundColor: Colors.gray50, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: Colors.white },
  badgeText: { fontSize: 9, fontWeight: FontWeight.bold, color: Colors.white },
  addBtn: { width: 42, height: 42, borderRadius: Radius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },

  staffScroll: { flexGrow: 0, height: 50 },
  staffFilter: { paddingHorizontal: Spacing.lg, gap: 8, paddingTop: 4, paddingBottom: Spacing.sm },
  staffChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, height: 38, backgroundColor: Colors.white, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border },
  staffChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  staffChipText: { fontSize: FontSize.sm, color: Colors.gray700, fontWeight: FontWeight.semibold },
  staffEmoji: { fontSize: 15 },

  loadErrorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.lg, marginTop: Spacing.sm,
    backgroundColor: '#FEE2E2', borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: 8,
  },
  loadErrorText: { flex: 1, fontSize: FontSize.xs, color: Colors.error, lineHeight: 16 },

  timelineWrap: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  emptyHint: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyHintText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gray500 },
  emptyHintSub: { fontSize: FontSize.sm, color: Colors.gray400, marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: Colors.overlay },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, paddingBottom: 40 },
  handle: { width: 40, height: 4, backgroundColor: Colors.gray300, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg },

  walkInHeader: { marginBottom: Spacing.sm },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black },
  dateBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  dateBadgeText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium, textTransform: 'capitalize' },

  fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.gray700, marginBottom: 6, marginTop: Spacing.md },
  fieldInput: { backgroundColor: Colors.gray50, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 13, fontSize: FontSize.md, color: Colors.black },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  serviceChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white },
  serviceChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  serviceChipText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.gray700 },
  serviceChipMeta: { fontSize: 10, color: Colors.gray500, marginTop: 2 },
  timeChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white, alignItems: 'center', minWidth: 62 },
  timeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  timeChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.gray700 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: 16, marginTop: Spacing.md },
  saveBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
