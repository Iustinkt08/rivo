import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image,
  ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, FontSize, FontWeight, Radius, Shadow, Spacing } from '../../theme';
import { useBusinessStore, GalleryPhoto } from '../../store/businessStore';
import { businessApi } from '../../services/api/business';
import { salonSettingsApi } from '../../services/api/salonSettings';
import { uploadSalonGalleryPhoto, uploadSalonLogo } from '../../services/storage';
import SettingsHeader from '../../components/business/SettingsHeader';

const MAX_GALLERY_PHOTOS = 9;
const LOCAL_ID_PREFIX = 'local-';

const isLocalPhoto = (p: GalleryPhoto) => p.id.startsWith(LOCAL_ID_PREFIX);
const isRemoteUri = (uri: string) => uri.startsWith('http');

/**
 * Logo & gallery editor. Changes are staged locally and persisted to the
 * backend only via the contextual "Salvează" button: the logo is uploaded to
 * storage then PATCHed on the salon; gallery additions/removals go through
 * the photos API.
 */
export default function SalonMediaScreen() {
  const { salonProfile, setSalonProfile } = useBusinessStore();

  const [logoUri, setLogoUri] = useState<string | null>(salonProfile?.logoUrl ?? null);
  const [logoDirty, setLogoDirty] = useState(false);
  const [gallery, setGallery] = useState<GalleryPhoto[]>(salonProfile?.galleryPhotos ?? []);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!salonProfile) {
      businessApi.getSalonProfile()
        .then((p) => {
          setSalonProfile(p);
          setLogoUri(p.logoUrl ?? null);
          setGallery(p.galleryPhotos ?? []);
        })
        .catch(() => {
          Alert.alert('Eroare', 'Nu am putut încărca salonul tău.');
        });
    }
  }, []);

  const hasNewPhotos = gallery.some(isLocalPhoto);
  const isDirty = logoDirty || hasNewPhotos || removedPhotoIds.length > 0;

  // ── Pickers (staged only — nothing persists until "Salvează") ──────────────

  const requestGalleryPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permisiune necesară', 'Activează accesul la galerie din Setări.');
      return false;
    }
    return true;
  };

  const pickLogo = async () => {
    if (!(await requestGalleryPermission())) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    setLogoUri(result.assets[0].uri);
    setLogoDirty(true);
  };

  const removeLogo = () => {
    setLogoUri(null);
    setLogoDirty(true);
  };

  const addGalleryPhotos = async () => {
    if (!(await requestGalleryPermission())) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      selectionLimit: MAX_GALLERY_PHOTOS - gallery.length,
      quality: 0.8,
    });
    if (result.canceled) return;
    const newPhotos: GalleryPhoto[] = result.assets.map((a, i) => ({
      id: `${LOCAL_ID_PREFIX}${Date.now()}-${i}`,
      url: a.uri,
      caption: null,
    }));
    setGallery((prev) => [...prev, ...newPhotos]);
  };

  const removePhoto = (photo: GalleryPhoto) => {
    Alert.alert('Șterge poza', 'Ești sigur că vrei să ștergi această poză?', [
      { text: 'Anulează', style: 'cancel' },
      {
        text: 'Șterge', style: 'destructive',
        onPress: () => {
          setGallery((prev) => prev.filter((p) => p.id !== photo.id));
          if (!isLocalPhoto(photo)) {
            setRemovedPhotoIds((prev) => [...prev, photo.id]);
          }
        },
      },
    ]);
  };

  // ── Contextual save — persists everything to the backend ───────────────────

  const handleSave = async () => {
    const id = salonProfile?.id;
    if (!id) {
      Alert.alert('Niciun salon', 'Nu am găsit salonul tău. Reîncarcă pagina și încearcă din nou.');
      return;
    }
    setSaving(true);
    try {
      // 1. Logo: upload local picks to storage, then PATCH the salon.
      let persistedLogo: string | null = salonProfile.logoUrl ?? null;
      if (logoDirty) {
        const remoteLogo = logoUri && !isRemoteUri(logoUri)
          ? await uploadSalonLogo(id, logoUri)
          : logoUri;
        persistedLogo = (await salonSettingsApi.updateSalonLogo(id, remoteLogo)) ?? null;
        setLogoUri(persistedLogo);
      }

      // 2. Gallery removals.
      for (const photoId of removedPhotoIds) {
        await businessApi.deleteGalleryPhoto(id, photoId);
      }

      // 3. Gallery additions: upload then register each photo.
      const persistedGallery: GalleryPhoto[] = [];
      for (const photo of gallery) {
        if (!isLocalPhoto(photo)) {
          persistedGallery.push(photo);
          continue;
        }
        const url = await uploadSalonGalleryPhoto(id, photo.url);
        const created = await businessApi.addGalleryPhoto(id, url);
        persistedGallery.push(created);
      }

      setGallery(persistedGallery);
      setRemovedPhotoIds([]);
      setLogoDirty(false);
      setSalonProfile({
        ...salonProfile,
        logoUrl: persistedLogo,
        galleryPhotos: persistedGallery,
      });
      Alert.alert('Salvat', 'Logo-ul și galeria au fost actualizate.');
    } catch {
      Alert.alert('Eroare', 'Nu s-au putut salva modificările. Verifică conexiunea și încearcă din nou.');
    } finally {
      setSaving(false);
    }
  };

  const logoName = salonProfile?.name ?? '';
  const logoInitials = logoName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SettingsHeader title="Logo & Galerie" />

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Logo section ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Logo salon</Text>
          <View style={styles.logoCard}>
            {/* Current logo */}
            <View style={styles.logoPreviewWrap}>
              {logoUri ? (
                <Image source={{ uri: logoUri }} style={styles.logoImage} />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Text style={styles.logoInitials}>{logoInitials || '?'}</Text>
                </View>
              )}
            </View>

            <View style={styles.logoInfo}>
              <Text style={styles.logoInfoTitle}>
                {logoUri ? 'Logo setat' : 'Niciun logo setat'}
              </Text>
              <Text style={styles.logoInfoSub}>
                Recomandare: imagine pătrată, min 400×400px
              </Text>
            </View>

            <TouchableOpacity style={styles.changeLogoBtn} onPress={pickLogo} disabled={saving}>
              <Ionicons name="image-outline" size={16} color={Colors.primary} />
              <Text style={styles.changeLogoBtnText}>Schimbă</Text>
            </TouchableOpacity>
          </View>

          {logoUri && (
            <TouchableOpacity style={styles.removeLogoBtn} onPress={removeLogo} disabled={saving}>
              <Ionicons name="trash-outline" size={14} color={Colors.error} />
              <Text style={styles.removeLogoBtnText}>Elimină logoul</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Gallery section ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.galleryHeader}>
            <Text style={styles.sectionTitle}>Galerie foto</Text>
            <Text style={styles.galleryCount}>{gallery.length}/{MAX_GALLERY_PHOTOS}</Text>
          </View>
          <Text style={styles.gallerySubtitle}>
            Clienții văd aceste poze pe profilul public al salonului.
          </Text>

          <View style={styles.grid}>
            {gallery.map((photo) => (
              <View key={photo.id} style={styles.gridItem}>
                <Image source={{ uri: photo.url }} style={styles.gridImage} />
                {isLocalPhoto(photo) && (
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>Nou</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.gridRemoveBtn}
                  onPress={() => removePhoto(photo)}
                  disabled={saving}
                >
                  <Ionicons name="close-circle" size={22} color={Colors.white} />
                </TouchableOpacity>
              </View>
            ))}

            {gallery.length < MAX_GALLERY_PHOTOS && (
              <TouchableOpacity style={styles.gridAddBtn} onPress={addGalleryPhotos} disabled={saving}>
                <View style={{ alignItems: 'center' }}>
                  <Ionicons name="add" size={28} color={Colors.primary} />
                  <Text style={styles.gridAddText}>Adaugă</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {gallery.length === 0 && (
            <View style={styles.emptyGallery}>
              <Ionicons name="images-outline" size={40} color={Colors.gray300} />
              <Text style={styles.emptyText}>Nicio poză adăugată încă</Text>
              <Text style={styles.emptySubtext}>Adaugă poze pentru a atrage mai mulți clienți</Text>
            </View>
          )}
        </View>

        {/* ── Contextual save — persists logo + gallery via API ─────────────── */}
        <View style={styles.saveSection}>
          <TouchableOpacity
            style={[styles.saveBtn, (saving || !isDirty) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving || !isDirty}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color={Colors.white} />
              : <>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.white} />
                  <Text style={styles.saveBtnText}>Salvează</Text>
                </>
            }
          </TouchableOpacity>
          {isDirty && !saving && (
            <Text style={styles.dirtyHint}>Ai modificări nesalvate</Text>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const ITEM_SIZE = '30%';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  section: { padding: Spacing.lg, paddingBottom: 0 },
  sectionTitle: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.gray500,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },

  // Logo
  logoCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md,
    ...Shadow.sm,
  },
  logoPreviewWrap: {
    width: 72, height: 72, borderRadius: 36, overflow: 'hidden',
    backgroundColor: Colors.gray100,
  },
  logoImage: { width: 72, height: 72 },
  logoPlaceholder: {
    width: 72, height: 72, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  logoInitials: { fontSize: FontSize.xl, fontWeight: FontWeight.heavy, color: Colors.primary },
  logoInfo: { flex: 1 },
  logoInfoTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.black },
  logoInfoSub: { fontSize: FontSize.xs, color: Colors.gray400, marginTop: 3, lineHeight: 16 },
  changeLogoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  changeLogoBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
  removeLogoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: Spacing.sm, alignSelf: 'flex-start',
  },
  removeLogoBtnText: { fontSize: FontSize.xs, color: Colors.error },

  // Gallery
  galleryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 },
  galleryCount: { fontSize: FontSize.sm, color: Colors.gray400, fontWeight: FontWeight.semibold },
  gallerySubtitle: { fontSize: FontSize.xs, color: Colors.gray400, marginBottom: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridItem: { width: ITEM_SIZE, aspectRatio: 1, borderRadius: Radius.md, overflow: 'hidden', position: 'relative' },
  gridImage: { width: '100%', height: '100%' },
  gridRemoveBtn: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 11,
  },
  newBadge: {
    position: 'absolute', bottom: 4, left: 4,
    backgroundColor: Colors.primary, borderRadius: Radius.sm,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  newBadgeText: { color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold },
  gridAddBtn: {
    width: ITEM_SIZE, aspectRatio: 1, borderRadius: Radius.md,
    borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed',
    backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  gridAddText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  emptyGallery: {
    alignItems: 'center', paddingVertical: Spacing.xl,
    backgroundColor: Colors.white, borderRadius: Radius.lg, ...Shadow.sm,
    marginTop: Spacing.sm,
  },
  emptyText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.gray400, marginTop: Spacing.sm },
  emptySubtext: { fontSize: FontSize.xs, color: Colors.gray300, marginTop: 4, textAlign: 'center' },

  // Contextual save
  saveSection: { paddingHorizontal: Spacing.lg, marginTop: Spacing.lg },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 15,
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  dirtyHint: { textAlign: 'center', fontSize: FontSize.xs, color: Colors.gray500, marginTop: 8 },
});
