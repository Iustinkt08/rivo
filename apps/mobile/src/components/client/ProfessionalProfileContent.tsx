import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Colors,
  FontSize,
  FontWeight,
  Gradients,
  Radius,
  Spacing,
} from '../../theme';
import {
  professionalsApi,
  ProfessionalProfile,
  ProfessionalGalleryCategory,
} from '../../services/api/professionals';
import { ProfessionalSocialKey } from '../../utils/professionalMapping';

// NAVIRA visual language (mirrors HomeScreen / SalonDetailScreen)
const H_PAD = 28;
const MUTED = 'rgba(34,34,34,0.65)';
const SUBTLE_BORDER = 'rgba(216,216,216,0.8)';
// Gallery carousel photos: landscape-ish 4:3 crop.
const GALLERY_PHOTO_ASPECT = 0.72;
const GALLERY_ITEM_GAP = 10;

const SOCIAL_ICONS: Record<
  ProfessionalSocialKey,
  keyof typeof Ionicons.glyphMap
> = {
  instagram: 'logo-instagram',
  facebook: 'logo-facebook',
  tiktok: 'logo-tiktok',
  website: 'globe-outline',
};

function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-outline'}
          size={size}
          color={Colors.star}
        />
      ))}
    </View>
  );
}

/** One horizontal, snap-paged photo carousel for a gallery category. */
function GalleryCarousel({
  category,
  itemWidth,
  onPhotoPress,
}: {
  category: ProfessionalGalleryCategory;
  itemWidth: number;
  onPhotoPress: (url: string) => void;
}) {
  if (category.photos.length === 0) return null;
  return (
    <View style={{ marginTop: Spacing.sm }}>
      {!!category.name && <Text style={styles.galleryCategoryName}>{category.name}</Text>}
      <FlatList
        data={category.photos}
        keyExtractor={(photo) => photo.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={itemWidth + GALLERY_ITEM_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: H_PAD }}
        ItemSeparatorComponent={() => <View style={{ width: GALLERY_ITEM_GAP }} />}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.9} onPress={() => onPhotoPress(item.url)}>
            <Image
              source={{ uri: item.url }}
              style={[styles.galleryPhoto, { width: itemWidth, height: itemWidth * GALLERY_PHOTO_ASPECT }]}
            />
            {!!item.caption && (
              <Text style={[styles.galleryCaption, { width: itemWidth }]} numberOfLines={1}>
                {item.caption}
              </Text>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

export interface ProfessionalProfileContentProps {
  professionalId: string;
  /** Fires once the public profile has loaded (e.g. for a booking CTA). */
  onProfileLoaded?: (profile: ProfessionalProfile) => void;
  /** Tap handler for the salon row; omit to render it non-navigable. */
  onOpenSalon?: (salonId: string) => void;
}

/**
 * The PUBLIC professional profile body — everything between the screen header
 * and the booking CTA. Renders as a plain (non-scrolling) view so it works
 * inside the client screen's ScrollView AND inside the business preview sheet
 * (BottomSheetScrollView). Always fetches through the public professionals
 * API, so the business "preview" shows exactly what clients see: fields the
 * professional hid (contact, socials, count, gallery) never arrive at all —
 * the server filters them.
 */
export default function ProfessionalProfileContent({
  professionalId,
  onProfileLoaded,
  onOpenSalon,
}: ProfessionalProfileContentProps) {
  const { width: windowWidth } = useWindowDimensions();
  const galleryItemWidth = windowWidth - H_PAD * 2;

  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!professionalId) {
      setLoading(false);
      setLoadError(true);
      return;
    }
    setLoading(true);
    setLoadError(false);
    professionalsApi.getProfile(professionalId)
      .then((loaded) => {
        setProfile(loaded);
        onProfileLoaded?.(loaded);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
    // Deliberately keyed on the id only — a re-created callback must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professionalId]);

  useEffect(() => { load(); }, [load]);

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  if (loading) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (loadError || !profile) {
    return (
      <View style={styles.centerFill}>
        <Ionicons name="cloud-offline-outline" size={44} color={Colors.gray300} />
        <Text style={styles.errorTitle}>Nu am putut încărca profilul</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>Încearcă din nou</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const initials = profile.fullName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const socialEntries = Object.entries(profile.socials ?? {}) as [
    ProfessionalSocialKey,
    string,
  ][];
  const galleryCategories = profile.galleryCategories.filter(
    (category) => category.photos.length > 0,
  );

  return (
    <View>
      {/* Identity */}
      <View style={styles.identity}>
        {profile.avatarUrl ? (
          <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
        ) : (
          <LinearGradient
            colors={Gradients.brand}
            start={Gradients.start}
            end={Gradients.end}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>
              {profile.avatarEmoji || initials || '👤'}
            </Text>
          </LinearGradient>
        )}
        <Text style={styles.name}>{profile.fullName}</Text>
        {!!profile.specialty && <Text style={styles.specialty}>{profile.specialty}</Text>}

        <View style={styles.ratingRow}>
          <Ionicons name="star" size={15} color={Colors.star} />
          <Text style={styles.ratingStrong}>
            {profile.reviewCount > 0 ? profile.averageRating.toFixed(1).replace('.', ',') : '—'}
          </Text>
          <Text style={styles.ratingMuted}>({profile.reviewCount} recenzii)</Text>
        </View>

        {/* Appointment count — server sends it only when the pro opted in */}
        {profile.completedAppointmentsCount !== null && (
          <View style={styles.apptBadge}>
            <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
            <Text style={styles.apptBadgeText}>
              {profile.completedAppointmentsCount} programări finalizate
            </Text>
          </View>
        )}
      </View>

      {/* Salon link */}
      {profile.salon && (
        <TouchableOpacity
          style={styles.salonRow}
          activeOpacity={0.8}
          disabled={!onOpenSalon}
          onPress={() => onOpenSalon?.(profile.salon!.id)}
        >
          <View style={styles.salonIcon}>
            <Ionicons name="storefront-outline" size={18} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.salonName} numberOfLines={1}>{profile.salon.name}</Text>
            {!!profile.salon.city && <Text style={styles.salonCity}>{profile.salon.city}</Text>}
          </View>
          {!!onOpenSalon && <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />}
        </TouchableOpacity>
      )}

      {/* Contact — present only when the professional shows it */}
      {!!profile.phone && (
        <TouchableOpacity
          style={styles.contactRow}
          activeOpacity={0.8}
          onPress={() => openLink(`tel:${profile.phone}`)}
        >
          <Ionicons name="call-outline" size={16} color={Colors.primary} />
          <Text style={styles.contactText}>{profile.phone}</Text>
        </TouchableOpacity>
      )}
      {!!profile.email && (
        <TouchableOpacity
          style={styles.contactRow}
          activeOpacity={0.8}
          onPress={() => openLink(`mailto:${profile.email}`)}
        >
          <Ionicons name="mail-outline" size={16} color={Colors.primary} />
          <Text style={styles.contactText}>{profile.email}</Text>
        </TouchableOpacity>
      )}

      {/* Bio */}
      {!!profile.bio && (
        <>
          <Text style={styles.sectionTitle}>Despre</Text>
          <Text style={styles.bio}>{profile.bio}</Text>
        </>
      )}

      {/* Socials — server sends them only when the pro shows them */}
      {socialEntries.length > 0 && (
        <View style={styles.socialsRow}>
          {socialEntries.map(([key, url]) => (
            <TouchableOpacity
              key={key}
              style={styles.socialBtn}
              activeOpacity={0.8}
              onPress={() => openLink(url)}
              accessibilityRole="link"
              accessibilityLabel={key}
            >
              <Ionicons name={SOCIAL_ICONS[key]} size={20} color={Colors.primary} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Gallery — categories as snap-paged photo carousels */}
      {galleryCategories.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Galerie</Text>
          {galleryCategories.map((category) => (
            <GalleryCarousel
              key={category.id}
              category={category}
              itemWidth={galleryItemWidth}
              onPhotoPress={setLightboxUrl}
            />
          ))}
        </>
      )}

      {/* Services */}
      <Text style={styles.sectionTitle}>Servicii</Text>
      {profile.services.length === 0 ? (
        <Text style={styles.emptyText}>Acest specialist nu are servicii active momentan.</Text>
      ) : (
        <View style={{ gap: Spacing.sm }}>
          {profile.services.map((s) => (
            <View key={s.id} style={styles.serviceRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.serviceName}>{s.name}</Text>
                <Text style={styles.serviceMeta}>{s.durationMin} min</Text>
              </View>
              <Text style={styles.servicePrice}>{s.price} RON</Text>
            </View>
          ))}
        </View>
      )}

      {/* Reviews */}
      <Text style={styles.sectionTitle}>Recenzii</Text>
      {profile.reviews.length === 0 ? (
        <Text style={styles.emptyText}>Nicio recenzie încă.</Text>
      ) : (
        <View style={{ gap: Spacing.sm }}>
          {profile.reviews.map((r) => (
            <View key={r.id} style={styles.reviewCard}>
              <View style={styles.reviewHead}>
                <Text style={styles.reviewClient}>{r.clientName}</Text>
                <Text style={styles.reviewDate}>{formatReviewDate(r.createdAt)}</Text>
              </View>
              <Stars rating={r.rating} />
              {!!r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
            </View>
          ))}
        </View>
      )}

      {/* Lightbox — tap anywhere to close */}
      <Modal
        visible={lightboxUrl !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxUrl(null)}
      >
        <Pressable style={styles.lightboxBackdrop} onPress={() => setLightboxUrl(null)}>
          {!!lightboxUrl && (
            <Image
              source={{ uri: lightboxUrl }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          )}
          <View style={styles.lightboxClose}>
            <Ionicons name="close" size={26} color={Colors.white} />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  centerFill: {
    alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    paddingHorizontal: H_PAD, paddingVertical: 80,
  },
  errorTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.gray700 },
  retryBtn: {
    marginTop: 4, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: Radius.full, backgroundColor: Colors.primaryLight,
  },
  retryText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  identity: { alignItems: 'center', paddingHorizontal: H_PAD, paddingTop: 8 },
  avatar: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.gray100,
  },
  avatarText: { fontSize: 38, color: Colors.white, fontWeight: FontWeight.bold },
  name: { fontSize: 24, fontWeight: FontWeight.heavy, color: Colors.ink, marginTop: 12, letterSpacing: -0.3 },
  specialty: { fontSize: FontSize.md, color: MUTED, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  ratingStrong: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.ink },
  ratingMuted: { fontSize: FontSize.sm, color: MUTED },

  apptBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.full, backgroundColor: Colors.primaryLight,
  },
  apptBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.primary },

  salonRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: H_PAD, marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderRadius: Radius.xl, borderWidth: 1, borderColor: SUBTLE_BORDER,
    backgroundColor: Colors.white,
  },
  salonIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  salonName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink },
  salonCity: { fontSize: FontSize.xs, color: MUTED, marginTop: 1 },

  contactRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: Spacing.sm, paddingVertical: 6,
  },
  contactText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },

  sectionTitle: {
    fontSize: 20, fontWeight: FontWeight.semibold, color: Colors.primary,
    marginTop: Spacing.lg, marginBottom: Spacing.sm, marginHorizontal: H_PAD,
  },
  bio: { fontSize: FontSize.md, color: Colors.gray700, lineHeight: 22, marginHorizontal: H_PAD },
  emptyText: { fontSize: FontSize.sm, color: Colors.gray500, marginHorizontal: H_PAD },

  socialsRow: {
    flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  socialBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
  },

  galleryCategoryName: {
    fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink,
    marginHorizontal: H_PAD, marginBottom: 8,
  },
  galleryPhoto: { borderRadius: Radius.lg, backgroundColor: Colors.gray100 },
  galleryCaption: { fontSize: FontSize.xs, color: MUTED, marginTop: 6 },

  serviceRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    marginHorizontal: H_PAD,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderRadius: Radius.xl, borderWidth: 1, borderColor: SUBTLE_BORDER,
    backgroundColor: Colors.white,
  },
  serviceName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink, marginBottom: 2 },
  serviceMeta: { fontSize: FontSize.xs, color: MUTED },
  servicePrice: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },

  reviewCard: {
    marginHorizontal: H_PAD,
    padding: Spacing.md, gap: 6,
    borderRadius: Radius.xl, borderWidth: 1, borderColor: SUBTLE_BORDER,
    backgroundColor: Colors.white,
  },
  reviewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewClient: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink },
  reviewDate: { fontSize: FontSize.xs, color: MUTED },
  reviewComment: { fontSize: FontSize.sm, color: Colors.gray700, lineHeight: 20 },

  lightboxBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  lightboxImage: { width: '100%', height: '80%' },
  lightboxClose: {
    position: 'absolute', top: 56, right: 20,
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});
