import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Dimensions, Image, Linking, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, FontWeight, Gradients, Radius, Shadow, Spacing } from '../../theme';
import { salonsApi, SalonReviewItem, SalonServiceItem, SalonStaffMember } from '../../services/api/salons';
import { SalonProfile } from '../../store/salonStore';
import { useFavoritesStore } from '../../store/favoritesStore';
import NoPhotoPlaceholder from '../../components/common/NoPhotoPlaceholder';

const { width: SCREEN_W } = Dimensions.get('window');
const COVER_H = 340;
// Compact reviews section: latest few, the rest live on each professional's profile.
const REVIEWS_SHOWN = 5;

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Luni', TUESDAY: 'Marți', WEDNESDAY: 'Miercuri', THURSDAY: 'Joi',
  FRIDAY: 'Vineri', SATURDAY: 'Sâmbătă', SUNDAY: 'Duminică',
};
const JS_DAY_TO_ENUM = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function useOpenNow(salon: SalonProfile | null) {
  if (!salon?.openingHours?.length) return null;
  const now = new Date();
  const today = salon.openingHours.find((h) => h.dayOfWeek === JS_DAY_TO_ENUM[now.getDay()]);
  if (!today || today.isClosed) return { open: false, label: 'Închis azi' };
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const open = hhmm >= today.openTime && hhmm < today.closeTime;
  return open
    ? { open: true, label: `Deschis · până la ${today.closeTime}` }
    : { open: false, label: `Închis · deschide la ${today.openTime}` };
}

export default function SalonDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const salonId = params.id as string;

  const { addFavorite, removeFavorite, isFavorite } = useFavoritesStore();

  const [salon, setSalon] = useState<SalonProfile | null>(null);
  const [services, setServices] = useState<SalonServiceItem[]>([]);
  const [staff, setStaff] = useState<SalonStaffMember[]>([]);
  const [reviews, setReviews] = useState<SalonReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedService, setSelectedService] = useState<SalonServiceItem | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<SalonStaffMember | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const profile = await salonsApi.getProfile(salonId);
        setSalon(profile);
        const [srv, stf] = await Promise.all([
          salonsApi.getServices(profile.id),
          salonsApi.getStaff(profile.id),
        ]);
        setServices(srv);
        setStaff(stf);
        // Reviews are supplementary — a failure here must not block the screen.
        salonsApi.getReviews(profile.id).then(setReviews).catch(() => {});
      } finally {
        setLoading(false);
      }
    })();
  }, [salonId]);

  const openNow = useOpenNow(salon);
  const favorite = salon ? isFavorite(salon.id) : false;

  const toggleFavorite = () => {
    if (!salon) return;
    if (favorite) removeFavorite(salon.id);
    else addFavorite(salon);
  };

  const openMaps = () => {
    if (!salon) return;
    const label = encodeURIComponent(salon.name);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${salon.latitude},${salon.longitude}`,
      default: `geo:0,0?q=${salon.latitude},${salon.longitude}(${label})`,
    });
    Linking.openURL(url).catch(() => {});
  };

  const handleBooking = () => {
    if (!salon || !selectedService) return;
    router.push({
      pathname: '/(client)/booking',
      params: {
        salonId: salon.id,
        salonName: salon.name,
        serviceId: selectedService.id,
        ...(selectedStaff ? { staffId: selectedStaff.id } : {}),
      },
    });
  };

  if (loading || !salon) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <TouchableOpacity
          style={[styles.glassBtn, styles.loadingBack, { top: insets.top + 8 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.ink} />
        </TouchableOpacity>
      </View>
    );
  }

  // Cover + gallery, deduplicated — swipeable slideshow
  const photos = (() => {
    const urls = [salon.coverImageUrl, ...(salon.gallery ?? []).map((g) => g.url)]
      .filter(Boolean) as string[];
    return [...new Set(urls)];
  })();
  const hasPhotos = photos.length > 0;
  const hasGallery = (salon.gallery?.length ?? 0) > 0;

  return (
    <View style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 200 }}>

        {/* Cover slideshow */}
        <View>
          {hasPhotos ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))
              }
            >
              {photos.map((url) => (
                <Image key={url} source={{ uri: url }} style={styles.cover} />
              ))}
            </ScrollView>
          ) : (
            <NoPhotoPlaceholder style={styles.cover} size={46} />
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.35)', 'transparent']}
            style={styles.coverFade}
            pointerEvents="none"
          />

          {hasPhotos && photos.length > 1 && (
            <>
              {/* Counter — glass pill */}
              <BlurView intensity={26} tint="dark" style={styles.photoCounter}>
                <Ionicons name="images-outline" size={12} color={Colors.white} />
                <Text style={styles.photoCounterText}>{photoIndex + 1}/{photos.length}</Text>
              </BlurView>

              {/* Dots */}
              <View style={styles.photoDots} pointerEvents="none">
                {photos.map((_, i) => (
                  <View key={i} style={[styles.photoDot, i === photoIndex && styles.photoDotActive]} />
                ))}
              </View>
            </>
          )}
        </View>

        {/* Content sheet */}
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Title */}
          <Text style={styles.name}>{salon.name}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="star" size={14} color={Colors.star} />
            <Text style={styles.metaStrong}>{salon.averageRating.toFixed(1)}</Text>
            <Text style={styles.metaText}>({salon.reviewCount} recenzii)</Text>
            {openNow && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <View style={[styles.statusDot, { backgroundColor: openNow.open ? Colors.success : Colors.error }]} />
                <Text style={[styles.metaText, { color: openNow.open ? Colors.success : Colors.error }]}>
                  {openNow.label}
                </Text>
              </>
            )}
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={Colors.gray500} />
            <Text style={styles.metaText} numberOfLines={1}>
              {salon.addressLine1}, {salon.city}
            </Text>
          </View>

          {/* Quick actions */}
          <View style={styles.actions}>
            {salon.phone && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openURL(`tel:${salon.phone}`)}>
                <View style={styles.actionIcon}><Ionicons name="call-outline" size={18} color={Colors.primary} /></View>
                <Text style={styles.actionLabel}>Sună</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.actionBtn} onPress={openMaps}>
              <View style={styles.actionIcon}><Ionicons name="navigate-outline" size={18} color={Colors.primary} /></View>
              <Text style={styles.actionLabel}>Hartă</Text>
            </TouchableOpacity>
            {salon.websiteUrl && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openURL(salon.websiteUrl!)}>
                <View style={styles.actionIcon}><Ionicons name="globe-outline" size={18} color={Colors.primary} /></View>
                <Text style={styles.actionLabel}>Website</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* About */}
          {salon.description ? (
            <>
              <Text style={styles.sectionTitle}>Despre salon</Text>
              <Text style={styles.description}>{salon.description}</Text>
            </>
          ) : null}

          {/* Gallery */}
          <Text style={styles.sectionTitle}>Galerie</Text>
          {hasGallery ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
              {salon.gallery.map((g) => (
                <Image key={g.id} source={{ uri: g.url }} style={styles.galleryImg} />
              ))}
            </ScrollView>
          ) : (
            <NoPhotoPlaceholder style={styles.galleryEmpty} rounded={Radius.lg} size={30} />
          )}

          {/* Services */}
          <Text style={styles.sectionTitle}>Servicii</Text>
          {services.length === 0 ? (
            <Text style={styles.emptyText}>Acest salon nu și-a adăugat încă serviciile.</Text>
          ) : (
            <View style={styles.servicesList}>
              {services.map((service) => {
                const active = selectedService?.id === service.id;
                return (
                  <TouchableOpacity
                    key={service.id}
                    style={[styles.serviceCard, active && styles.serviceCardActive]}
                    onPress={() => setSelectedService(active ? null : service)}
                    activeOpacity={0.85}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.serviceName, active && { color: Colors.primary }]}>
                        {service.name}
                      </Text>
                      <View style={styles.serviceMeta}>
                        <Ionicons name="time-outline" size={12} color={Colors.gray500} />
                        <Text style={styles.serviceDuration}>{service.durationMin} min</Text>
                      </View>
                    </View>
                    <Text style={styles.servicePrice}>
                      {Number(service.price)} {service.currency ?? 'RON'}
                    </Text>
                    <View style={[styles.serviceCheck, active && styles.serviceCheckActive]}>
                      {active && <Ionicons name="checkmark" size={13} color={Colors.white} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Staff */}
          {staff.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Echipa</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.staffRow}>
                {staff.map((member) => {
                  const active = selectedStaff?.id === member.id;
                  const initials = `${member.firstName?.[0] ?? ''}${member.lastName?.[0] ?? ''}`.toUpperCase();
                  return (
                    <TouchableOpacity
                      key={member.id}
                      style={styles.staffCard}
                      onPress={() => setSelectedStaff(active ? null : member)}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.staffAvatarRing, active && styles.staffAvatarRingActive]}>
                        {member.avatarUrl ? (
                          <Image source={{ uri: member.avatarUrl }} style={styles.staffAvatar} />
                        ) : (
                          <LinearGradient
                            colors={Gradients.brand}
                            start={Gradients.start}
                            end={Gradients.end}
                            style={styles.staffAvatar}
                          >
                            <Text style={styles.staffInitials}>{initials}</Text>
                          </LinearGradient>
                        )}
                      </View>
                      <Text style={[styles.staffName, active && { color: Colors.primary }]} numberOfLines={1}>
                        {member.firstName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

          {/* Reviews — aggregated across all of the salon's professionals */}
          <Text style={styles.sectionTitle}>Recenzii</Text>
          {reviews.length === 0 ? (
            <Text style={styles.emptyText}>Acest salon nu are încă recenzii.</Text>
          ) : (
            <View style={{ gap: Spacing.sm }}>
              {reviews.slice(0, REVIEWS_SHOWN).map((r) => (
                <View key={r.id} style={styles.reviewCard}>
                  <View style={styles.reviewHead}>
                    <Text style={styles.reviewClient}>{r.clientName}</Text>
                    <View style={styles.reviewStars}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Ionicons
                          key={i}
                          name={i <= Math.round(r.rating) ? 'star' : 'star-outline'}
                          size={12}
                          color={Colors.star}
                        />
                      ))}
                    </View>
                  </View>
                  {!!r.staffName && (
                    <Text style={styles.reviewStaff}>cu {r.staffName}</Text>
                  )}
                  {!!r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
                  {!!r.replyText && (
                    <View style={styles.reviewReply}>
                      <Text style={styles.reviewReplyLabel}>Răspunsul salonului</Text>
                      <Text style={styles.reviewComment}>{r.replyText}</Text>
                    </View>
                  )}
                </View>
              ))}
              {reviews.length > REVIEWS_SHOWN && (
                <Text style={styles.reviewMore}>
                  +{reviews.length - REVIEWS_SHOWN} recenzii pe profilurile specialiștilor
                </Text>
              )}
            </View>
          )}

          {/* Opening hours */}
          {salon.openingHours?.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Program</Text>
              <View style={styles.hoursCard}>
                {salon.openingHours.map((h) => {
                  const isToday = h.dayOfWeek === JS_DAY_TO_ENUM[new Date().getDay()];
                  return (
                    <View key={h.dayOfWeek} style={styles.hourRow}>
                      <Text style={[styles.hourDay, isToday && styles.hourToday]}>
                        {DAY_LABELS[h.dayOfWeek] ?? h.dayOfWeek}
                      </Text>
                      <Text style={[styles.hourTime, isToday && styles.hourToday]}>
                        {h.isClosed ? 'Închis' : `${h.openTime} – ${h.closeTime}`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Floating header buttons — glass */}
      <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <TouchableOpacity onPress={() => router.back()}>
          <BlurView intensity={28} tint="dark" style={styles.glassCircle}>
            <Ionicons name="chevron-back" size={21} color={Colors.white} />
          </BlurView>
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleFavorite}>
          <BlurView intensity={28} tint="dark" style={styles.glassCircle}>
            <Ionicons
              name={favorite ? 'heart' : 'heart-outline'}
              size={20}
              color={favorite ? Colors.coral : Colors.white}
            />
          </BlurView>
        </TouchableOpacity>
      </View>

      {/* Sticky booking bar — glass */}
      <BlurView intensity={50} tint="light" style={[styles.bookBar, { bottom: insets.bottom + 74, paddingBottom: 12 }]}>
        <View style={{ flex: 1 }}>
          {selectedService ? (
            <>
              <Text style={styles.bookService} numberOfLines={1}>{selectedService.name}</Text>
              <Text style={styles.bookPrice}>
                {Number(selectedService.price)} {selectedService.currency ?? 'RON'}
              </Text>
            </>
          ) : (
            <Text style={styles.bookHint}>Alege un serviciu{'\n'}pentru a continua</Text>
          )}
        </View>
        <TouchableOpacity
          activeOpacity={0.88}
          disabled={!selectedService}
          onPress={handleBooking}
          style={[styles.bookBtnWrap, !selectedService && { opacity: 0.45 }]}
        >
          <LinearGradient colors={Gradients.brand} start={Gradients.start} end={Gradients.end} style={styles.bookBtn}>
            <Text style={styles.bookBtnText}>Alege data</Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.white} />
          </LinearGradient>
        </TouchableOpacity>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },

  loadingWrap: { flex: 1, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  loadingBack: { position: 'absolute', left: Spacing.lg },
  glassBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.gray50, alignItems: 'center', justifyContent: 'center',
  },

  cover: { width: SCREEN_W, height: COVER_H, backgroundColor: Colors.gray100 },
  coverFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 110 },

  photoCounter: {
    position: 'absolute', right: Spacing.lg, bottom: 44,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: Radius.full, overflow: 'hidden',
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: 'rgba(20,20,20,0.3)',
  },
  photoCounterText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  photoDots: {
    position: 'absolute', left: 0, right: 0, bottom: 44,
    flexDirection: 'row', justifyContent: 'center', gap: 5,
  },
  photoDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  photoDotActive: { backgroundColor: Colors.white, width: 16 },

  topBar: {
    position: 'absolute', left: Spacing.lg, right: Spacing.lg,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  glassCircle: {
    width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(20,20,20,0.3)',
  },

  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    marginTop: -28,
    paddingHorizontal: Spacing.lg, paddingTop: 10,
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.gray100, marginBottom: Spacing.md,
  },

  name: { fontSize: 26, fontWeight: FontWeight.heavy, color: Colors.ink, letterSpacing: -0.4, marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  metaStrong: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.ink },
  metaText: { fontSize: FontSize.sm, color: Colors.gray500, flexShrink: 1 },
  metaDot: { color: Colors.gray300 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },

  actions: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.md, marginBottom: Spacing.sm },
  actionBtn: { alignItems: 'center', gap: 5 },
  actionIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: { fontSize: FontSize.xs, color: Colors.gray700, fontWeight: FontWeight.medium },

  sectionTitle: {
    fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.ink,
    marginTop: Spacing.lg, marginBottom: Spacing.sm,
  },
  description: { fontSize: FontSize.md, color: Colors.gray700, lineHeight: 22 },
  emptyText: { fontSize: FontSize.sm, color: Colors.gray500 },

  gallery: { gap: Spacing.sm },
  galleryImg: { width: 96, height: 96, borderRadius: Radius.lg, backgroundColor: Colors.gray100 },
  galleryEmpty: { height: 96, borderRadius: Radius.lg },

  servicesList: { gap: Spacing.sm },
  serviceCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: Spacing.md, paddingVertical: 13,
    ...Shadow.sm,
  },
  serviceCardActive: { borderColor: Colors.coral, backgroundColor: Colors.primaryLight },
  serviceName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink, marginBottom: 3 },
  serviceMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  serviceDuration: { fontSize: FontSize.xs, color: Colors.gray500 },
  servicePrice: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
  serviceCheck: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: Colors.gray300,
    alignItems: 'center', justifyContent: 'center',
  },
  serviceCheckActive: { backgroundColor: Colors.coral, borderColor: Colors.coral },

  staffRow: { gap: Spacing.md, paddingVertical: 4 },
  staffCard: { alignItems: 'center', width: 72 },
  staffAvatarRing: {
    padding: 3, borderRadius: 34, borderWidth: 2, borderColor: 'transparent', marginBottom: 6,
  },
  staffAvatarRingActive: { borderColor: Colors.coral },
  staffAvatar: {
    width: 58, height: 58, borderRadius: 29,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.gray100,
  },
  staffInitials: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  staffName: { fontSize: FontSize.xs, color: Colors.gray700, fontWeight: FontWeight.medium },

  reviewCard: {
    padding: Spacing.md, gap: 5,
    borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.06)',
    backgroundColor: Colors.white, ...Shadow.sm,
  },
  reviewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewClient: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink },
  reviewStars: { flexDirection: 'row', gap: 1 },
  reviewStaff: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.medium },
  reviewComment: { fontSize: FontSize.sm, color: Colors.gray700, lineHeight: 20 },
  reviewReply: {
    marginTop: 4, padding: Spacing.sm, gap: 2,
    borderRadius: Radius.md, backgroundColor: Colors.gray50,
  },
  reviewReplyLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.gray500 },
  reviewMore: { fontSize: FontSize.xs, color: Colors.gray500, textAlign: 'center', paddingVertical: 4 },

  hoursCard: {
    backgroundColor: Colors.gray50, borderRadius: 18,
    paddingHorizontal: Spacing.md, paddingVertical: 6,
  },
  hourRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8,
  },
  hourDay: { fontSize: FontSize.sm, color: Colors.gray700 },
  hourTime: { fontSize: FontSize.sm, color: Colors.gray500 },
  hourToday: { color: Colors.primary, fontWeight: FontWeight.bold },

  bookBar: {
    position: 'absolute', left: 12, right: 12, bottom: 0,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingTop: 12,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderRadius: 24,
    overflow: 'hidden',
  },
  bookService: { fontSize: FontSize.sm, color: Colors.gray500, marginBottom: 2 },
  bookPrice: { fontSize: FontSize.lg, fontWeight: FontWeight.heavy, color: Colors.ink },
  bookHint: { fontSize: FontSize.sm, color: Colors.gray500, lineHeight: 18 },

  bookBtnWrap: { borderRadius: Radius.pill, ...Shadow.brand },
  bookBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: Radius.pill, paddingHorizontal: 26, paddingVertical: 15,
  },
  bookBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
