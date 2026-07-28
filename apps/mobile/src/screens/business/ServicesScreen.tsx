import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Switch,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Radius, Shadow, Spacing } from '../../theme';
import { useBusinessStore, BusinessService, BusinessStaff } from '../../store/businessStore';
import { businessApi } from '../../services/api/business';
import { salonSettingsApi } from '../../services/api/salonSettings';
import { categoriesApi, ServiceCategory } from '../../services/api/categories';
import { getCategoryIcon, getCategoryLabel, renderIcon } from '../../constants/categories';
import SettingsHeader from '../../components/business/SettingsHeader';
import GlassView from '../../components/common/GlassView';

export default function ServicesScreen() {
  const {
    services, setServices, updateService, addService, removeService,
    salonProfile, setSalonProfile,
  } = useBusinessStore();
  const [showModal, setShowModal] = useState(false);
  const [editService, setEditService] = useState<BusinessService | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null); // tracks which toggle is in-flight
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [staff, setStaff] = useState<BusinessStaff[]>([]);
  const [loadError, setLoadError] = useState(false);

  // Resolve the owner's real salon id (UUID) — the services API requires it.
  const salonId = salonProfile?.id ?? null;

  useEffect(() => {
    if (salonProfile) return;
    businessApi.getSalonProfile().then(setSalonProfile).catch(() => setLoadError(true));
  }, []);

  // Load services (with staff assignments), categories and staff once the
  // real salon id is known.
  useEffect(() => {
    if (!salonId) return;
    salonSettingsApi.getServices(salonId).then(setServices).catch(() => {});
    categoriesApi.list().then(setCategories).catch(() => setCategories([]));
    businessApi.getStaff(salonId).then(setStaff).catch(() => setStaff([]));
  }, [salonId]);

  const grouped = services.reduce((acc, s) => {
    acc[s.category] = [...(acc[s.category] ?? []), s];
    return acc;
  }, {} as Record<string, BusinessService[]>);

  const activeCount = services.filter((s) => s.isActive).length;
  const avgPrice = activeCount
    ? Math.round(services.filter((s) => s.isActive).reduce((sum, s) => sum + s.price, 0) / activeCount)
    : 0;

  const openEdit = (s: BusinessService) => { setEditService(s); setShowModal(true); };
  const openNew = () => { setEditService(null); setShowModal(true); };

  // ── Toggle active ─────────────────────────────────────────────────────────

  const handleToggle = async (service: BusinessService) => {
    if (!salonId) return;
    // Optimistic update
    updateService({ ...service, isActive: !service.isActive });
    setSavingId(service.id);
    try {
      const updated = await businessApi.toggleService(salonId, service.id);
      // Preserve locally-known assignments — toggle response doesn't carry them
      // through the legacy mapper.
      updateService({ ...updated, staffIds: service.staffIds });
    } catch {
      // Rollback
      updateService(service);
      Alert.alert('Eroare', 'Nu s-a putut schimba starea serviciului.');
    } finally {
      setSavingId(null);
    }
  };

  // ── Save (create or update, incl. staff assignments) ─────────────────────

  const handleSave = async (dto: BusinessService) => {
    setShowModal(false);
    if (!salonId) {
      Alert.alert('Eroare', 'Salonul nu a fost încă încărcat. Încearcă din nou.');
      return;
    }
    const payload = {
      name: dto.name,
      categoryId: dto.categoryId ?? '',
      durationMin: dto.durationMin,
      price: dto.price,
      isActive: dto.isActive,
      staffIds: dto.staffIds ?? [],
    };
    try {
      if (editService) {
        // Optimistic
        updateService(dto);
        const updated = await salonSettingsApi.updateService(salonId, dto.id, payload);
        updateService(updated);
      } else {
        const created = await salonSettingsApi.createService(salonId, payload);
        addService(created);
      }
    } catch {
      if (editService) {
        // Rollback to old values
        updateService(editService);
      }
      Alert.alert('Eroare', 'Nu s-a putut salva serviciul.');
    }
  };

  // ── Long-press delete ─────────────────────────────────────────────────────

  const handleLongPress = (service: BusinessService) => {
    Alert.alert(
      'Șterge serviciu',
      `Ești sigur că vrei să ștergi "${service.name}"? Această acțiune este ireversibilă.`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge',
          style: 'destructive',
          onPress: async () => {
            if (!salonId) return;
            removeService(service.id); // optimistic
            try {
              await businessApi.deleteService(salonId, service.id);
            } catch {
              addService(service); // rollback
              Alert.alert('Eroare', 'Nu s-a putut șterge serviciul.');
            }
          },
        },
      ]
    );
  };

  const addButton = (
    <TouchableOpacity style={styles.addBtn} onPress={openNew}>
      <Ionicons name="add" size={22} color={Colors.white} />
    </TouchableOpacity>
  );

  // Salon couldn't be resolved (e.g. no salon yet / network) — show a clean
  // empty state instead of hitting the API with an invalid id.
  if (loadError && !salonId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <SettingsHeader title="Servicii" />
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 40 }}>🏪</Text>
          <Text style={styles.emptyText}>Nu am putut încărca salonul tău.</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => {
              setLoadError(false);
              businessApi.getSalonProfile().then(setSalonProfile).catch(() => setLoadError(true));
            }}
          >
            <Text style={styles.emptyBtnText}>Reîncearcă</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SettingsHeader title="Servicii" right={addButton} />

      {/* Summary — subtle glass stat cards */}
      <View style={styles.summary}>
        <SumCard label="Active" value={String(activeCount)} icon="checkmark-circle" color={Colors.success} />
        <SumCard label="Categorii" value={String(Object.keys(grouped).length)} icon="grid-outline" color={Colors.primary} />
        <SumCard label="Preț mediu" value={`${avgPrice} RON`} icon="cash-outline" color="#059669" />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        {Object.entries(grouped).map(([cat, items]) => (
          <View key={cat} style={{ marginBottom: Spacing.md }}>
            <View style={styles.catHeader}>
              {renderIcon(getCategoryIcon(cat), 18, Colors.primary)}
              <Text style={styles.catName}>{getCategoryLabel(cat)}</Text>
              <Text style={styles.catCount}>{items.length} servicii</Text>
            </View>
            {items.map((service) => (
              <ServiceRow
                key={service.id}
                service={service}
                staff={staff}
                saving={savingId === service.id}
                onEdit={() => openEdit(service)}
                onToggle={() => handleToggle(service)}
                onLongPress={() => handleLongPress(service)}
              />
            ))}
          </View>
        ))}

        {services.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 40 }}>✂️</Text>
            <Text style={styles.emptyText}>Niciun serviciu adăugat.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={openNew}>
              <Text style={styles.emptyBtnText}>Adaugă primul serviciu</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <ServiceModal
        visible={showModal}
        service={editService}
        categories={categories}
        staff={staff}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
      />
    </SafeAreaView>
  );
}

function SumCard({ label, value, icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <GlassView radius={Radius.lg} intensity={35} style={styles.sumCard}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.sumValue, { color }]}>{value}</Text>
      <Text style={styles.sumLabel}>{label}</Text>
    </GlassView>
  );
}

function ServiceRow({
  service, staff, saving, onEdit, onToggle, onLongPress,
}: {
  service: BusinessService;
  staff: BusinessStaff[];
  saving: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onLongPress: () => void;
}) {
  const assigned = staff.filter((m) => service.staffIds?.includes(m.id));
  return (
    <TouchableOpacity
      style={[styles.serviceCard, !service.isActive && { opacity: 0.55 }]}
      onLongPress={onLongPress}
      delayLongPress={500}
      activeOpacity={0.9}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.serviceName}>{service.name}</Text>
        <View style={styles.serviceMetaRow}>
          <Ionicons name="time-outline" size={12} color={Colors.gray500} />
          <Text style={styles.serviceMeta}>{service.durationMin} min</Text>
          <Text style={styles.serviceMeta}>·</Text>
          <Text style={[styles.serviceMeta, { color: Colors.primary, fontWeight: FontWeight.semibold }]}>
            {service.price} RON
          </Text>
        </View>
        {assigned.length > 0 && (
          <View style={styles.staffBadgeRow}>
            <Ionicons name="people-outline" size={11} color={Colors.gray500} />
            <Text style={styles.staffBadgeText} numberOfLines={1}>
              {assigned.map((m) => `${m.avatarEmoji ?? ''} ${m.firstName}`.trim()).join('  ')}
            </Text>
          </View>
        )}
      </View>
      <Switch
        value={service.isActive}
        onValueChange={onToggle}
        disabled={saving}
        trackColor={{ true: Colors.primary, false: Colors.gray300 }}
        thumbColor={Colors.white}
      />
      <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
        <Ionicons name="pencil-outline" size={16} color={Colors.gray500} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function ServiceModal({ visible, service, categories, staff, onClose, onSave }: {
  visible: boolean;
  service: BusinessService | null;
  categories: ServiceCategory[];
  staff: BusinessStaff[];
  onClose: () => void;
  onSave: (s: BusinessService) => void;
}) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [duration, setDuration] = useState('60');
  const [price, setPrice] = useState('100');
  const [staffIds, setStaffIds] = useState<string[]>([]);

  useEffect(() => {
    setName(service?.name ?? '');
    setDuration(String(service?.durationMin ?? 60));
    setPrice(String(service?.price ?? 100));
    setStaffIds(service?.staffIds ?? []);

    // Preselect the category: by categoryId when known, else by matching the
    // display name, else default to the first category for a brand-new service.
    if (categories.length === 0) {
      setCategoryId('');
      return;
    }
    const byId = service?.categoryId && categories.some((c) => c.id === service.categoryId)
      ? service.categoryId
      : undefined;
    const byName = !byId && service?.category
      ? categories.find((c) => c.name.toLowerCase() === service.category.toLowerCase())?.id
      : undefined;
    setCategoryId(byId ?? byName ?? (service ? '' : categories[0].id));
  }, [service, visible, categories]);

  const categoriesLoaded = categories.length > 0;

  const toggleStaff = (id: string) => {
    setStaffIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    const dur = parseInt(duration);
    const prc = parseInt(price);
    if (!name || isNaN(dur) || isNaN(prc) || !categoryId) return;
    const selected = categories.find((c) => c.id === categoryId);
    onSave({
      id: service?.id ?? '',
      name,
      category: selected?.name ?? service?.category ?? '',
      categoryId,
      durationMin: dur,
      price: prc,
      isActive: service?.isActive ?? true,
      staffIds,
    });
  };

  const canSave =
    name.trim().length > 0 && parseInt(duration) > 0 && parseInt(price) >= 0 &&
    categoriesLoaded && !!categoryId;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.modalTitle}>{service ? 'Editează serviciu' : 'Serviciu nou'}</Text>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: Spacing.sm }}
        >
          <Text style={styles.fieldLabel}>Denumire serviciu</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="Ex: Tuns + Spălat"
            placeholderTextColor={Colors.gray300}
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.fieldLabel}>Categorie</Text>
          {!categoriesLoaded ? (
            <View style={styles.catLoading}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : (
            <View style={styles.chipRow}>
              {categories.map((c) => {
                const active = categoryId === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.catChip, active && styles.catChipActive]}
                    onPress={() => setCategoryId(c.id)}
                  >
                    {renderIcon(getCategoryIcon(c.name), 14, active ? Colors.white : Colors.gray700)}
                    <Text style={[styles.catChipText, active && { color: Colors.white }]}>
                      {getCategoryLabel(c.name)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={styles.rowInputs}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Durată (min)</Text>
              <TextInput
                style={styles.fieldInput}
                keyboardType="number-pad"
                placeholder="60"
                placeholderTextColor={Colors.gray300}
                value={duration}
                onChangeText={setDuration}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Preț (RON)</Text>
              <TextInput
                style={styles.fieldInput}
                keyboardType="number-pad"
                placeholder="100"
                placeholderTextColor={Colors.gray300}
                value={price}
                onChangeText={setPrice}
              />
            </View>
          </View>

          {/* Staff assignment — multi-select, persisted as StaffService rows */}
          <Text style={styles.fieldLabel}>Cine prestează serviciul</Text>
          {staff.length === 0 ? (
            <Text style={styles.noStaffHint}>
              Nu ai membri în echipă încă. Adaugă-i din Setări → Echipa (Staff).
            </Text>
          ) : (
            <View style={styles.chipRow}>
              {staff.map((m) => {
                const active = staffIds.includes(m.id);
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.staffChip, active && styles.staffChipActive]}
                    onPress={() => toggleStaff(m.id)}
                  >
                    <Text style={styles.staffChipEmoji}>{m.avatarEmoji ?? '👤'}</Text>
                    <Text style={[styles.staffChipText, active && { color: Colors.white }]}>
                      {m.firstName}
                    </Text>
                    {active && <Ionicons name="checkmark" size={13} color={Colors.white} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>

        <TouchableOpacity
          style={[styles.saveBtn, !canSave && { opacity: 0.4 }]}
          disabled={!canSave}
          onPress={handleSave}
        >
          <Ionicons name="checkmark-circle" size={18} color={Colors.white} />
          <Text style={styles.saveBtnText}>{service ? 'Salvează modificările' : 'Adaugă serviciu'}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  addBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },

  summary: { flexDirection: 'row', marginHorizontal: Spacing.lg, gap: 8, marginVertical: Spacing.sm },
  sumCard: { flex: 1, borderRadius: Radius.lg, padding: Spacing.sm, alignItems: 'center' },
  sumValue: { fontSize: FontSize.xl, fontWeight: FontWeight.heavy, marginTop: 4 },
  sumLabel: { fontSize: 9, color: Colors.gray500, textAlign: 'center', marginTop: 2 },

  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  catName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black, flex: 1 },
  catCount: { fontSize: FontSize.xs, color: Colors.gray500 },

  serviceCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    padding: Spacing.md, marginBottom: 8, gap: Spacing.sm, ...Shadow.sm,
  },
  serviceName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.black, marginBottom: 3 },
  serviceMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  serviceMeta: { fontSize: FontSize.xs, color: Colors.gray500 },
  staffBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  staffBadgeText: { fontSize: FontSize.xs, color: Colors.gray500, flex: 1 },
  editBtn: { padding: 6 },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: Spacing.md },
  emptyText: { fontSize: FontSize.md, color: Colors.gray500 },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg, paddingVertical: 12 },
  emptyBtnText: { color: Colors.white, fontWeight: FontWeight.bold },

  overlay: { flex: 1, backgroundColor: Colors.overlay },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, paddingBottom: 40, maxHeight: '88%' },
  handle: { width: 40, height: 4, backgroundColor: Colors.gray300, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black, marginBottom: Spacing.md },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.gray700, marginBottom: 6, marginTop: Spacing.sm },
  fieldInput: { backgroundColor: Colors.gray50, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 13, fontSize: FontSize.md, color: Colors.black },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catChipText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.gray700 },
  catLoading: { paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  rowInputs: { flexDirection: 'row', gap: Spacing.sm },

  // Staff multi-select chips
  staffChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  staffChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  staffChipEmoji: { fontSize: FontSize.sm },
  staffChipText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.gray700 },
  noStaffHint: { fontSize: FontSize.xs, color: Colors.gray500, lineHeight: 17 },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: 16, marginTop: Spacing.md },
  saveBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
