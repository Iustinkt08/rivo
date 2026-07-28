import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, FontWeight, Gradients, Radius, Spacing } from '../../theme';
import type { BusinessClient } from '../../store/businessStore';
import { businessApi } from '../../services/api/business';
import DraggableSheet, { DraggableSheetRef } from '../common/DraggableSheet';
import Button from '../common/Button';

// Shared visual bar for the redesigned business sheets.
const SUBTLE_BORDER = 'rgba(216,216,216,0.8)';
const MUTED_TEXT = 'rgba(34,34,34,0.65)';

// Client-list semantics shared with ClientsScreen (single source of truth).
export const VIP_VISIT_THRESHOLD = 10;
export const NO_SHOW_RISK_THRESHOLD = 2;
const TINT_VIP = '#FEF6E0';

export function getInitials(client: BusinessClient): string {
  const first = client.firstName?.[0] ?? '';
  const last = client.lastName?.[0] ?? '';
  return `${first}${last}`.toUpperCase() || '?';
}

export function VipBadge() {
  return (
    <View style={styles.vipBadge}>
      <Ionicons name="star" size={10} color={Colors.star} />
      <Text style={styles.vipBadgeText}>VIP</Text>
    </View>
  );
}

export interface ClientSheetProps {
  /** Client shown in the sheet; nothing renders while null. */
  client: BusinessClient | null;
  salonId: string | null;
  /** Fired after the sheet fully closes (drag-down, backdrop tap or dismiss()). */
  onDismiss?: () => void;
  onClientUpdate: (updated: BusinessClient) => void;
  onViewAppointments: () => void;
  /**
   * Extension point: extra sections (e.g. the loyalty punch-card) rendered
   * between the visit stats and the internal notes.
   */
  children?: React.ReactNode;
}

/**
 * Draggable client-detail sheet for the business clients screen.
 * Present/dismiss imperatively via the forwarded DraggableSheetRef.
 */
const ClientSheet = forwardRef<DraggableSheetRef, ClientSheetProps>(function ClientSheet(
  { client, salonId, onDismiss, onClientUpdate, onViewAppointments, children },
  ref,
) {
  const sheetRef = useRef<DraggableSheetRef>(null);

  useImperativeHandle(
    ref,
    () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }),
    [],
  );

  return (
    <DraggableSheet ref={sheetRef} snapPoints={['80%']} scrollable onDismiss={onDismiss}>
      {client && salonId ? (
        <SheetContent
          key={client.id}
          client={client}
          salonId={salonId}
          onClientUpdate={onClientUpdate}
          onViewAppointments={onViewAppointments}
          onRequestDismiss={() => sheetRef.current?.dismiss()}
        >
          {children}
        </SheetContent>
      ) : null}
    </DraggableSheet>
  );
});

export default ClientSheet;

// ── Content ───────────────────────────────────────────────────────────────────
function SheetContent({
  client, salonId, onClientUpdate, onViewAppointments, onRequestDismiss, children,
}: {
  client: BusinessClient;
  salonId: string;
  onClientUpdate: (updated: BusinessClient) => void;
  onViewAppointments: () => void;
  onRequestDismiss: () => void;
  children?: React.ReactNode;
}) {
  const [notes, setNotes] = useState(client.notes ?? '');
  const [isBlocked, setIsBlocked] = useState(client.isBlocked);
  const [savingNotes, setSavingNotes] = useState(false);
  const [togglingBlock, setTogglingBlock] = useState(false);
  const initials = getInitials(client);
  const isVip = client.totalVisits >= VIP_VISIT_THRESHOLD;

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await businessApi.updateClientNotes(salonId, client.id, notes);
      onClientUpdate({ ...client, notes, isBlocked });
      onRequestDismiss();
    } catch {
      Alert.alert('Eroare', 'Nu s-au putut salva notele. Încearcă din nou.');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleToggleBlock = async () => {
    const newBlocked = !isBlocked;
    setIsBlocked(newBlocked); // optimistic
    setTogglingBlock(true);
    try {
      const result = await businessApi.toggleBlockClient(salonId, client.id);
      setIsBlocked(result.isBlocked);
      onClientUpdate({ ...client, notes, isBlocked: result.isBlocked });
    } catch {
      setIsBlocked(!newBlocked); // rollback
      Alert.alert('Eroare', 'Acțiunea nu a putut fi efectuată. Încearcă din nou.');
    } finally {
      setTogglingBlock(false);
    }
  };

  const handleCall = () => {
    if (client.phone) Linking.openURL(`tel:${client.phone}`);
  };

  return (
    <View style={styles.content}>
      {/* Avatar + identity */}
      <View style={styles.header}>
        <LinearGradient
          colors={Gradients.brand}
          start={Gradients.start}
          end={Gradients.end}
          style={styles.avatar}
        >
          <Text style={styles.avatarInitials}>{initials}</Text>
        </LinearGradient>
        <View style={styles.headerBody}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {client.firstName} {client.lastName}
            </Text>
            {isVip && <VipBadge />}
          </View>
          {client.phone && <Text style={styles.contact}>{client.phone}</Text>}
          {client.email && <Text style={styles.contact}>{client.email}</Text>}
        </View>
      </View>

      {/* Visit stats */}
      <View style={styles.statsCard}>
        <StatBox label="Vizite" value={String(client.totalVisits)} />
        <View style={styles.statsDivider} />
        <StatBox
          label="No-show"
          value={String(client.noShowCount)}
          danger={client.noShowCount >= NO_SHOW_RISK_THRESHOLD}
        />
        <View style={styles.statsDivider} />
        <StatBox label="Status" value={isBlocked ? 'Blocat' : isVip ? 'VIP' : 'Activ'} />
      </View>

      {/* Extension sections (e.g. punch-card) slot in here */}
      {children}

      {/* Internal notes */}
      <Text style={styles.notesLabel}>Note interne (vizibile doar salonului)</Text>
      <BottomSheetTextInput
        style={styles.notesInput}
        multiline
        placeholder="Ex: preferă Elena, alergică la nichel..."
        placeholderTextColor={Colors.gray400}
        value={notes}
        onChangeText={setNotes}
      />

      {/* Quick actions */}
      <View style={styles.actionsRow}>
        {client.phone && (
          <ActionPill icon="call-outline" label="Sună" color={Colors.primary} onPress={handleCall} />
        )}
        <ActionPill
          icon="calendar-outline"
          label="Programări"
          color={Colors.primary}
          onPress={onViewAppointments}
        />
        <ActionPill
          icon={isBlocked ? 'checkmark-circle-outline' : 'ban-outline'}
          label={isBlocked ? 'Deblochează' : 'Blochează'}
          color={isBlocked ? Colors.success : Colors.error}
          onPress={handleToggleBlock}
          disabled={togglingBlock}
          loading={togglingBlock}
        />
      </View>

      <Button
        title="Salvează și închide"
        fullWidth
        loading={savingNotes}
        onPress={handleSaveNotes}
        style={styles.saveBtn}
      />
    </View>
  );
}

// ── Building blocks ───────────────────────────────────────────────────────────
function StatBox({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statBoxValue, danger && { color: Colors.error }]}>{value}</Text>
      <Text style={styles.statBoxLabel}>{label}</Text>
    </View>
  );
}

function ActionPill({ icon, label, color, onPress, disabled, loading }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.actionPill}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <>
          <Ionicons name={icon} size={17} color={color} />
          <Text style={[styles.actionPillText, { color }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: 40 },

  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.white },
  headerBody: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.ink },
  contact: { fontSize: FontSize.sm, color: MUTED_TEXT, marginTop: 2 },

  vipBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: TINT_VIP, borderRadius: Radius.full,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  vipBadgeText: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.star },

  statsCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: Radius.xl, borderWidth: 1, borderColor: SUBTLE_BORDER,
    backgroundColor: Colors.white, paddingVertical: Spacing.md, marginBottom: Spacing.md,
  },
  statsDivider: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: SUBTLE_BORDER },
  statBox: { flex: 1, alignItems: 'center' },
  statBoxValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.ink },
  statBoxLabel: { fontSize: FontSize.xs, color: MUTED_TEXT, marginTop: 2 },

  notesLabel: {
    fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.gray700,
    marginBottom: 6,
  },
  notesInput: {
    backgroundColor: Colors.gray50, borderRadius: Radius.md,
    borderWidth: 1, borderColor: SUBTLE_BORDER,
    padding: Spacing.md, fontSize: FontSize.sm, color: Colors.ink,
    minHeight: 80, textAlignVertical: 'top',
  },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: Spacing.md },
  actionPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: SUBTLE_BORDER, borderRadius: Radius.pill,
    paddingVertical: 11, backgroundColor: Colors.white,
  },
  actionPillText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  saveBtn: { marginTop: Spacing.md },
});
