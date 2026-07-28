import React, { forwardRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';
import type { AppointmentStatus, BusinessAppointment } from '../../store/businessStore';
import DraggableSheet, { DraggableSheetRef } from '../common/DraggableSheet';
import Button from '../common/Button';
import {
  SOURCE_COLORS,
  SOURCE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from './calendar/constants';
import { getAvailableStatusActions, StatusAction } from '../../utils/appointmentActions';

// Shared visual bar for the redesigned business sheets.
const SUBTLE_BORDER = 'rgba(216,216,216,0.8)';
const MUTED_TEXT = 'rgba(34,34,34,0.65)';

// Only not-yet-final appointments can be moved (mirrors the server rule).
const RESCHEDULABLE_STATUSES: AppointmentStatus[] = ['PENDING', 'CONFIRMED'];

// Positive transitions get the brand-gradient CTA; destructive ones stay
// outlined in their semantic color. Unknown statuses (e.g. a future REJECTED)
// safely fall into the outlined branch.
const POSITIVE_STATUSES: AppointmentStatus[] = ['CONFIRMED', 'COMPLETED'];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

export interface AppointmentSheetProps {
  /** Appointment shown in the sheet; nothing renders while null. */
  appt: BusinessAppointment | null;
  /** Fired after the sheet fully closes (drag-down, backdrop tap or dismiss()). */
  onDismiss?: () => void;
  /** Owner wants to move this appointment (opens the reschedule flow). */
  onReschedule: (appt: BusinessAppointment) => void;
  /** Owner picked a status transition (optimistic update handled by caller). */
  onStatusChange: (appt: BusinessAppointment, status: AppointmentStatus) => void;
}

/**
 * Draggable appointment-detail sheet for the business calendar.
 * Present/dismiss imperatively via the forwarded DraggableSheetRef.
 */
const AppointmentSheet = forwardRef<DraggableSheetRef, AppointmentSheetProps>(
  function AppointmentSheet({ appt, onDismiss, onReschedule, onStatusChange }, ref) {
    return (
      <DraggableSheet ref={ref} snapPoints={['80%']} scrollable onDismiss={onDismiss}>
        {appt ? (
          <SheetContent appt={appt} onReschedule={onReschedule} onStatusChange={onStatusChange} />
        ) : null}
      </DraggableSheet>
    );
  },
);

export default AppointmentSheet;

// ── Content ───────────────────────────────────────────────────────────────────
function SheetContent({ appt, onReschedule, onStatusChange }: {
  appt: BusinessAppointment;
  onReschedule: (appt: BusinessAppointment) => void;
  onStatusChange: (appt: BusinessAppointment, status: AppointmentStatus) => void;
}) {
  // Time-gated: "Marchează finalizat" / "Neprezentare" only appear once the
  // appointment's start time has passed (before that, cancel is the only exit).
  const nextActions = getAvailableStatusActions(appt.status, appt.startAt);
  const canReschedule = RESCHEDULABLE_STATUSES.includes(appt.status);
  const statusColor = STATUS_COLORS[appt.status] ?? Colors.gray500;
  const sourceColor = SOURCE_COLORS[appt.source] ?? Colors.gray500;

  return (
    <View style={styles.content}>
      {/* Status + booking source (walk-in vs online vs phone) */}
      <View style={styles.badgeRow}>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '1A' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {STATUS_LABELS[appt.status] ?? appt.status}
          </Text>
        </View>
        <View style={styles.sourceChip}>
          <Ionicons
            name={appt.source === 'ONLINE' ? 'phone-portrait-outline' : 'walk-outline'}
            size={12}
            color={sourceColor}
          />
          <Text style={[styles.sourceChipText, { color: sourceColor }]}>
            {SOURCE_LABELS[appt.source] ?? appt.source}
          </Text>
        </View>
      </View>

      <Text style={styles.clientName}>{appt.clientName}</Text>
      {appt.clientPhone && (
        <View style={styles.phoneRow}>
          <Ionicons name="call-outline" size={15} color={Colors.primary} />
          <Text style={styles.phoneText}>{appt.clientPhone}</Text>
        </View>
      )}

      {/* Details card */}
      <View style={styles.infoCard}>
        <InfoRow icon="cut-outline" label="Serviciu" value={appt.serviceName} />
        <InfoRow icon="person-outline" label="Specialist" value={appt.staffName} />
        <InfoRow
          icon="time-outline"
          label="Orar"
          value={`${formatTime(appt.startAt)} – ${formatTime(appt.endAt)} (${appt.serviceDuration} min)`}
        />
        <InfoRow icon="cash-outline" label="Preț" value={`${appt.servicePrice} RON`} />
        {appt.notes ? (
          <InfoRow icon="document-text-outline" label="Notă" value={appt.notes} isLast />
        ) : (
          <InfoRow
            icon={appt.source === 'ONLINE' ? 'phone-portrait-outline' : 'walk-outline'}
            label="Sursă"
            value={SOURCE_LABELS[appt.source] ?? appt.source}
            isLast
          />
        )}
      </View>

      {canReschedule && (
        <TouchableOpacity
          style={styles.reschedulePill}
          onPress={() => onReschedule(appt)}
          activeOpacity={0.85}
        >
          <Ionicons name="calendar-outline" size={17} color={Colors.primary} />
          <Text style={styles.reschedulePillText}>Modifică data/ora</Text>
        </TouchableOpacity>
      )}

      {nextActions.length > 0 && (
        <View style={styles.actions}>
          {nextActions.map((action) => (
            <ActionButton
              key={action.status}
              action={action}
              onPress={() => onStatusChange(appt, action.status)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Building blocks ───────────────────────────────────────────────────────────
function InfoRow({ icon, label, value, isLast }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !isLast && styles.infoRowDivider]}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={15} color={Colors.primary} />
      </View>
      <View style={styles.infoBody}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function ActionButton({ action, onPress }: { action: StatusAction; onPress: () => void }) {
  if (POSITIVE_STATUSES.includes(action.status)) {
    return <Button title={action.label} fullWidth onPress={onPress} />;
  }
  return (
    <TouchableOpacity
      style={[styles.outlineAction, { borderColor: action.color }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.outlineActionText, { color: action.color }]}>{action.label}</Text>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: 40 },

  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  sourceChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full,
    borderWidth: 1, borderColor: SUBTLE_BORDER, backgroundColor: Colors.white,
  },
  sourceChipText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  clientName: { fontSize: FontSize.xxl, fontWeight: FontWeight.heavy, color: Colors.ink },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  phoneText: { fontSize: FontSize.sm, color: MUTED_TEXT, fontWeight: FontWeight.medium },

  infoCard: {
    marginTop: Spacing.md, marginBottom: Spacing.md,
    borderRadius: Radius.xl, borderWidth: 1, borderColor: SUBTLE_BORDER,
    backgroundColor: Colors.white, paddingHorizontal: Spacing.md,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  infoRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SUBTLE_BORDER },
  infoIconWrap: {
    width: 32, height: 32, borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  infoBody: { flex: 1 },
  infoLabel: {
    fontSize: 10, color: MUTED_TEXT, fontWeight: FontWeight.semibold,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2,
  },
  infoValue: { fontSize: FontSize.sm, color: Colors.ink, fontWeight: FontWeight.medium },

  reschedulePill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: Radius.pill, paddingVertical: 13, marginBottom: Spacing.sm,
    backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: SUBTLE_BORDER,
  },
  reschedulePillText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: FontWeight.bold },

  actions: { gap: 8 },
  outlineAction: {
    borderRadius: Radius.pill, borderWidth: 1.5, paddingVertical: 13,
    alignItems: 'center', backgroundColor: Colors.white,
  },
  outlineActionText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
