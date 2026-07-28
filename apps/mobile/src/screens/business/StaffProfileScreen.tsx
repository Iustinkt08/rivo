import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, ScrollView, Share, StyleSheet, Switch,
  Text, TextInput, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, FontSize, FontWeight, Radius, Shadow, Spacing } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import {
  professionalsApi,
  EditableStaffProfile,
  StaffVisibilitySettings,
} from '../../services/api/professionals';
import {
  StaffPhotoCategory,
  createPhotoCategory,
  deletePhotoCategory,
  deleteStaffPhoto,
  listPhotoCategories,
  uploadStaffPhoto,
} from '../../services/api/staffGallery';
import { DEFAULT_STAFF_VISIBILITY } from '../../utils/professionalMapping';
import { buildProfessionalShare } from '../../utils/professionalShare';
import SettingsHeader from '../../components/business/SettingsHeader';
import DraggableSheet, { DraggableSheetRef } from '../../components/common/DraggableSheet';
import ProfessionalProfileContent from '../../components/client/ProfessionalProfileContent';
import Button from '../../components/common/Button';

// Same emoji set as the owner-facing SalonStaffScreen avatar picker.
const STAFF_EMOJIS = ['👩‍🦱', '👨‍🦰', '👩‍🦳', '👩‍🦲', '👨‍🦳', '👩', '👨', '👱‍♀️', '👱', '🧑', '👴', '👵'];

const BIO_MAX_LENGTH = 500;
const GRID_COLUMNS = 3;
const GRID_GAP = 8;

const VISIBILITY_ROWS: { key: keyof StaffVisibilitySettings; label: string; hint: string }[] = [
  { key: 'showSocials', label: 'Afișează social media', hint: 'Linkurile tale apar pe profilul public' },
  { key: 'showContact', label: 'Afișează contact', hint: 'Telefonul și emailul devin publice' },
  { key: 'showApptCount', label: 'Afișează numărul de programări', hint: 'Programările finalizate apar ca insignă' },
  { key: 'showGallery', label: 'Afișează galeria', hint: 'Pozele tale apar pe profilul public' },
];

const SOCIAL_INPUTS: { key: 'instagram' | 'facebook' | 'tiktok' | 'website'; label: string; placeholder: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'instagram', label: 'Instagram', placeholder: '@numele.tau', icon: 'logo-instagram' },
  { key: 'facebook', label: 'Facebook', placeholder: 'numele.tau', icon: 'logo-facebook' },
  { key: 'tiktok', label: 'TikTok', placeholder: '@numele.tau', icon: 'logo-tiktok' },
  { key: 'website', label: 'Website', placeholder: 'https://site-ul-tau.ro', icon: 'globe-outline' },
];

/**
 * Staff self-service public profile editor: identity, contact, socials,
 * public visibility toggles and gallery management, plus preview (the exact
 * client view, via the public professionals API) and share (deep link).
 * Scope: a STAFF session editing THEIR OWN profile.
 */
export default function StaffProfileScreen() {
  const session = useAuthStore((s) => s.staffSession);
  const { width: windowWidth } = useWindowDimensions();

  const salonId = session?.salon.id ?? '';
  const staffId = session?.staff.id ?? '';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state (contextual save → PATCH profile)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [bio, setBio] = useState('');
  const [emoji, setEmoji] = useState('👤');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [socials, setSocials] = useState({ instagram: '', facebook: '', tiktok: '', website: '' });
  const [visibility, setVisibility] = useState<StaffVisibilitySettings>(DEFAULT_STAFF_VISIBILITY);

  // Gallery state (saves instantly, independent of the form)
  const [categories, setCategories] = useState<StaffPhotoCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const previewSheetRef = useRef<DraggableSheetRef>(null);

  const applyProfile = useCallback((profile: EditableStaffProfile) => {
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
    setSpecialty(profile.specialty);
    setBio(profile.bio);
    setEmoji(profile.avatarEmoji || '👤');
    setAvatarUrl(profile.avatarUrl);
    setPhone(profile.phone);
    setEmail(profile.email);
    setSocials(profile.socials);
    setVisibility(profile.publicSettings);
  }, []);

  const load = useCallback(() => {
    if (!salonId || !staffId) {
      setLoading(false);
      setLoadError(true);
      return;
    }
    setLoading(true);
    setLoadError(false);
    Promise.all([
      professionalsApi.getEditableProfile(salonId, staffId),
      listPhotoCategories(salonId, staffId),
    ])
      .then(([profile, loadedCategories]) => {
        applyProfile(profile);
        setCategories(loadedCategories);
        setSelectedCategoryId((current) => current ?? loadedCategories[0]?.id ?? null);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [salonId, staffId, applyProfile]);

  useEffect(() => { load(); }, [load]);

  // ── Save (identity + contact + socials + visibility) ────────────────────────

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Câmpuri obligatorii', 'Prenumele și numele sunt obligatorii.');
      return;
    }
    if (bio.length > BIO_MAX_LENGTH) {
      Alert.alert('Bio prea lung', `Descrierea poate avea cel mult ${BIO_MAX_LENGTH} de caractere.`);
      return;
    }
    setSaving(true);
    try {
      const updated = await professionalsApi.updateStaffProfile(salonId, staffId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        specialty: specialty.trim(),
        bio: bio.trim(),
        phone: phone.trim(),
        email: email.trim(),
        avatarEmoji: emoji,
        socials: {
          instagram: socials.instagram.trim(),
          facebook: socials.facebook.trim(),
          tiktok: socials.tiktok.trim(),
          website: socials.website.trim(),
        },
        publicSettings: visibility,
      });
      // Reflect server normalization (e.g. "@ana" → https://instagram.com/ana).
      applyProfile(updated);
      Alert.alert('Profil salvat', 'Modificările sunt acum vizibile pe profilul tău public.');
    } catch {
      Alert.alert('Eroare', 'Nu am putut salva profilul. Încearcă din nou.');
    } finally {
      setSaving(false);
    }
  };

  // ── Preview & share ──────────────────────────────────────────────────────────

  const handleShare = () => {
    const fullName = `${firstName} ${lastName}`.trim();
    const { message, url } = buildProfessionalShare(staffId, fullName);
    Share.share({ message, url }).catch(() => {});
  };

  // ── Gallery: categories ──────────────────────────────────────────────────────

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setCreatingCategory(true);
    try {
      const created = await createPhotoCategory(salonId, staffId, name);
      setCategories((prev) => [...prev, { ...created, photos: created.photos ?? [] }]);
      setSelectedCategoryId(created.id);
      setNewCategoryName('');
      setIsAddingCategory(false);
    } catch {
      Alert.alert('Eroare', 'Nu am putut crea categoria. Încearcă din nou.');
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleDeleteCategory = (category: StaffPhotoCategory) => {
    Alert.alert(
      'Șterge categoria',
      `Sigur ștergi categoria „${category.name}”? Pozele ei nu vor mai fi afișate pe profil.`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePhotoCategory(salonId, staffId, category.id);
              const remaining = categories.filter((c) => c.id !== category.id);
              setCategories(remaining);
              setSelectedCategoryId((current) =>
                current === category.id ? (remaining[0]?.id ?? null) : current,
              );
            } catch {
              Alert.alert('Eroare', 'Nu am putut șterge categoria.');
            }
          },
        },
      ],
    );
  };

  // ── Gallery: photos ──────────────────────────────────────────────────────────

  const handleAddPhoto = async () => {
    if (!selectedCategoryId) {
      Alert.alert('Alege o categorie', 'Creează sau selectează întâi o categorie pentru poze.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permisiune necesară', 'Permite accesul la poze pentru a încărca în galerie.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
    });
    if (result.canceled) return;

    setUploadingPhoto(true);
    try {
      const uploaded = await uploadStaffPhoto(salonId, staffId, result.assets[0], {
        categoryId: selectedCategoryId,
      });
      setCategories((prev) =>
        prev.map((c) =>
          c.id === selectedCategoryId ? { ...c, photos: [...c.photos, uploaded] } : c,
        ),
      );
    } catch (err) {
      // validateImage / upload errors carry user-facing Romanian messages.
      const message = err instanceof Error && err.message
        ? err.message
        : 'Nu am putut încărca poza. Încearcă din nou.';
      Alert.alert('Încărcare eșuată', message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = (photoId: string) => {
    Alert.alert('Șterge poza', 'Sigur ștergi această poză din galerie?', [
      { text: 'Anulează', style: 'cancel' },
      {
        text: 'Șterge',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteStaffPhoto(salonId, staffId, photoId);
            setCategories((prev) =>
              prev.map((c) => ({ ...c, photos: c.photos.filter((p) => p.id !== photoId) })),
            );
          } catch {
            Alert.alert('Eroare', 'Nu am putut șterge poza.');
          }
        },
      },
    ]);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!session) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <SettingsHeader title="Profilul meu" />
        <View style={styles.centerFill}>
          <Text style={styles.errorTitle}>Disponibil doar pentru conturile de staff.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? null;
  // Grid width: window − section margins − card padding − inter-tile gaps.
  const photoSize =
    (windowWidth - Spacing.lg * 2 - Spacing.md * 2 - GRID_GAP * (GRID_COLUMNS - 1)) /
    GRID_COLUMNS;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SettingsHeader title="Profilul meu" />

      {loading ? (
        <View style={styles.centerFill}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : loadError ? (
        <View style={styles.centerFill}>
          <Ionicons name="cloud-offline-outline" size={44} color={Colors.gray300} />
          <Text style={styles.errorTitle}>Nu am putut încărca profilul</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Încearcă din nou</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 140 }}
        >
          {/* Preview + share */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionBtn}
              activeOpacity={0.8}
              onPress={() => previewSheetRef.current?.present()}
            >
              <Ionicons name="eye-outline" size={17} color={Colors.primary} />
              <Text style={styles.actionText}>Previzualizează</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8} onPress={handleShare}>
              <Ionicons name="share-outline" size={17} color={Colors.primary} />
              <Text style={styles.actionText}>Distribuie profilul</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.actionsHint}>
            Previzualizarea arată exact ce văd clienții — datele salvate.
          </Text>

          {/* Identitate */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Identitate</Text>
            <View style={styles.card}>
              <Text style={styles.label}>Avatar</Text>
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
              {!!avatarUrl && (
                <Text style={styles.fieldHint}>
                  Ai o poză de profil setată — emoji-ul apare doar când poza lipsește.
                </Text>
              )}

              <Text style={styles.label}>Prenume *</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Elena"
                placeholderTextColor={Colors.gray300}
                autoCapitalize="words"
              />

              <Text style={styles.label}>Nume *</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Ionescu"
                placeholderTextColor={Colors.gray300}
                autoCapitalize="words"
              />

              <Text style={styles.label}>Specializare</Text>
              <TextInput
                style={styles.input}
                value={specialty}
                onChangeText={setSpecialty}
                placeholder="Hair Stylist Senior"
                placeholderTextColor={Colors.gray300}
                autoCapitalize="words"
                maxLength={60}
              />

              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={bio}
                onChangeText={setBio}
                placeholder="Povestește clienților despre tine și stilul tău…"
                placeholderTextColor={Colors.gray300}
                multiline
                maxLength={BIO_MAX_LENGTH}
              />
              <Text style={styles.charCount}>{bio.length}/{BIO_MAX_LENGTH}</Text>
            </View>
          </View>

          {/* Contact */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact</Text>
            <View style={styles.card}>
              <Text style={styles.label}>Telefon</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="07xx xxx xxx"
                placeholderTextColor={Colors.gray300}
                keyboardType="phone-pad"
              />
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="nume@exemplu.ro"
                placeholderTextColor={Colors.gray300}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.fieldHint}>
                Contactul apare public doar dacă activezi „Afișează contact” mai jos.
              </Text>
            </View>
          </View>

          {/* Social media */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Social media</Text>
            <View style={styles.card}>
              {SOCIAL_INPUTS.map(({ key, label, placeholder, icon }) => (
                <View key={key}>
                  <Text style={styles.label}>{label}</Text>
                  <View style={styles.socialInputRow}>
                    <Ionicons name={icon} size={18} color={Colors.gray500} />
                    <TextInput
                      style={styles.socialInput}
                      value={socials[key]}
                      onChangeText={(value) => setSocials((prev) => ({ ...prev, [key]: value }))}
                      placeholder={placeholder}
                      placeholderTextColor={Colors.gray300}
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={200}
                    />
                  </View>
                </View>
              ))}
              <Text style={styles.fieldHint}>
                Poți scrie doar numele de utilizator (ex. @elena) — îl transformăm noi în link.
              </Text>
            </View>
          </View>

          {/* Vizibilitate publică */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vizibilitate publică</Text>
            <View style={styles.card}>
              {VISIBILITY_ROWS.map(({ key, label, hint }, index) => (
                <View
                  key={key}
                  style={[styles.switchRow, index > 0 && styles.switchRowBorder]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchLabel}>{label}</Text>
                    <Text style={styles.switchHint}>{hint}</Text>
                  </View>
                  <Switch
                    value={visibility[key]}
                    onValueChange={(value) =>
                      setVisibility((prev) => ({ ...prev, [key]: value }))
                    }
                    trackColor={{ true: Colors.primary, false: Colors.gray300 }}
                    thumbColor={Colors.white}
                  />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.saveWrap}>
            <Button title="Salvează profilul" fullWidth loading={saving} onPress={handleSave} />
          </View>

          {/* Galerie — saves instantly */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Galerie</Text>
            <View style={styles.card}>
              {/* Category chips */}
              <View style={styles.chipsRow}>
                {categories.map((category) => {
                  const isSelected = category.id === selectedCategoryId;
                  return (
                    <TouchableOpacity
                      key={category.id}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      activeOpacity={0.8}
                      onPress={() => setSelectedCategoryId(category.id)}
                      onLongPress={() => handleDeleteCategory(category)}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[styles.chip, styles.chipAdd]}
                  activeOpacity={0.8}
                  onPress={() => setIsAddingCategory((prev) => !prev)}
                >
                  <Ionicons name="add" size={15} color={Colors.primary} />
                  <Text style={styles.chipAddText}>Categorie</Text>
                </TouchableOpacity>
              </View>
              {categories.length > 0 && (
                <Text style={styles.fieldHint}>Ține apăsat pe o categorie pentru a o șterge.</Text>
              )}

              {/* Inline add-category input */}
              {isAddingCategory && (
                <View style={styles.addCategoryRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginTop: 0 }]}
                    value={newCategoryName}
                    onChangeText={setNewCategoryName}
                    placeholder="ex. Balayage"
                    placeholderTextColor={Colors.gray300}
                    autoFocus
                    maxLength={60}
                  />
                  <TouchableOpacity
                    style={styles.addCategoryBtn}
                    onPress={handleCreateCategory}
                    disabled={creatingCategory || !newCategoryName.trim()}
                  >
                    {creatingCategory ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <Text style={styles.addCategoryBtnText}>Adaugă</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Photo grid for the selected category */}
              {categories.length === 0 ? (
                <Text style={styles.emptyGalleryText}>
                  Creează o categorie (ex. „Tunsori”, „Balayage”) și adaugă poze cu lucrările tale.
                </Text>
              ) : (
                <View style={styles.photoGrid}>
                  {(selectedCategory?.photos ?? []).map((photo) => (
                    <TouchableOpacity
                      key={photo.id}
                      activeOpacity={0.85}
                      onPress={() => handleDeletePhoto(photo.id)}
                    >
                      <Image
                        source={{ uri: photo.url }}
                        style={[styles.photo, { width: photoSize, height: photoSize }]}
                      />
                      <View style={styles.photoDeleteBadge}>
                        <Ionicons name="trash-outline" size={12} color={Colors.white} />
                      </View>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.addPhotoTile, { width: photoSize, height: photoSize }]}
                    activeOpacity={0.8}
                    onPress={handleAddPhoto}
                    disabled={uploadingPhoto}
                  >
                    {uploadingPhoto ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <>
                        <Ionicons name="add" size={22} color={Colors.primary} />
                        <Text style={styles.addPhotoText}>Adaugă</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      )}

      {/* Preview — the PUBLIC profile, exactly as clients see it */}
      <DraggableSheet ref={previewSheetRef} snapPoints={['90%']} scrollable>
        <View style={styles.previewBody}>
          <ProfessionalProfileContent professionalId={staffId} />
        </View>
      </DraggableSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg },
  errorTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.gray700, textAlign: 'center' },
  retryBtn: {
    marginTop: 4, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: Radius.full, backgroundColor: Colors.primaryLight,
  },
  retryText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  actionsRow: {
    flexDirection: 'row', gap: Spacing.sm,
    marginHorizontal: Spacing.lg, marginTop: Spacing.md,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.white,
  },
  actionText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.primary },
  actionsHint: {
    fontSize: FontSize.xs, color: Colors.gray500,
    marginHorizontal: Spacing.lg, marginTop: 8,
  },

  section: { marginHorizontal: Spacing.lg, marginTop: Spacing.xl },
  sectionTitle: {
    fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.primary,
    marginBottom: 12, marginLeft: 2,
  },
  card: {
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing.md, ...Shadow.md,
  },

  label: {
    fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.gray700,
    marginTop: Spacing.md,
  },
  input: {
    marginTop: 8, paddingHorizontal: Spacing.md, paddingVertical: 11,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.gray50, fontSize: FontSize.md, color: Colors.ink,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  charCount: { alignSelf: 'flex-end', marginTop: 4, fontSize: FontSize.xs, color: Colors.gray400 },
  fieldHint: { fontSize: FontSize.xs, color: Colors.gray500, marginTop: 10, lineHeight: 16 },

  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  emojiBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.gray50, borderWidth: 2, borderColor: 'transparent',
  },
  emojiBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  emojiText: { fontSize: 22 },

  socialInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginTop: 8, paddingHorizontal: Spacing.md,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.gray50,
  },
  socialInput: { flex: 1, paddingVertical: 11, fontSize: FontSize.md, color: Colors.ink },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: 13,
  },
  switchRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  switchLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink },
  switchHint: { fontSize: FontSize.xs, color: Colors.gray500, marginTop: 2 },

  saveWrap: { marginHorizontal: Spacing.lg, marginTop: Spacing.xl },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
    backgroundColor: Colors.gray50, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.gray700, fontWeight: FontWeight.medium },
  chipTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
  chipAdd: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderStyle: 'dashed', borderColor: Colors.primary, backgroundColor: Colors.white,
  },
  chipAddText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },

  addCategoryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md },
  addCategoryBtn: {
    paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: Radius.md, backgroundColor: Colors.primary,
  },
  addCategoryBtnText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  emptyGalleryText: { fontSize: FontSize.sm, color: Colors.gray500, marginTop: Spacing.md, lineHeight: 20 },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, marginTop: Spacing.md },
  photo: { borderRadius: Radius.md, backgroundColor: Colors.gray100 },
  photoDeleteBadge: {
    position: 'absolute', top: 6, right: 6,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(20,20,20,0.55)',
  },
  addPhotoTile: {
    borderRadius: Radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: Colors.white,
  },
  addPhotoText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },

  previewBody: { paddingBottom: 48 },
});
