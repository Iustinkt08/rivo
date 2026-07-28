import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Button from '../../components/common/Button';
import { Colors, FontSize, FontWeight, Gradients, Radius, Spacing } from '../../theme';
import {
  bookingsApi, NoStaffAvailableError,
  BookingService, BookingStaff, AvailableSlot, SlotRef,
} from '../../services/api/bookings';
import {
  discountsApi, discountErrorMessage, ValidatedDiscount,
} from '../../services/api/discounts';
import { styles } from './BookingScreen.styles';

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = ['Serviciu', 'Specialist', 'Data & Ora', 'Confirmare'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildNextDays(n = 14): { date: string; label: string; dayNum: string; isToday: boolean }[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      date: d.toISOString().split('T')[0],
      label: d.toLocaleDateString('ro-RO', { weekday: 'short' }),
      dayNum: String(d.getDate()).padStart(2, '0'),
      isToday: i === 0,
    };
  });
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('ro-RO', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

/** Money label — whole RON stays integer, discounted values show 2 decimals. */
function formatRon(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function BookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    salonName?: string; salonId?: string; serviceId?: string; staffId?: string;
  }>();
  const salonId      = params.salonId ?? null;
  const salonName    = params.salonName ?? 'Salon';
  const preServiceId = params.serviceId ?? null;  // set when rebooking / from salon page
  const preStaffId   = params.staffId ?? null;    // set when a staff member was chosen upfront

  // ── Step state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState(0);

  // ── Data state ──────────────────────────────────────────────────────────────
  const [services,    setServices]    = useState<BookingService[]>([]);
  const [staffList,   setStaffList]   = useState<BookingStaff[]>([]);
  const [slots,       setSlots]       = useState<AvailableSlot[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingSlots,setLoadingSlots]= useState(false);
  const [loadError,   setLoadError]   = useState(false);
  // Salon has no bookable staff for the chosen service — distinct empty state.
  const [noStaff,     setNoStaff]     = useState(false);

  // ── Selections ──────────────────────────────────────────────────────────────
  const [selectedService, setSelectedService] = useState<BookingService | null>(null);
  const [selectedStaff,   setSelectedStaff]   = useState<BookingStaff | null>(null);
  const [selectedDay,     setSelectedDay]     = useState<string | null>(null);
  const [selectedSlot,    setSelectedSlot]    = useState<AvailableSlot | null>(null);

  // ── Slot lock ───────────────────────────────────────────────────────────────
  // The backend pairs lock/release/create by (staffId, startAt, sessionId).
  const [lockedSlot,  setLockedSlot]  = useState<SlotRef | null>(null);
  const [countdown,   setCountdown]   = useState(0);
  const lockedSlotRef = useRef<SlotRef | null>(null);
  const lockExpiryRef = useRef<Date | null>(null);
  const countdownRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  // Out-of-order guard: only the lock request matching the current generation
  // may commit state — rapid slot taps otherwise book a different slot than shown.
  const lockGenerationRef = useRef(0);

  // ── Submission ──────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [notes,      setNotes]      = useState('');

  // ── Discount code (step 4) ──────────────────────────────────────────────────
  // Amounts always come from the server (validate endpoint) — never computed here.
  const [discountInput,      setDiscountInput]      = useState('');
  const [appliedDiscount,    setAppliedDiscount]    = useState<ValidatedDiscount | null>(null);
  const [discountError,      setDiscountError]      = useState<string | null>(null);
  const [validatingDiscount, setValidatingDiscount] = useState(false);

  const days = buildNextDays(14);

  // Only staff assigned to the selected service may be offered/kept — the
  // salon controls who performs what (StaffService links).
  const eligibleStaff = selectedService
    ? staffList.filter((s) => s.serviceIds.includes(selectedService.id))
    : staffList;

  // A discount is validated against ONE service — switching services voids it.
  // Switching services also drops a staff pick that can't perform the new one.
  useEffect(() => {
    setAppliedDiscount(null);
    setDiscountError(null);
    setDiscountInput('');
    setSelectedStaff((cur) =>
      cur && selectedService && !cur.serviceIds.includes(selectedService.id)
        ? null
        : cur,
    );
  }, [selectedService?.id]);

  const handleApplyDiscount = async () => {
    const code = discountInput.trim();
    if (!salonId || !selectedService || !code || validatingDiscount) return;
    setValidatingDiscount(true);
    setDiscountError(null);
    try {
      const validated = await discountsApi.validate(salonId, code, selectedService.id);
      setAppliedDiscount(validated);
      setDiscountInput('');
    } catch (err: any) {
      setAppliedDiscount(null);
      setDiscountError(
        discountErrorMessage(err, 'Codul nu a putut fi verificat. Încearcă din nou.'),
      );
    } finally {
      setValidatingDiscount(false);
    }
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setDiscountError(null);
  };

  // ── Load services + staff on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!salonId) { setLoadingData(false); return; }
    setLoadingData(true);
    setLoadError(false);
    Promise.all([
      bookingsApi.getServices(salonId),
      bookingsApi.getStaff(salonId),
    ]).then(([svcs, stf]) => {
      setServices(svcs);
      setStaffList(stf);
      // Pre-selections (rebook / salon page): service, and optionally staff.
      const svcMatch = preServiceId ? svcs.find((s) => s.id === preServiceId) : undefined;
      const stfMatch = preStaffId
        ? stf.find((s) => s.id === preStaffId && (!svcMatch || s.serviceIds.includes(svcMatch.id)))
        : undefined;
      if (svcMatch) setSelectedService(svcMatch);
      if (stfMatch) setSelectedStaff(stfMatch);
      if (svcMatch) setStep(stfMatch ? 2 : 1);
    }).catch(() => {
      // No fake data — leave lists empty and let the step render an error message.
      setServices([]);
      setStaffList([]);
      setLoadError(true);
    }).finally(() => setLoadingData(false));
  }, [salonId]);

  // ── Load slots when day or service/staff changes ─────────────────────────────
  useEffect(() => {
    if (!salonId || !selectedDay || !selectedService) return;
    clearSlotLock({ release: true });
    setSelectedSlot(null);
    setLoadingSlots(true);
    setNoStaff(false);
    bookingsApi
      .getAvailability(salonId, selectedService.id, selectedStaff?.id ?? null, selectedDay)
      .then(setSlots)
      .catch((err) => {
        setSlots([]);
        if (err instanceof NoStaffAvailableError) setNoStaff(true);
      })
      .finally(() => setLoadingSlots(false));
  }, [selectedDay, selectedService?.id, selectedStaff?.id]);

  // ── Countdown tick ───────────────────────────────────────────────────────────
  const startCountdown = (expiresAt: string) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    lockExpiryRef.current = new Date(expiresAt);
    const tick = () => {
      const remaining = Math.max(0, Math.floor((lockExpiryRef.current!.getTime() - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) {
        clearInterval(countdownRef.current!);
        countdownRef.current = null;
        lockExpiryRef.current = null;
        lockedSlotRef.current = null;
        setLockedSlot(null);
        setSelectedSlot(null);
        setStep(2);
        Alert.alert(
          'Slot expirat',
          'Rezervarea provizorie a expirat. Te rugăm să selectezi din nou ora dorită.',
          [{ text: 'OK' }],
        );
      }
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
  };

  // Release the current lock on the server (best-effort) — the lock expires by
  // itself anyway, so failures here are non-fatal.
  const releaseCurrentLock = () => {
    const held = lockedSlotRef.current;
    if (held && salonId) {
      bookingsApi.releaseSlot(salonId, held).catch(() => {});
    }
  };

  const clearSlotLock = ({ release }: { release: boolean }) => {
    lockGenerationRef.current += 1; // invalidate any in-flight lock request
    if (release) releaseCurrentLock();
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    lockExpiryRef.current = null;
    lockedSlotRef.current = null;
    setLockedSlot(null);
    setCountdown(0);
  };

  // Cleanup on unmount: stop the timer, invalidate in-flight lock requests,
  // and free the held slot for others.
  useEffect(() => () => {
    lockGenerationRef.current += 1;
    if (countdownRef.current) clearInterval(countdownRef.current);
    releaseCurrentLock();
  }, []);

  // Tab screens stay MOUNTED after navigating away (expo-router Tabs), so
  // finishing a booking and returning would resume the old flow at the summary
  // step with stale selections — and the unmount cleanup above never fires
  // between bookings. On blur: free the held slot and clear the flow. On
  // refocus: start clean and re-apply the (possibly new) preselection params.
  const needsFocusResetRef = useRef(false);
  const latestRef = useRef({ services, staffList, preServiceId, preStaffId });
  latestRef.current = { services, staffList, preServiceId, preStaffId };
  useFocusEffect(
    useCallback(() => {
      if (needsFocusResetRef.current) {
        needsFocusResetRef.current = false;
        const { services: svcs, staffList: stf, preServiceId: svcId, preStaffId: stfId } = latestRef.current;
        const svcMatch = svcId ? svcs.find((s) => s.id === svcId) : undefined;
        const stfMatch = stfId
          ? stf.find((s) => s.id === stfId && (!svcMatch || s.serviceIds.includes(svcMatch.id)))
          : undefined;
        setSelectedService(svcMatch ?? null);
        setSelectedStaff(stfMatch ?? null);
        setStep(svcMatch ? (stfMatch ? 2 : 1) : 0);
      }
      return () => {
        needsFocusResetRef.current = true;
        lockGenerationRef.current += 1;
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
        releaseCurrentLock();
        lockExpiryRef.current = null;
        lockedSlotRef.current = null;
        setLockedSlot(null);
        setCountdown(0);
        setSelectedDay(null);
        setSelectedSlot(null);
        setSlots([]);
        setNotes('');
        setSubmitting(false);
        setAppliedDiscount(null);
        setDiscountInput('');
        setDiscountError(null);
      };
    }, []),
  );

  // ── Slot selection → lock ────────────────────────────────────────────────────
  const handleSelectSlot = async (slot: AvailableSlot) => {
    if (!salonId || !selectedService) return;
    if (selectedSlot?.startAt === slot.startAt && lockedSlot) return;
    clearSlotLock({ release: true });
    const generation = lockGenerationRef.current;
    setSelectedSlot(slot);
    const slotRef: SlotRef = {
      serviceId: selectedService.id,
      staffId: slot.staffId, // concrete staff even for "any specialist"
      startAt: slot.startAt,
    };
    try {
      const result = await bookingsApi.lockSlot(salonId, slotRef);
      if (generation !== lockGenerationRef.current) {
        // A newer selection superseded this request while it was in flight —
        // free the stale lock so it doesn't block the slot for others.
        bookingsApi.releaseSlot(salonId, slotRef).catch(() => {});
        return;
      }
      lockedSlotRef.current = slotRef;
      setLockedSlot(slotRef);
      startCountdown(result.expiresAt);
    } catch {
      // Stale failure for a superseded selection — don't clobber the new one.
      if (generation !== lockGenerationRef.current) return;
      // No fake lock — clear the selection and let the user retry.
      setSelectedSlot(null);
      clearSlotLock({ release: false });
      Alert.alert(
        'Slot indisponibil',
        'Nu am putut rezerva ora selectată. Te rugăm să încerci din nou.',
        [{ text: 'OK' }],
      );
    }
  };

  // ── Confirm booking ──────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!salonId || !selectedService || !selectedDay || !selectedSlot || !lockedSlot) return;
    // Reconciliation guard: the held lock must match the slot shown in the UI —
    // an out-of-order lock response could otherwise book a different slot.
    if (
      lockedSlot.startAt !== selectedSlot.startAt ||
      lockedSlot.staffId !== selectedSlot.staffId
    ) {
      clearSlotLock({ release: true });
      setSelectedSlot(null);
      setStep(2);
      Alert.alert('Slot nerezervat', 'Te rugăm să selectezi din nou ora dorită.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await bookingsApi.createBooking({
        salonId,
        serviceId: selectedService.id,
        staffId: lockedSlot.staffId,
        startAt: lockedSlot.startAt,
        clientNotes: notes.trim() || undefined,
        discountCode: appliedDiscount?.code,
      });
      // The backend releases the lock itself on create — just stop the timer.
      clearSlotLock({ release: false });
      router.replace({
        pathname: '/(client)/booking-confirmed',
        params: {
          salonName,
          service:          selectedService.name,
          date:             selectedDay,          // YYYY-MM-DD
          time:             selectedSlot.time,    // HH:MM
          bookingId:        result.bookingId,
          staffName:        selectedStaff?.name ?? 'Orice specialist',
          price:            String(appliedDiscount?.finalPrice ?? selectedService.price),
          duration:         String(selectedService.durationMin),
        },
      });
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 400 && appliedDiscount) {
        // The code became invalid between validation and booking (expired,
        // cap reached in parallel, deactivated). Surface the server's Romanian
        // message inline and clear the applied state — the slot lock survives.
        setDiscountError(
          discountErrorMessage(err, 'Codul de reducere nu mai este valabil.'),
        );
        setAppliedDiscount(null);
      } else if (status === 401) {
        Alert.alert('Autentificare necesară', 'Trebuie să fii autentificat pentru a rezerva.');
      } else if (status === 403) {
        Alert.alert('Rezervare indisponibilă', 'Nu poți rezerva la acest salon.');
      } else if (status === 409) {
        Alert.alert('Slot ocupat', 'Slotul nu mai este disponibil. Te rugăm să alegi altă oră.');
      } else {
        Alert.alert('Eroare', 'Rezervarea nu a putut fi finalizată. Încearcă din nou.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Navigation ───────────────────────────────────────────────────────────────
  const canNext = [
    !!selectedService,
    true,
    !!selectedDay && !!selectedSlot && !!lockedSlot && countdown > 0,
    true,
  ][step];

  const goNext = () => {
    if (step === 3) { handleConfirm(); return; }
    setStep((s) => s + 1);
  };
  const goBack = () => {
    if (step === 0) { router.back(); return; }
    setStep((s) => s - 1);
  };

  // ── Missing salonId — cannot book without knowing the salon ─────────────────
  if (!salonId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={24} color={Colors.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Rezervare</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.stepEmpty}>
          <Ionicons name="alert-circle-outline" size={40} color={Colors.gray300} />
          <Text style={styles.stepEmptyText}>
            Nu am putut identifica salonul. Te rugăm să revii la pagina salonului și să încerci din nou.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.black} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>{preServiceId ? 'Reprogramare' : 'Rezervare'}</Text>
          {preServiceId && selectedService && (
            <Text style={styles.headerSubtitle} numberOfLines={1}>{selectedService.name}</Text>
          )}
        </View>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={24} color={Colors.gray500} />
        </TouchableOpacity>
      </View>

      {/* Step indicator — thin gradient progress segments */}
      <View style={styles.stepBar}>
        {STEPS.map((s, i) => (
          <View key={s} style={styles.stepSegment}>
            {i <= step && (
              <LinearGradient
                colors={Gradients.brand}
                start={Gradients.start}
                end={Gradients.end}
                style={styles.stepSegmentFill}
              />
            )}
          </View>
        ))}
      </View>
      <Text style={styles.stepCaption}>
        Pasul {step + 1} din {STEPS.length} · {STEPS[step]}
      </Text>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {loadingData && step < 2 ? (
          <View style={styles.loader}><ActivityIndicator color={Colors.primary} size="large" /></View>
        ) : (
          <>
            {step === 0 && (
              <ServiceStep
                services={services}
                selected={selectedService}
                onSelect={setSelectedService}
                error={loadError}
              />
            )}
            {step === 1 && (
              <StaffStep
                staffList={eligibleStaff}
                selected={selectedStaff}
                onSelect={setSelectedStaff}
              />
            )}
            {step === 2 && (
              <SlotStep
                days={days}
                selectedDay={selectedDay}
                selectedSlot={selectedSlot}
                slots={slots}
                loadingSlots={loadingSlots}
                noStaff={noStaff}
                countdown={countdown}
                hasLock={!!lockedSlot}
                onDay={(d) => setSelectedDay(d)}
                onSlot={handleSelectSlot}
              />
            )}
            {step === 3 && (
              <SummaryStep
                salonName={salonName}
                service={selectedService}
                staff={selectedStaff}
                day={selectedDay}
                slot={selectedSlot?.time ?? null}
                notes={notes}
                onNotesChange={setNotes}
                discountInput={discountInput}
                onDiscountInputChange={(text) => {
                  setDiscountInput(text);
                  if (discountError) setDiscountError(null);
                }}
                appliedDiscount={appliedDiscount}
                discountError={discountError}
                validatingDiscount={validatingDiscount}
                onApplyDiscount={handleApplyDiscount}
                onRemoveDiscount={handleRemoveDiscount}
              />
            )}
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer CTA */}
      <View style={styles.footer}>
        {step === 3 && countdown > 0 && (
          <View style={styles.countdownBanner}>
            <Ionicons name="timer-outline" size={15} color={countdown < 60 ? Colors.error : Colors.primary} />
            <Text style={[styles.countdownBannerText, countdown < 60 && { color: Colors.error }]}>
              Slotul este rezervat — confirmă în {formatCountdown(countdown)}
            </Text>
          </View>
        )}
        <Button
          title={step === 3 ? 'Confirmă rezervarea' : 'Continuă'}
          fullWidth
          size="lg"
          disabled={!canNext || submitting}
          onPress={goNext}
          loading={submitting}
        />
      </View>
    </SafeAreaView>
  );
}

// ── Step 0 — Service ──────────────────────────────────────────────────────────

function ServiceStep({
  services, selected, onSelect, error,
}: {
  services: BookingService[];
  selected: BookingService | null;
  onSelect: (s: BookingService) => void;
  error?: boolean;
}) {
  const categories = [...new Set(services.map((s) => s.category))];
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const filtered = activeCategory ? services.filter((s) => s.category === activeCategory) : services;

  if (services.length === 0) {
    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Alege serviciul</Text>
        <View style={styles.stepEmpty}>
          <Ionicons
            name={error ? 'cloud-offline-outline' : 'pricetags-outline'}
            size={40}
            color={Colors.gray300}
          />
          <Text style={styles.stepEmptyText}>
            {error
              ? 'Nu am putut încărca serviciile. Verifică conexiunea și încearcă din nou.'
              : 'Acest salon nu are servicii disponibile momentan.'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Alege serviciul</Text>

      {/* Category filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        <TouchableOpacity
          style={[styles.categoryChip, !activeCategory && styles.categoryChipActive]}
          onPress={() => setActiveCategory(null)}
        >
          <Text style={[styles.categoryChipText, !activeCategory && styles.categoryChipTextActive]}>Toate</Text>
        </TouchableOpacity>
        {categories.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.categoryChip, activeCategory === c && styles.categoryChipActive]}
            onPress={() => setActiveCategory(c)}
          >
            <Text style={[styles.categoryChipText, activeCategory === c && styles.categoryChipTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.map((s) => (
        <TouchableOpacity
          key={s.id}
          style={[styles.optionCard, selected?.id === s.id && styles.optionCardSelected]}
          onPress={() => onSelect(s)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.optionName}>{s.name}</Text>
            <Text style={styles.optionMeta}>{s.durationMin} min · {s.category}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.optionPrice}>{s.price} RON</Text>
            {selected?.id === s.id && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Step 1 — Staff ────────────────────────────────────────────────────────────

function StaffStep({
  staffList, selected, onSelect,
}: { staffList: BookingStaff[]; selected: BookingStaff | null; onSelect: (s: BookingStaff | null) => void }) {
  if (staffList.length === 0) {
    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Alege specialistul</Text>
        <View style={styles.stepEmpty}>
          <Ionicons name="people-outline" size={40} color={Colors.gray300} />
          <Text style={styles.stepEmptyText}>
            Acest salon nu are încă specialiști adăugați. Rezervările online vor fi
            disponibile după ce salonul își configurează echipa.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Alege specialistul</Text>

      {/* Any available */}
      <TouchableOpacity
        style={[styles.optionCard, !selected && styles.optionCardSelected]}
        onPress={() => onSelect(null)}
      >
        <Ionicons name="shuffle-outline" size={24} color={Colors.primary} style={{ marginRight: Spacing.sm }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.optionName}>Orice specialist disponibil</Text>
          <Text style={styles.optionMeta}>Cel mai rapid slot disponibil</Text>
        </View>
        {!selected && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
      </TouchableOpacity>

      {staffList.map((s) => (
        <TouchableOpacity
          key={s.id}
          style={[styles.optionCard, selected?.id === s.id && styles.optionCardSelected]}
          onPress={() => onSelect(s)}
        >
          <View style={styles.staffAvatar}>
            <Text style={{ fontSize: 26 }}>{s.avatarEmoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionName}>{s.name}</Text>
            <Text style={styles.optionMeta}>{s.specialty}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
              <Ionicons name="star" size={11} color={Colors.star} />
              <Text style={{ fontSize: FontSize.xs, color: Colors.gray500 }}>{s.rating.toFixed(1)}</Text>
            </View>
          </View>
          {selected?.id === s.id && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Step 2 — Date & Time ──────────────────────────────────────────────────────

function SlotStep({
  days, selectedDay, selectedSlot, slots, loadingSlots, noStaff, countdown, hasLock, onDay, onSlot,
}: {
  days: ReturnType<typeof buildNextDays>;
  selectedDay: string | null; selectedSlot: AvailableSlot | null;
  slots: AvailableSlot[]; loadingSlots: boolean; noStaff: boolean;
  countdown: number; hasLock: boolean;
  onDay: (d: string) => void; onSlot: (s: AvailableSlot) => void;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Alege data și ora</Text>

      {/* Date strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
        {days.map((d) => (
          <TouchableOpacity
            key={d.date}
            style={[styles.dayChip, selectedDay === d.date && styles.dayChipActive]}
            onPress={() => onDay(d.date)}
          >
            <Text style={[styles.dayLabel, selectedDay === d.date && { color: Colors.primary }]}>
              {d.isToday ? 'Azi' : d.label}
            </Text>
            <Text style={[styles.dayNum, selectedDay === d.date && { color: Colors.primary }]}>{d.dayNum}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Time slots */}
      {selectedDay && (
        <>
          <Text style={styles.slotsHeading}>Ore disponibile</Text>

          {loadingSlots ? (
            <View style={styles.slotsLoader}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.slotsLoaderText}>Se verifică disponibilitatea…</Text>
            </View>
          ) : noStaff ? (
            <View style={styles.noSlots}>
              <Ionicons name="people-outline" size={36} color={Colors.gray300} />
              <Text style={styles.noSlotsText}>Fără specialiști disponibili</Text>
              <Text style={styles.noSlotsSubText}>
                Acest salon nu are încă specialiști disponibili pentru rezervări online.
              </Text>
            </View>
          ) : slots.length === 0 ? (
            <View style={styles.noSlots}>
              <Ionicons name="calendar-clear-outline" size={36} color={Colors.gray300} />
              <Text style={styles.noSlotsText}>Nicio oră disponibilă în această zi</Text>
              <Text style={styles.noSlotsSubText}>Încearcă o altă dată</Text>
            </View>
          ) : (
            <View style={styles.slotsGrid}>
              {slots.map((slot) => {
                const isSelected = selectedSlot?.startAt === slot.startAt;
                const isUnavail  = !slot.available;
                return (
                  <TouchableOpacity
                    key={slot.startAt}
                    disabled={isUnavail}
                    style={[
                      styles.slotChip,
                      isSelected  && styles.slotChipActive,
                      isUnavail   && styles.slotChipUnavail,
                    ]}
                    onPress={() => onSlot(slot)}
                  >
                    <Text style={[
                      styles.slotText,
                      isSelected && { color: Colors.primary },
                      isUnavail  && { color: Colors.gray300 },
                    ]}>
                      {slot.time}
                    </Text>
                    {isUnavail && (
                      <Text style={styles.slotUnavailLabel}>Ocupat</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Lock notice */}
          {hasLock && countdown > 0 && (
            <View style={[styles.lockNotice, countdown < 60 && styles.lockNoticeUrgent]}>
              <Ionicons
                name={countdown < 60 ? 'warning-outline' : 'lock-closed-outline'}
                size={15}
                color={countdown < 60 ? Colors.error : Colors.primary}
              />
              <Text style={[styles.lockText, countdown < 60 && { color: Colors.error }]}>
                Slot rezervat provizoriu — expiră în {formatCountdown(countdown)}. Continuă pentru a confirma.
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ── Step 3 — Summary ──────────────────────────────────────────────────────────

function SummaryStep({
  salonName, service, staff, day, slot, notes, onNotesChange,
  discountInput, onDiscountInputChange, appliedDiscount, discountError,
  validatingDiscount, onApplyDiscount, onRemoveDiscount,
}: {
  salonName: string; service: BookingService | null; staff: BookingStaff | null;
  day: string | null; slot: string | null;
  notes: string; onNotesChange: (text: string) => void;
  discountInput: string; onDiscountInputChange: (text: string) => void;
  appliedDiscount: ValidatedDiscount | null; discountError: string | null;
  validatingDiscount: boolean;
  onApplyDiscount: () => void; onRemoveDiscount: () => void;
}) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Sumar rezervare</Text>

        <View style={styles.summaryCard}>
          <SummaryRow icon="storefront-outline"  label="Salon"     value={salonName} />
          <SummaryRow icon="cut-outline"         label="Serviciu"  value={service?.name ?? '—'} />
          <SummaryRow icon="person-outline"      label="Specialist" value={staff?.name ?? 'Oricare disponibil'} />
          <SummaryRow icon="calendar-outline"    label="Data"      value={day ? formatDate(day) : '—'} />
          <SummaryRow icon="time-outline"        label="Ora"       value={slot ?? '—'} />
          <SummaryRow icon="timer-outline"       label="Durată"    value={service ? `${service.durationMin} min` : '—'} />
          <View style={styles.divider} />
          {appliedDiscount && (
            <>
              <View style={styles.discountSummaryRow}>
                <Text style={styles.discountSummaryLabel}>Preț</Text>
                <Text style={styles.discountSummaryStruck}>
                  {formatRon(service?.price ?? 0)} RON
                </Text>
              </View>
              <View style={styles.discountSummaryRow}>
                <Text style={styles.discountSummaryGreen}>
                  Reducere ({appliedDiscount.code})
                </Text>
                <Text style={styles.discountSummaryGreen}>
                  −{formatRon(appliedDiscount.discountAmount)} RON
                </Text>
              </View>
            </>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              {formatRon(appliedDiscount?.finalPrice ?? service?.price ?? 0)} RON
            </Text>
          </View>
        </View>

        {/* Discount code */}
        <Text style={styles.notesLabel}>Cod de reducere (opțional)</Text>
        {appliedDiscount ? (
          <View style={styles.discountAppliedChip}>
            <Ionicons name="pricetag" size={15} color={Colors.success} />
            <Text style={styles.discountAppliedCode}>{appliedDiscount.code}</Text>
            <Text style={styles.discountAppliedAmount}>
              −{formatRon(appliedDiscount.discountAmount)} RON
            </Text>
            <TouchableOpacity
              onPress={onRemoveDiscount}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Elimină codul de reducere"
            >
              <Ionicons name="close-circle" size={20} color={Colors.gray400} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.discountInputRow}>
            <TextInput
              style={styles.discountInput}
              placeholder="Ex: VARA-2026"
              placeholderTextColor={Colors.gray300}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={24}
              value={discountInput}
              onChangeText={onDiscountInputChange}
              onSubmitEditing={onApplyDiscount}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[
                styles.discountApplyBtn,
                (!discountInput.trim() || validatingDiscount) && { opacity: 0.5 },
              ]}
              disabled={!discountInput.trim() || validatingDiscount}
              onPress={onApplyDiscount}
            >
              {validatingDiscount ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.discountApplyText}>Aplică</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
        {discountError && (
          <Text style={styles.discountErrorText}>{discountError}</Text>
        )}

        {/* Notes */}
        <Text style={styles.notesLabel}>Mențiuni speciale (opțional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Ex: alergie la anumite produse, preferințe de stil..."
          placeholderTextColor={Colors.gray300}
          value={notes}
          onChangeText={onNotesChange}
          multiline
          maxLength={300}
          textAlignVertical="top"
        />
        <Text style={styles.notesCounter}>{notes.length}/300</Text>

        {/* Cancel policy */}
        <View style={styles.cancelPolicy}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.gray500} />
          <Text style={styles.cancelText}>
            Anulare gratuită cu minim 24h înainte de programare. Plata se face la salon.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function SummaryRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Ionicons name={icon} size={16} color={Colors.primary} />
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}
