import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Dimensions, Image, Linking,
  PanResponder, ScrollView, Share, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/common/Button';
import { Colors, FontSize, FontWeight, Radius, Shadow, Spacing } from '../../theme';
import { salonsApi } from '../../services/api/salons';
import { SalonProfile, OpeningHour } from '../../store/salonStore';
import { useFavoritesStore } from '../../store/favoritesStore';
import { bookingsApi, BookingService } from '../../services/api/bookings';

const { width } = Dimensions.get('window');
const CAROUSEL_HEIGHT = 300;
const AUTO_ADVANCE_MS = 3500;

const DAYS_RO: Record<string, string> = {
  MONDAY: 'Luni', TUESDAY: 'Marți', WEDNESDAY: 'Miercuri',
  THURSDAY: 'Joi', FRIDAY: 'Vineri', SATURDAY: 'Sâmbătă', SUNDAY: 'Duminică',
};

const DAY_KEYS = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];

function isOpenNow(hours: OpeningHour[]): boolean | null {
  const now = new Date();
  const dayKey = DAY_KEYS[now.getDay()];
  const h = hours.find((x) => x.dayOfWeek === dayKey);
  if (!h || h.isClosed) return false;
  const [oh, om] = h.openTime.split(':').map(Number);
  const [ch, cm] = h.closeTime.split(':').map(Number);
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= oh * 60 + om && mins < ch * 60 + cm;
}

// ── Photo carousel ─────────────────────────────────────────────────────────────

interface CarouselProps {
  images: string[];
  onBack: () => void;
  favorited: boolean;
  onToggleFavorite: () => void;
}

function PhotoCarousel({ images, onBack, favorited, onToggleFavorite }: CarouselProps) {
  const [index, setIndex]   = useState(0);
  const indexRef            = useRef(0);
  const opacity             = useRef(new Animated.Value(1)).current;
  const timerRef            = useRef<ReturnType<typeof setInterval> | null>(null);

  // Crossfade to a new slide
  const switchTo = useCallback((next: number) => {
    Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
      indexRef.current = next;
      setIndex(next);
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    });
  }, [opacity]);

  // Auto-advance
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (images.length <= 1) return;
    timerRef.current = setInterval(() => {
      switchTo((indexRef.current + 1) % images.length);
    }, AUTO_ADVANCE_MS);
  }, [images.length, switchTo]);

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resetTimer]);

  // Swipe gesture — does NOT nest inside the outer ScrollView
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) < 40) return;
        const next = g.dx < 0
          ? (indexRef.current + 1) % images.length
          : (indexRef.current - 1 + images.length) % images.length;
        switchTo(next);
        resetTimer();
      },
    }),
  ).current;

  if (images.length === 0) {
    return (
      <View style={carouselStyles.empty}>
        <Ionicons name="image-outline" size={48} color={Colors.gray300} />
        <Overlay onBack={onBack} favorited={favorited} onToggleFavorite={onToggleFavorite} />
      </View>
    );
  }

  const uri = images[index];

  return (
    <View style={carouselStyles.container} {...panResponder.panHandlers}>
      <Animated.View style={[carouselStyles.slide, { opacity }]}>
        <Image source={{ uri }} style={carouselStyles.slide} resizeMode="cover" />
      </Animated.View>

      {/* Bottom gradient */}
      <View style={carouselStyles.gradient} pointerEvents="none" />

      {/* Dots */}
      {images.length > 1 && (
        <View style={carouselStyles.dots} pointerEvents="box-none">
          {images.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => { switchTo(i); resetTimer(); }}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <View style={[carouselStyles.dot, i === index && carouselStyles.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Counter */}
      {images.length > 1 && (
        <View style={carouselStyles.counter} pointerEvents="none">
          <Text style={carouselStyles.counterText}>{index + 1} / {images.length}</Text>
        </View>
      )}

      <Overlay onBack={onBack} favorited={favorited} onToggleFavorite={onToggleFavorite} />
    </View>
  );
}

function Overlay({ onBack, favorited, onToggleFavorite }: Omit<CarouselProps, 'images'>) {
  return (
    <SafeAreaView edges={['top']} style={carouselStyles.overlay}>
      <TouchableOpacity style={carouselStyles.circleBtn} onPress={onBack}>
        <Ionicons name="arrow-back" size={22} color={Colors.white} />
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity style={carouselStyles.circleBtn} onPress={onToggleFavorite}>
          <Ionicons
            name={favorited ? 'heart' : 'heart-outline'}
            size={22}
            color={favorited ? '#FF4D6D' : Colors.white}
          />
        </TouchableOpacity>
        <TouchableOpacity style={carouselStyles.circleBtn}>
          <Ionicons name="share-outline" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const carouselStyles = StyleSheet.create({
  container: { width, height: CAROUSEL_HEIGHT, overflow: 'hidden', backgroundColor: Colors.gray100 },
  slide: { width, height: CAROUSEL_HEIGHT },
  empty: {
    width, height: CAROUSEL_HEIGHT,
    backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center',
  },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: Spacing.md,
  },
  circleBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  gradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    // Manual gradient via opacity layers — expo-linear-gradient not needed here
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  dots: {
    position: 'absolute', bottom: 14, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 5,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    width: 18, backgroundColor: Colors.white,
  },
  counter: {
    position: 'absolute', bottom: 12, right: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  counterText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
});

// ── Main screen ────────────────────────────────────────────────────────────────

export default function SalonProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const slug = params.id;

  const [salon, setSalon] = useState<SalonProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'services' | 'reviews' | 'info'>('services');
  const { addFavorite, removeFavorite, isFavorite } = useFavoritesStore();

  useEffect(() => {
    salonsApi.getProfile(slug).then(setSalon);
  }, [slug]);

  const favorited = salon ? isFavorite(salon.id) : false;

  const toggleFavorite = () => {
    if (!salon) return;
    if (favorited) {
      removeFavorite(salon.id);
    } else {
      addFavorite({
        id: salon.id,
        name: salon.name,
        slug: salon.slug,
        coverImageUrl: salon.coverImageUrl,
        city: salon.city,
        addressLine1: salon.addressLine1,
        averageRating: salon.averageRating,
        reviewCount: salon.reviewCount,
        distanceKm: salon.distanceKm,
      });
    }
  };

  if (!salon) return null;

  // Build carousel image list: cover first, then gallery
  const carouselImages: string[] = [];
  const cover = salon.coverImageUrl ?? 'https://picsum.photos/seed/salonDefault/800/500';
  if (cover) carouselImages.push(cover);
  salon.gallery.forEach((g) => {
    if (g.url && g.url !== cover) carouselImages.push(g.url);
  });

  const goToBooking = (preselectedService?: any) => {
    router.push({
      pathname: '/(client)/booking',
      params: {
        salonName: salon.name,
        salonId: salon.id,
        ...(preselectedService ? { preselectedServiceId: preselectedService.id } : {}),
      },
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Photo carousel */}
        <PhotoCarousel
          images={carouselImages}
          onBack={() => router.back()}
          favorited={favorited}
          onToggleFavorite={toggleFavorite}
        />

        {/* Salon info card — overlaps carousel by 20px */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.salonName}>{salon.name}</Text>
              <View style={styles.row}>
                <Ionicons name="location-outline" size={13} color={Colors.gray500} />
                <Text style={styles.address}>{salon.addressLine1}, {salon.city}</Text>
              </View>
              {/* Open now badge */}
              {(() => {
                const open = isOpenNow(salon.openingHours);
                return (
                  <View style={[styles.openBadge, { backgroundColor: open ? '#DCFCE7' : '#FEE2E2' }]}>
                    <View style={[styles.openDot, { backgroundColor: open ? Colors.success : Colors.error }]} />
                    <Text style={[styles.openText, { color: open ? Colors.success : Colors.error }]}>
                      {open ? 'Deschis acum' : 'Închis acum'}
                    </Text>
                  </View>
                );
              })()}
            </View>
            <View style={styles.ratingBox}>
              <Ionicons name="star" size={14} color={Colors.star} />
              <Text style={styles.ratingNum}>{salon.averageRating.toFixed(1)}</Text>
              <Text style={styles.ratingCount}>({salon.reviewCount})</Text>
            </View>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <Stat icon="cut-outline"    label="Servicii"        value={String(salon.serviceCount)} />
            <View style={styles.statDivider} />
            <Stat icon="people-outline" label="Specialiști"     value={String(salon.staffCount)} />
            <View style={styles.statDivider} />
            <Stat icon="time-outline"   label="Anulare gratuită" value={`${salon.cancellationHours}h`} />
          </View>

          {/* Contact quick actions */}
          <View style={styles.contactRow}>
            {salon.phone && (
              <TouchableOpacity
                style={styles.contactBtn}
                onPress={() => Linking.openURL(`tel:${salon.phone}`)}
              >
                <Ionicons name="call-outline" size={18} color={Colors.primary} />
                <Text style={styles.contactText}>Sună</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.contactBtn}
              onPress={() => {
                const q = encodeURIComponent(`${salon.addressLine1}, ${salon.city}`);
                Linking.openURL(`https://maps.google.com/?q=${q}`);
              }}
            >
              <Ionicons name="navigate-outline" size={18} color={Colors.primary} />
              <Text style={styles.contactText}>Direcții</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.contactBtn}
              onPress={() => Share.share({
                title: salon.name,
                message: `Descoperă ${salon.name} pe NAVIRA! ${salon.addressLine1}, ${salon.city}`,
              })}
            >
              <Ionicons name="share-social-outline" size={18} color={Colors.primary} />
              <Text style={styles.contactText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['services', 'reviews', 'info'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'services' ? 'Servicii' : tab === 'reviews' ? 'Recenzii' : 'Info'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'services' && <ServicesTab salon={salon} onBook={goToBooking} />}
        {activeTab === 'reviews'  && <ReviewsTab />}
        {activeTab === 'info'     && <InfoTab salon={salon} />}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky booking button */}
      <View style={styles.stickyBottom}>
        <Button title="Rezervă acum" fullWidth size="lg" onPress={() => goToBooking()} />
      </View>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Stat({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Ionicons name={icon} size={20} color={Colors.primary} />
      <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black, marginTop: 4 }}>{value}</Text>
      <Text style={{ fontSize: FontSize.xs, color: Colors.gray500, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function ServicesTab({ salon, onBook }: { salon: SalonProfile; onBook: (service?: BookingService) => void }) {
  const [services, setServices] = useState<BookingService[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    bookingsApi.getServices(salon.id).then((data) => {
      setServices(data);
      setLoading(false);
    });
  }, [salon.id]);

  if (loading) {
    return (
      <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const grouped = services.reduce((acc, s) => {
    acc[s.category] = [...(acc[s.category] ?? []), s];
    return acc;
  }, {} as Record<string, BookingService[]>);

  return (
    <View style={{ paddingHorizontal: Spacing.lg }}>
      {Object.entries(grouped).map(([cat, list]) => (
        <View key={cat} style={{ marginBottom: Spacing.lg }}>
          <Text style={styles.catHeader}>{cat}</Text>
          {list.map((service) => (
            <TouchableOpacity
              key={service.id}
              style={styles.serviceRow}
              onPress={() => onBook(service)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.serviceName}>{service.name}</Text>
                <Text style={styles.serviceMeta}>{service.durationMin} min</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.servicePrice}>{service.price} RON</Text>
                <Text style={styles.bookLink}>Rezervă</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
}

function ReviewsTab() {
  return (
    <View style={{ paddingHorizontal: Spacing.lg }}>
      {[
        { name: 'Ana M.',    rating: 5, text: 'Superb! Am revenit de mai multe ori, sunt minunate!',          date: '2 săpt. în urmă' },
        { name: 'Mihai P.', rating: 4, text: 'Servicii de calitate, personal foarte amabil. Recomand!',        date: '1 lună în urmă' },
        { name: 'Ioana S.', rating: 5, text: 'Cea mai bună experiență hair în București 💜',                   date: '1 lună în urmă' },
      ].map((r, i) => (
        <View key={i} style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{r.name[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reviewName}>{r.name}</Text>
              <Text style={styles.reviewDate}>{r.date}</Text>
            </View>
            <View style={styles.stars}>
              {Array.from({ length: r.rating }).map((_, j) => (
                <Ionicons key={j} name="star" size={12} color={Colors.star} />
              ))}
            </View>
          </View>
          <Text style={styles.reviewText}>{r.text}</Text>
        </View>
      ))}
    </View>
  );
}

function InfoTab({ salon }: { salon: SalonProfile }) {
  return (
    <View style={{ paddingHorizontal: Spacing.lg }}>
      {salon.description && <Text style={styles.description}>{salon.description}</Text>}
      <Text style={[styles.catHeader, { marginTop: Spacing.lg }]}>Program</Text>
      {salon.openingHours.map((h) => (
        <View key={h.dayOfWeek} style={styles.scheduleRow}>
          <Text style={styles.scheduleDay}>{DAYS_RO[h.dayOfWeek]}</Text>
          <Text style={[styles.scheduleHours, h.isClosed && { color: Colors.error }]}>
            {h.isClosed ? 'Închis' : `${h.openTime} – ${h.closeTime}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  infoCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    marginTop: -20, padding: Spacing.lg, ...Shadow.sm,
  },
  infoHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.md },
  salonName: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.black, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  address: { fontSize: FontSize.sm, color: Colors.gray500, flex: 1 },
  openBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', marginTop: 6,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full,
  },
  openDot: { width: 6, height: 6, borderRadius: 3 },
  openText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  ratingBox: {
    alignItems: 'center', flexDirection: 'row', gap: 3,
    backgroundColor: Colors.gray50, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 6,
  },
  ratingNum: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black },
  ratingCount: { fontSize: FontSize.xs, color: Colors.gray500 },

  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.md, borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: Colors.border, marginBottom: Spacing.md,
  },
  statDivider: { width: 1, height: 36, backgroundColor: Colors.border },

  contactRow: { flexDirection: 'row', justifyContent: 'space-around' },
  contactBtn: { alignItems: 'center', gap: 4 },
  contactText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.medium },

  tabs: {
    flexDirection: 'row', borderBottomWidth: 1, borderColor: Colors.border, marginTop: Spacing.lg,
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderColor: 'transparent' },
  tabActive: { borderColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, color: Colors.gray500, fontWeight: FontWeight.medium },
  tabTextActive: { color: Colors.primary, fontWeight: FontWeight.bold },

  catHeader: {
    fontSize: FontSize.md, fontWeight: FontWeight.bold,
    color: Colors.gray700, marginBottom: Spacing.sm, marginTop: Spacing.sm,
  },
  serviceRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.md, borderBottomWidth: 1, borderColor: Colors.border,
  },
  serviceName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.black, marginBottom: 3 },
  serviceMeta: { fontSize: FontSize.xs, color: Colors.gray500 },
  servicePrice: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black },
  bookLink: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold, marginTop: 3 },

  reviewCard: { backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, ...Shadow.sm },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: Spacing.sm },
  avatarCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.primary, fontWeight: FontWeight.bold },
  reviewName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.black },
  reviewDate: { fontSize: FontSize.xs, color: Colors.gray500 },
  stars: { flexDirection: 'row', gap: 2 },
  reviewText: { fontSize: FontSize.sm, color: Colors.gray700, lineHeight: 20 },

  description: { fontSize: FontSize.md, color: Colors.gray700, lineHeight: 22 },
  scheduleRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderColor: Colors.border,
  },
  scheduleDay: { fontSize: FontSize.sm, color: Colors.black, fontWeight: FontWeight.medium },
  scheduleHours: { fontSize: FontSize.sm, color: Colors.gray700 },

  stickyBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white, paddingHorizontal: Spacing.lg,
    paddingBottom: 28, paddingTop: 12, borderTopWidth: 1, borderColor: Colors.border,
  },
});
