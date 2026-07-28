import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, FontSize, FontWeight, Gradients, Radius, Shadow, Spacing } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api/client';
import { Address, addressesApi } from '../../services/api/addresses';
import AddressPicker from '../../components/client/AddressPicker';

// ── Constants ────────────────────────────────────────────────────────────────

const GENDER_OPTIONS = [
  { value: 'MALE',              label: 'Masculin' },
  { value: 'FEMALE',            label: 'Feminin' },
  { value: 'OTHER',             label: 'Altul' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer să nu spun' },
] as const;

const DEFAULT_ADDRESS_SUGGESTIONS = [
  { label: 'Acasă',    icon: 'home-outline' as const },
  { label: 'Serviciu', icon: 'briefcase-outline' as const },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ro-RO', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuthStore();

  // Profile fields
  const [firstName,   setFirstName]   = useState(user?.firstName ?? '');
  const [lastName,    setLastName]    = useState(user?.lastName  ?? '');
  const [email,       setEmail]       = useState(user?.email     ?? '');
  const [phone,       setPhone]       = useState(user?.phone     ?? '');
  const [avatarUri,   setAvatarUri]   = useState<string | null>(user?.avatarUrl ?? null);
  const [dateOfBirth, setDateOfBirth] = useState<string | null>(user?.dateOfBirth ?? null);
  const [gender,      setGender]      = useState<string | null>(user?.gender ?? null);
  const [saving,      setSaving]      = useState(false);

  // Date picker (iOS modal)
  const [showDatePicker, setShowDatePicker] = useState(false);
  const dobValue = dateOfBirth ? new Date(dateOfBirth) : new Date(1990, 0, 1);

  // Addresses
  const [addresses,        setAddresses]        = useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [pickerVisible,    setPickerVisible]    = useState(false);
  const [editingAddress,   setEditingAddress]   = useState<Address | null>(null);
  const [pickerLabel,      setPickerLabel]      = useState<string | undefined>(undefined);

  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();

  // ── Load addresses ──────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      setLoadingAddresses(true);
      try {
        const list = await addressesApi.list();
        setAddresses(list);
      } catch {
        // Graceful: stay with empty list
      } finally {
        setLoadingAddresses(false);
      }
    };
    load();
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permisiune necesară', 'Permite accesul la poze pentru a schimba avatarul.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const openDatePicker = () => {
    setShowDatePicker(true);
  };

  const handleDateChange = (_: any, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setDateOfBirth(date.toISOString().split('T')[0]);
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Câmpuri obligatorii', 'Prenumele și numele sunt obligatorii.');
      return;
    }
    setSaving(true);
    try {
      await api.patch('/auth/me', {
        firstName:   firstName.trim(),
        lastName:    lastName.trim(),
        email:       email.trim()  || undefined,
        phone:       phone.trim()  || undefined,
        dateOfBirth: dateOfBirth   || undefined,
        gender:      gender        || undefined,
      });
      updateUser({
        firstName:   firstName.trim(),
        lastName:    lastName.trim(),
        email:       email.trim()  || null,
        phone:       phone.trim()  || null,
        avatarUrl:   avatarUri,
        dateOfBirth: dateOfBirth,
        gender:      gender,
      });
      router.back();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      Alert.alert('Eroare', Array.isArray(msg) ? msg.join('\n') : (msg ?? 'Nu s-au putut salva modificările.'));
    } finally {
      setSaving(false);
    }
  };

  const openAddAddress = (label?: string) => {
    setEditingAddress(null);
    setPickerLabel(label);
    setPickerVisible(true);
  };

  const openEditAddress = (addr: Address) => {
    setEditingAddress(addr);
    setPickerLabel(undefined);
    setPickerVisible(true);
  };

  const handleAddressSaved = (saved: Address) => {
    setAddresses((prev) => {
      const idx = prev.findIndex((a) => a.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    setPickerVisible(false);
  };

  const handleRemoveAddress = (id: string) => {
    Alert.alert('Șterge adresa', 'Ești sigur că vrei să ștergi această adresă?', [
      { text: 'Anulează', style: 'cancel' },
      {
        text: 'Șterge', style: 'destructive',
        onPress: async () => {
          try {
            await addressesApi.remove(id);
          } catch {
            // Dev: already silenced inside the service
          }
          setAddresses((prev) => prev.filter((a) => a.id !== id));
        },
      },
    ]);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>

      {/* ── Brand gradient hero: header nav + avatar ── */}
      <LinearGradient
        colors={Gradients.brand}
        start={Gradients.start}
        end={Gradients.end}
        style={[styles.heroBanner, { paddingTop: insets.top }]}
      >
        {/* Header row */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Editează profilul</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn}>
            {saving
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <Text style={styles.saveBtnText}>Salvează</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity style={styles.avatarWrap} onPress={pickAvatar} activeOpacity={0.8}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
            ) : (
              <LinearGradient
                colors={Gradients.brandDeep}
                start={Gradients.start}
                end={Gradients.end}
                style={styles.avatarGradient}
              >
                <Text style={styles.avatarInitials}>{initials || '?'}</Text>
              </LinearGradient>
            )}
            <View style={styles.avatarBadge}>
              <Ionicons name="camera" size={14} color={Colors.white} />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Apasă pentru a schimba poza</Text>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

          {/* Personal info card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Informații personale</Text>
            <Field label="Prenume" value={firstName} onChangeText={setFirstName} placeholder="Prenumele tău" autoCapitalize="words" />
            <Field label="Nume" value={lastName} onChangeText={setLastName} placeholder="Numele tău" autoCapitalize="words" />

            {/* Date of birth */}
            <View style={fieldSt.wrap}>
              <Text style={fieldSt.label}>Data nașterii</Text>
              <TouchableOpacity style={fieldSt.row} onPress={openDatePicker} activeOpacity={0.7}>
                <Text style={[fieldSt.rowText, !dateOfBirth && { color: Colors.gray300 }]}>
                  {dateOfBirth ? formatDate(dateOfBirth) : 'Alege data'}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Gender */}
            <View style={fieldSt.wrap}>
              <Text style={fieldSt.label}>Gen</Text>
              <View style={styles.genderGrid}>
                {GENDER_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.pill, gender === opt.value && styles.pillActive]}
                    onPress={() => setGender(gender === opt.value ? null : opt.value)}
                  >
                    <Text style={[styles.pillText, gender === opt.value && styles.pillTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Contact card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Contact</Text>
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="email@exemplu.com" keyboardType="email-address" />
            <Field label="Telefon" value={phone} onChangeText={setPhone} placeholder="+40700000000" keyboardType="phone-pad" />
          </View>

          {/* Addresses card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Adresele mele</Text>
              <TouchableOpacity onPress={() => openAddAddress()} style={styles.addAddrBtn}>
                <Ionicons name="add" size={15} color={Colors.primary} />
                <Text style={styles.addAddrText}>Adaugă</Text>
              </TouchableOpacity>
            </View>

            {loadingAddresses ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 12 }} />
            ) : addresses.length === 0 ? (
              <View>
                {DEFAULT_ADDRESS_SUGGESTIONS.map((s, i) => (
                  <React.Fragment key={s.label}>
                    {i > 0 && <View style={styles.divider} />}
                    <TouchableOpacity style={styles.addrSuggestion} onPress={() => openAddAddress(s.label)}>
                      <View style={styles.addrIconWrap}>
                        <Ionicons name={s.icon} size={18} color={Colors.primary} />
                      </View>
                      <Text style={styles.addrSuggestionText}>{s.label}</Text>
                      <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
              </View>
            ) : (
              <View>
                {addresses.map((addr, i) => (
                  <React.Fragment key={addr.id}>
                    {i > 0 && <View style={styles.divider} />}
                    <View style={styles.addrRow}>
                      <TouchableOpacity style={styles.addrMain} onPress={() => openEditAddress(addr)} activeOpacity={0.7}>
                        <View style={styles.addrIconWrap}>
                          <Ionicons name="location-outline" size={18} color={Colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.addrLabel}>{addr.label}</Text>
                          <Text style={styles.addrLine} numberOfLines={1}>
                            {addr.addressLine1}{addr.city ? `, ${addr.city}` : ''}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={15} color={Colors.gray300} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.addrDelete}
                        onPress={() => handleRemoveAddress(addr.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={16} color={Colors.error} />
                      </TouchableOpacity>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date picker — Android renders as dialog; iOS as bottom-sheet modal */}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={dobValue}
          mode="date"
          display="default"
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}
      {showDatePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setShowDatePicker(false)}>
          <TouchableOpacity style={styles.dateOverlay} activeOpacity={1} onPress={() => setShowDatePicker(false)}>
            <View style={styles.dateSheet} onStartShouldSetResponder={() => true}>
              <View style={styles.dateHandle} />
              <Text style={styles.dateTitle}>Data nașterii</Text>
              <DateTimePicker
                value={dobValue}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                maximumDate={new Date()}
                locale="ro-RO"
                textColor={Colors.black}
                style={{ width: '100%' }}
              />
              <TouchableOpacity style={styles.dateConfirm} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.dateConfirmText}>Confirmă</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Address picker modal */}
      <AddressPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSave={handleAddressSaved}
        address={editingAddress}
        initialLabel={pickerLabel}
      />
    </View>
  );
}

// ── Field component ───────────────────────────────────────────────────────────

function Field({
  label, value, onChangeText, placeholder, keyboardType, autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: any;
  autoCapitalize?: any;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={fieldSt.wrap}>
      <Text style={fieldSt.label}>{label}</Text>
      <TextInput
        style={[fieldSt.input, focused && fieldSt.inputFocused]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.gray300}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'none'}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const fieldSt = StyleSheet.create({
  wrap: { marginBottom: Spacing.sm },
  label: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.gray500,
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.gray50, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 13,
    fontSize: FontSize.md, color: Colors.ink,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  inputFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.gray50, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 13,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  rowText: { fontSize: FontSize.md, color: Colors.ink, flex: 1 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  // ── Gradient hero ──
  heroBanner: {
    width: '100%',
    paddingBottom: Spacing.xl + 4,
  },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  iconBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.white },
  // White pill on gradient = clear primary action with high contrast
  saveBtn: {
    backgroundColor: Colors.white,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    ...Shadow.sm,
  },
  saveBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },

  // ── Avatar ──
  avatarSection: { alignItems: 'center', paddingBottom: 4 },
  avatarWrap:    { position: 'relative' },
  avatarImg: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 3, borderColor: Colors.white,
    ...Shadow.lg,
  },
  avatarGradient: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)',
    ...Shadow.lg,
  },
  avatarInitials: { color: Colors.white, fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
  avatarBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: Colors.white,
  },
  avatarHint: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.85)',
  },

  // ── Form body ──
  body: { paddingHorizontal: Spacing.lg, paddingBottom: 48, paddingTop: Spacing.lg },

  // ── Section cards ──
  card: {
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  cardTitle: {
    fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary,
    marginBottom: Spacing.sm,
  },

  // ── Gender pills ──
  genderGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.gray300,
    backgroundColor: Colors.white,
  },
  pillActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillText:       { fontSize: FontSize.sm, color: Colors.gray700, fontWeight: FontWeight.medium },
  pillTextActive: { color: Colors.white, fontWeight: FontWeight.semibold },

  // ── Add address ──
  addAddrBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addAddrText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },

  // ── Address rows ──
  divider:    { height: StyleSheet.hairlineWidth, backgroundColor: Colors.gray100, marginVertical: 2 },
  addrRow:    { flexDirection: 'row', alignItems: 'center' },
  addrMain:   { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  addrDelete: { paddingLeft: 12, paddingVertical: 10 },
  addrIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  addrLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink },
  addrLine:  { fontSize: FontSize.xs, color: Colors.gray500, marginTop: 1 },

  // ── Default suggestion rows ──
  addrSuggestion: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
  },
  addrSuggestionText: { flex: 1, fontSize: FontSize.md, color: Colors.gray500 },

  // ── Date picker iOS modal ──
  dateOverlay: {
    flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end',
  },
  dateSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg, paddingBottom: 32, paddingTop: 12,
  },
  dateHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.gray300,
    alignSelf: 'center', marginBottom: Spacing.sm,
  },
  dateTitle:       { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black, textAlign: 'center', marginBottom: 4 },
  dateConfirm:     { backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: 15, alignItems: 'center', marginTop: 8 },
  dateConfirmText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
