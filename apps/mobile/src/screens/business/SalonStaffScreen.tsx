import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal,
  Platform, ScrollView, StyleSheet, Switch, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { Colors, FontSize, FontWeight, Radius, Shadow, Spacing } from '../../theme';
import { useBusinessStore, BusinessStaff } from '../../store/businessStore';
import { businessApi, StaffCredentials } from '../../services/api/business';
import StaffCredentialsModal from '../../components/business/StaffCredentialsModal';
import { backToSettings } from '../../components/business/SettingsHeader';

const STAFF_EMOJIS = ['👩‍🦱', '👨‍🦰', '👩‍🦳', '👩‍🦲', '👨‍🦳', '👩', '👨', '👱‍♀️', '👱', '🧑', '👴', '👵'];

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,30}$/;

// "Elena Ionescu" → "elena.ionescu" — starting suggestion for the username.
function suggestUsername(firstName: string, lastName: string): string {
  return [firstName, lastName]
    .map((p) => p.trim().toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter(Boolean)
    .join('.');
}

export default function SalonStaffScreen() {
  const router = useRouter();
  const {
    staff, setStaff, addStaffMember, updateStaffMember, removeStaffMember,
    salonProfile, setSalonProfile,
  } = useBusinessStore();

  // Resolve the owner's real salon id (UUID) — the staff API requires it.
  const salonId = salonProfile?.id ?? null;

  const [loading,  setLoading]  = useState(staff.length === 0);
  const [modal,    setModal]    = useState<'add' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<BusinessStaff | null>(null);

  // Form fields
  const [firstName,  setFirstName]  = useState('');
  const [lastName,   setLastName]   = useState('');
  const [specialty,  setSpecialty]  = useState('');
  const [emoji,      setEmoji]      = useState('👩‍🦱');
  const [isActive,   setIsActive]   = useState(true);
  const [username,   setUsername]   = useState('');
  const [saving,     setSaving]     = useState(false);

  // Staff login credentials (owner-managed; password shown exactly once)
  const [shownCreds, setShownCreds] = useState<{ credentials: StaffCredentials; staffName: string } | null>(null);
  const [credTarget, setCredTarget] = useState<BusinessStaff | null>(null);
  const [credUsername, setCredUsername] = useState('');

  // Resolve the real salon id first if it isn't already in the store.
  useEffect(() => {
    if (salonProfile) return;
    businessApi.getSalonProfile().then(setSalonProfile).catch(() => setLoading(false));
  }, []);

  // Fetch staff once the real salon id is known. The manage listing is
  // owner-only and includes usernames (needed for the account/reset buttons).
  useEffect(() => {
    if (!salonId) return;
    businessApi.getStaffManage(salonId)
      .then(setStaff)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [salonId]);

  const openAdd = () => {
    setFirstName(''); setLastName(''); setSpecialty(''); setUsername('');
    setEmoji('👩‍🦱'); setIsActive(true); setEditTarget(null);
    setModal('add');
  };

  const openEdit = (member: BusinessStaff) => {
    setEditTarget(member);
    setFirstName(member.firstName);
    setLastName(member.lastName);
    setSpecialty(member.specialty);
    setEmoji(member.avatarEmoji);
    setIsActive(member.isActive);
    setModal('edit');
  };

  const closeModal = () => { setModal(null); setEditTarget(null); };

  const handleSave = async () => {
    if (!firstName.trim()) {
      Alert.alert('Câmp obligatoriu', 'Prenumele este obligatoriu.');
      return;
    }
    if (!salonId) {
      Alert.alert('Eroare', 'Salonul nu a fost încă încărcat. Încearcă din nou.');
      return;
    }
    const trimmedUsername = username.trim().toLowerCase();
    if (modal === 'add' && trimmedUsername && !USERNAME_PATTERN.test(trimmedUsername)) {
      Alert.alert(
        'Username invalid',
        'Folosește 3–30 de caractere: litere, cifre, punct, liniuță sau underscore.',
      );
      return;
    }
    setSaving(true);
    try {
      const dto = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        specialty: specialty.trim() || 'Specialist',
        avatarEmoji: emoji,
      };

      if (modal === 'add') {
        const { staff: created, credentials } = await businessApi.createStaffMember(
          salonId,
          trimmedUsername ? { ...dto, username: trimmedUsername } : dto,
        );
        addStaffMember(created);
        closeModal();
        if (credentials) {
          setShownCreds({
            credentials,
            staffName: `${created.firstName} ${created.lastName}`.trim(),
          });
        }
        return;
      }
      if (modal === 'edit' && editTarget) {
        const updated = await businessApi.updateStaffMember(salonId, editTarget.id, { ...dto, isActive });
        updateStaffMember(updated);
      }
      closeModal();
    } catch (err) {
      const isUsernameTaken =
        axios.isAxiosError(err) && err.response?.status === 409;
      // No local fake staff — an unsaved member would never be bookable.
      Alert.alert(
        'Eroare',
        isUsernameTaken
          ? 'Username-ul este deja folosit. Alege altul.'
          : 'Nu am putut salva specialistul. Încearcă din nou.',
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Staff login credentials (owner) ─────────────────────────────────────────

  const openCredentials = (member: BusinessStaff) => {
    if (member.username) {
      Alert.alert(
        'Resetează parola',
        `${member.firstName} are contul „${member.username}". Resetezi parola? Cea veche nu va mai funcționa.`,
        [
          { text: 'Anulează', style: 'cancel' },
          {
            text: 'Resetează', style: 'destructive',
            onPress: async () => {
              if (!salonId) return;
              try {
                const credentials = await businessApi.resetStaffCredentials(salonId, member.id);
                setShownCreds({
                  credentials,
                  staffName: `${member.firstName} ${member.lastName}`.trim(),
                });
              } catch {
                Alert.alert('Eroare', 'Nu am putut reseta parola. Încearcă din nou.');
              }
            },
          },
        ],
      );
      return;
    }
    setCredUsername(suggestUsername(member.firstName, member.lastName));
    setCredTarget(member);
  };

  const handleCreateCredentials = async () => {
    if (!salonId || !credTarget) return;
    const normalized = credUsername.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(normalized)) {
      Alert.alert(
        'Username invalid',
        'Folosește 3–30 de caractere: litere, cifre, punct, liniuță sau underscore.',
      );
      return;
    }
    setSaving(true);
    try {
      const credentials = await businessApi.createStaffCredentials(salonId, credTarget.id, normalized);
      updateStaffMember({ ...credTarget, username: credentials.username });
      setShownCreds({
        credentials,
        staffName: `${credTarget.firstName} ${credTarget.lastName}`.trim(),
      });
      setCredTarget(null);
    } catch (err) {
      const isUsernameTaken =
        axios.isAxiosError(err) && err.response?.status === 409;
      Alert.alert(
        'Eroare',
        isUsernameTaken
          ? 'Username-ul este deja folosit. Alege altul.'
          : 'Nu am putut crea contul. Încearcă din nou.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (member: BusinessStaff) => {
    Alert.alert(
      'Elimină angajat',
      `Ești sigur că vrei să elimini pe ${member.firstName} ${member.lastName} din echipă?`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Elimină', style: 'destructive',
          onPress: async () => {
            if (!salonId) return;
            try {
              await businessApi.deleteStaffMember(salonId, member.id);
              removeStaffMember(member.id);
            } catch {
              Alert.alert('Eroare', 'Nu am putut elimina specialistul. Încearcă din nou.');
            }
          },
        },
      ],
    );
  };

  const handleToggleActive = async (member: BusinessStaff) => {
    if (!salonId) return;
    const updated = { ...member, isActive: !member.isActive };
    updateStaffMember(updated);
    try {
      await businessApi.updateStaffMember(salonId, member.id, { isActive: !member.isActive });
    } catch {
      updateStaffMember(member); // rollback
      Alert.alert('Eroare', 'Nu am putut actualiza statusul. Încearcă din nou.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => backToSettings(router)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color={Colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Echipă</Text>
        <TouchableOpacity style={styles.addHeaderBtn} onPress={openAdd}>
          <Ionicons name="add" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {staff.length === 0 ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 48 }}>👥</Text>
              <Text style={styles.emptyTitle}>Niciun angajat adăugat</Text>
              <Text style={styles.emptySubtitle}>Adaugă membrii echipei pentru a permite clienților să aleagă preferatul lor.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={openAdd}>
                <Ionicons name="add-circle-outline" size={18} color={Colors.white} />
                <Text style={styles.emptyBtnText}>Adaugă primul angajat</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {staff.map((member) => (
                <StaffCard
                  key={member.id}
                  member={member}
                  onEdit={() => openEdit(member)}
                  onDelete={() => handleDelete(member)}
                  onToggleActive={() => handleToggleActive(member)}
                  onCredentials={() => openCredentials(member)}
                />
              ))}
              <TouchableOpacity style={styles.addMoreBtn} onPress={openAdd}>
                <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                <Text style={styles.addMoreText}>Adaugă angajat nou</Text>
              </TouchableOpacity>
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Add / Edit modal */}
      <Modal visible={!!modal} transparent animationType="slide" onRequestClose={closeModal}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeModal} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>
              {modal === 'add' ? 'Adaugă angajat' : 'Editează angajat'}
            </Text>

            {/* Emoji picker */}
            <Text style={styles.sheetLabel}>Avatar</Text>
            <View style={styles.emojiRow}>
              {STAFF_EMOJIS.map((e) => (
                <TouchableOpacity
                  key={e}
                  style={[styles.emojiBtn, emoji === e && styles.emojiBtnActive]}
                  onPress={() => setEmoji(e)}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Preview */}
            <View style={styles.previewRow}>
              <View style={styles.previewAvatar}>
                <Text style={{ fontSize: 28 }}>{emoji}</Text>
              </View>
              <Text style={styles.previewName}>
                {firstName || 'Prenume'} {lastName}
              </Text>
            </View>

            <Text style={styles.sheetLabel}>Prenume *</Text>
            <TextInput
              style={styles.sheetInput}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Elena"
              placeholderTextColor={Colors.gray300}
              autoCapitalize="words"
            />

            <Text style={styles.sheetLabel}>Nume de familie</Text>
            <TextInput
              style={styles.sheetInput}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Ionescu"
              placeholderTextColor={Colors.gray300}
              autoCapitalize="words"
            />

            <Text style={styles.sheetLabel}>Specializare</Text>
            <TextInput
              style={styles.sheetInput}
              value={specialty}
              onChangeText={setSpecialty}
              placeholder="Hair Stylist Senior"
              placeholderTextColor={Colors.gray300}
              autoCapitalize="words"
            />

            {modal === 'add' && (
              <>
                <Text style={styles.sheetLabel}>Username pentru login (opțional)</Text>
                <TextInput
                  style={styles.sheetInput}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="elena.ionescu"
                  placeholderTextColor={Colors.gray300}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.usernameHint}>
                  Cu username, specialistul primește cont propriu în aplicație și
                  își vede doar programările lui. Parola se generează automat.
                </Text>
              </>
            )}

            {modal === 'edit' && (
              <View style={styles.activeRow}>
                <View>
                  <Text style={styles.sheetLabel}>Activ</Text>
                  <Text style={styles.activeDesc}>Angajatul apare în calendar și poate fi ales de clienți</Text>
                </View>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ true: Colors.primary, false: Colors.gray300 }}
                  thumbColor={Colors.white}
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.sheetSaveBtn, (!firstName.trim() || saving) && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={!firstName.trim() || saving}
            >
              {saving
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.sheetSaveBtnText}>{modal === 'add' ? 'Adaugă' : 'Salvează'}</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Create-credentials prompt for an existing member without an account */}
      <Modal
        visible={!!credTarget}
        transparent
        animationType="slide"
        onRequestClose={() => setCredTarget(null)}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setCredTarget(null)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>
              Cont pentru {credTarget?.firstName} {credTarget?.lastName}
            </Text>

            <Text style={styles.sheetLabel}>Username</Text>
            <TextInput
              style={styles.sheetInput}
              value={credUsername}
              onChangeText={setCredUsername}
              placeholder="elena.ionescu"
              placeholderTextColor={Colors.gray300}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.usernameHint}>
              Parola se generează automat și se afișează o singură dată, imediat
              după creare.
            </Text>

            <TouchableOpacity
              style={[styles.sheetSaveBtn, (!credUsername.trim() || saving) && { opacity: 0.5 }]}
              onPress={handleCreateCredentials}
              disabled={!credUsername.trim() || saving}
            >
              {saving
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.sheetSaveBtnText}>Creează cont</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* One-time credentials display (creation + password reset) */}
      <StaffCredentialsModal
        credentials={shownCreds?.credentials ?? null}
        staffName={shownCreds?.staffName ?? ''}
        onClose={() => setShownCreds(null)}
      />
    </SafeAreaView>
  );
}

// ── StaffCard ─────────────────────────────────────────────────────────────────

function StaffCard({
  member, onEdit, onDelete, onToggleActive, onCredentials,
}: {
  member: BusinessStaff;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onCredentials: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={[styles.avatar, !member.isActive && styles.avatarInactive]}>
        <Text style={{ fontSize: 26 }}>{member.avatarEmoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.cardNameRow}>
          <Text style={[styles.cardName, !member.isActive && { color: Colors.gray400 }]}>
            {member.firstName} {member.lastName}
          </Text>
          {!member.isActive && (
            <View style={styles.inactiveBadge}>
              <Text style={styles.inactiveBadgeText}>Inactiv</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardSpec}>{member.specialty}</Text>
      </View>

      {/* Active toggle */}
      <Switch
        value={member.isActive}
        onValueChange={onToggleActive}
        trackColor={{ true: Colors.primary, false: Colors.gray300 }}
        thumbColor={Colors.white}
        style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
      />

      {/* Login credentials: create account / reset password */}
      <TouchableOpacity style={styles.cardActionBtn} onPress={onCredentials}>
        <Ionicons
          name={member.username ? 'key' : 'key-outline'}
          size={18}
          color={member.username ? Colors.success : Colors.primary}
        />
      </TouchableOpacity>

      {/* Edit */}
      <TouchableOpacity style={styles.cardActionBtn} onPress={onEdit}>
        <Ionicons name="pencil-outline" size={18} color={Colors.primary} />
      </TouchableOpacity>

      {/* Delete */}
      <TouchableOpacity style={styles.cardActionBtn} onPress={onDelete}>
        <Ionicons name="trash-outline" size={18} color={Colors.error} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: 14,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderColor: Colors.border,
  },
  backBtn: {
    width: 38, height: 38, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.gray50, borderRadius: Radius.full,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black },
  addHeaderBtn: {
    width: 38, height: 38, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryLight, borderRadius: Radius.full,
  },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg },

  // Cards
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: Spacing.sm, ...Shadow.sm,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInactive: { backgroundColor: Colors.gray100 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  cardName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.black },
  cardSpec: { fontSize: FontSize.xs, color: Colors.gray500 },
  inactiveBadge: {
    backgroundColor: Colors.gray100, borderRadius: Radius.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  inactiveBadgeText: { fontSize: 9, color: Colors.gray400, fontWeight: FontWeight.semibold },
  cardActionBtn: {
    width: 34, height: 34, alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.md, backgroundColor: Colors.gray50,
  },

  addMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.lg,
    borderStyle: 'dashed', padding: 14, marginTop: Spacing.sm,
  },
  addMoreText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: FontWeight.semibold },

  // Empty state
  empty: { alignItems: 'center', paddingVertical: Spacing.xl },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black, marginTop: Spacing.md },
  emptySubtitle: {
    fontSize: FontSize.sm, color: Colors.gray500, textAlign: 'center',
    marginTop: 6, marginBottom: Spacing.lg, lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingHorizontal: 20, paddingVertical: 14,
  },
  emptyBtnText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },

  // Modal
  overlay: { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, paddingBottom: 40, maxHeight: '85%',
  },
  handle: {
    width: 40, height: 4, backgroundColor: Colors.gray300, borderRadius: 2,
    alignSelf: 'center', marginBottom: Spacing.lg,
  },
  sheetTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black, marginBottom: Spacing.md },
  sheetLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.gray500,
    marginBottom: 6, marginTop: Spacing.sm,
  },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.sm },
  emojiBtn: {
    width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Colors.gray50,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
  },
  emojiBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  emojiText: { fontSize: 22 },
  previewRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.gray50, borderRadius: Radius.lg,
    padding: Spacing.sm, marginBottom: Spacing.sm,
  },
  previewAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  previewName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.black },
  sheetInput: {
    backgroundColor: Colors.gray50, borderRadius: Radius.lg, borderWidth: 1.5,
    borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 12,
    fontSize: FontSize.md, color: Colors.black,
  },
  activeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  activeDesc: { fontSize: FontSize.xs, color: Colors.gray400, marginTop: 2 },
  sheetSaveBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: 14,
    alignItems: 'center', marginTop: Spacing.lg,
  },
  sheetSaveBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  usernameHint: { fontSize: FontSize.xs, color: Colors.gray400, marginTop: 6, lineHeight: 16 },
});
