import React, { useEffect, useRef, useState } from 'react';
import SearchOverlay from '../../components/client/SearchOverlay';
import LocationPicker from '../../components/client/LocationPicker';
import {
  Dimensions, Image, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SkeletonCardVertical } from '../../components/common/SkeletonCard';
import NoPhotoPlaceholder from '../../components/common/NoPhotoPlaceholder';
import { Colors, FontSize, FontWeight, Gradients } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { useSalonStore, SalonCard as SalonCardType } from '../../store/salonStore';
import { salonsApi } from '../../services/api/salons';
import { professionalsApi, TopProfessional } from '../../services/api/professionals';
import { CATEGORIES, renderIcon } from '../../constants/categories';

// ── Local Figma icons (assets/icons/home, rendered via react-native-svg) ──
import SearchIcon from '../../assets/icons/home/search.svg';
import FavoriteIcon from '../../assets/icons/home/favorite.svg';
import NotificationIcon from '../../assets/icons/home/notification.svg';
import LocationPinIcon from '../../assets/icons/home/location-pin.svg';

const { width: SCREEN_W } = Dimensions.get('window');

const H_PAD = 28;
const MUTED = 'rgba(34,34,34,0.65)';
const CITY_KEY = 'navira-selected-city';

const CARD_W = Math.min(283, SCREEN_W * 0.74);
const CARD_IMG_H = CARD_W * 0.686;
const PRO_W = Math.min(312, SCREEN_W - 64);

// ── Recommended salon card (Figma "Salon Card") ─────────────────────────────
function SalonCard({ salon, onPress }: { salon: SalonCardType; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.salonCard}>
      <View style={styles.salonImgWrap}>
        {salon.coverImageUrl ? (
          <Image source={{ uri: salon.coverImageUrl }} style={styles.salonImg} />
        ) : (
          <NoPhotoPlaceholder style={styles.salonImg} size={34} />
        )}
      </View>
      <View style={styles.salonRow}>
        <Text style={styles.salonName} numberOfLines={1}>{salon.name}</Text>
        <Text style={styles.salonRating}>{salon.averageRating.toFixed(1).replace('.', ',')}</Text>
      </View>
      <Text style={styles.salonAddress} numberOfLines={1}>
        {salon.addressLine1 || salon.city}
      </Text>
    </TouchableOpacity>
  );
}

// ── Best professional card (Figma "Professional Card") ──────────────────────
function ProCard({ pro, onPress }: { pro: TopProfessional; onPress: () => void }) {
  const initials = (pro.fullName || `${pro.firstName} ${pro.lastName}`)
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const subtitle = pro.salonName ?? pro.bio ?? '';
  return (
    <TouchableOpacity style={styles.proCard} activeOpacity={0.9} onPress={onPress}>
      {pro.avatarUrl ? (
        <Image source={{ uri: pro.avatarUrl }} style={styles.proAvatar} />
      ) : (
        <LinearGradient colors={Gradients.brand} start={Gradients.start} end={Gradients.end} style={styles.proAvatar}>
          <Text style={styles.proInitials}>{initials}</Text>
        </LinearGradient>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.proName} numberOfLines={1}>{pro.fullName}</Text>
        <Text style={styles.proRole} numberOfLines={1}>{subtitle}</Text>
        {/* Count is null when the professional hides it (publicSettings). */}
        {pro.appointmentCount != null && (
          <Text style={styles.proReviews} numberOfLines={1}>{pro.appointmentCount} programări</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { salons, setSalons } = useSalonStore();
  const [pros, setPros] = useState<TopProfessional[]>([]);
  const [city, setCity] = useState('Cluj-Napoca');
  const [loading, setLoading] = useState(true);
  const [searchOverlayVisible, setSearchOverlayVisible] = useState(false);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    // Restore persisted city selection first
    AsyncStorage.getItem(CITY_KEY)
      .then((saved) => { if (saved) setCity(saved); })
      .catch(() => {});

    // Best professionals — real backend data; leave empty on error (no fallback)
    professionalsApi.getTop(10)
      .then(setPros)
      .catch(() => {});

    (async () => {
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
          try {
            const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
            const name = place?.city ?? place?.subregion ?? place?.region;
            if (name) {
              setCity(name);
              AsyncStorage.setItem(CITY_KEY, name).catch(() => {});
            }
          } catch {
            // keep default city
          }
        }
      } catch {
        // permission denied / unavailable — proceed without coords
      }
      try {
        const data = await salonsApi.listSmart({ lat, lng });
        setSalons(data);
      } catch {
        // Surface an empty state rather than fake data when the API is unreachable.
        setSalons([]);
      } finally {
        loadedRef.current = true;
        setLoading(false);
      }
    })();
  }, []);

  const handleLocationSelect = (
    selectedCity: string,
    coords?: { latitude: number; longitude: number },
  ) => {
    setCity(selectedCity);
    setLocationPickerVisible(false);
    AsyncStorage.setItem(CITY_KEY, selectedCity).catch(() => {});
    // Re-fetch salons for the new coords when provided
    if (coords) {
      salonsApi.listSmart({ lat: coords.latitude, lng: coords.longitude })
        .then(setSalons)
        .catch(() => {});
    }
  };

  const recommended = salons.slice(0, 8);

  const goSearch = (category?: string) =>
    router.push({ pathname: '/search', params: category ? { category } : {} });
  const goSalon = (id: string) => router.push(`/salon/${id}`);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>

        {/* Location label — tappable to open city picker */}
        <TouchableOpacity
          style={styles.locationRow}
          activeOpacity={0.7}
          onPress={() => setLocationPickerVisible(true)}
        >
          <LocationPinIcon width={15} height={18} />
          <Text style={styles.locationText}>{city}</Text>
        </TouchableOpacity>

        {/* Search row + actions pill */}
        <View style={styles.searchRow}>
          <TouchableOpacity style={styles.searchField} activeOpacity={0.85} onPress={() => setSearchOverlayVisible(true)}>
            <SearchIcon width={24} height={24} />
            <Text style={styles.searchPlaceholder} numberOfLines={1}>Caută salon, specialist</Text>
          </TouchableOpacity>
          <View style={styles.actionsPill}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(client)/favorites')}>
              <FavoriteIcon width={24} height={22} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(client)/notifications')}>
              <NotificationIcon width={20} height={22} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Recommended */}
        <Text style={styles.sectionTitle}>Recomandate</Text>
        {!loading && recommended.length === 0 ? (
          <View style={styles.salonsEmpty}>
            <Ionicons name="storefront-outline" size={40} color={Colors.gray300} />
            <Text style={styles.salonsEmptyTitle}>Niciun salon disponibil</Text>
            <Text style={styles.salonsEmptyBody}>
              Nu am găsit saloane momentan. Încearcă din nou mai târziu sau schimbă locația.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.salonList}
            snapToInterval={CARD_W + 25}
            decelerationRate="fast"
          >
            {loading
              ? Array.from({ length: 3 }).map((_, i) => <SkeletonCardVertical key={i} />)
              : recommended.map((salon) => (
                  <SalonCard key={salon.id} salon={salon} onPress={() => goSalon(salon.id)} />
                ))}
          </ScrollView>
        )}

        {/* Best professionals — real backend data; section hidden when empty */}
        {pros.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Cei mai buni profesioniști</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.proList}>
              {pros.map((pro) => (
                <ProCard
                  key={pro.id}
                  pro={pro}
                  onPress={() => router.push(`/professional/${pro.id}`)}
                />
              ))}
            </ScrollView>
          </>
        )}

        {/* Categories */}
        <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Categorii</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catList}>
          {CATEGORIES.map(({ label, icon, category }) => (
            <TouchableOpacity
              key={label}
              style={styles.catItem}
              activeOpacity={0.8}
              onPress={() => goSearch(category || undefined)}
            >
              <View style={styles.catCircle}>
                {renderIcon(icon, 26, Colors.ink)}
              </View>
              <Text style={styles.catLabel} numberOfLines={2}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </ScrollView>

      <SearchOverlay
        visible={searchOverlayVisible}
        onClose={() => setSearchOverlayVisible(false)}
      />

      <LocationPicker
        visible={locationPickerVisible}
        currentCity={city}
        onSelect={handleLocationSelect}
        onClose={() => setLocationPickerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },

  // Location
  locationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: H_PAD, paddingTop: 6, marginBottom: 16,
  },
  locationText: { fontSize: 18, fontWeight: FontWeight.medium, color: Colors.black },

  // Search + actions
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: H_PAD, marginBottom: 24,
  },
  searchField: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 50, borderRadius: 37, backgroundColor: Colors.white,
    paddingHorizontal: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.13, shadowRadius: 9, elevation: 4,
  },
  // Muted placeholder tone — gray400 gives the light "hint" look
  searchPlaceholder: { flex: 1, fontSize: 16, color: Colors.gray400, fontWeight: FontWeight.regular },
  actionsPill: {
    flexDirection: 'row', alignItems: 'center',
    height: 50, borderRadius: 37, backgroundColor: Colors.white,
    paddingHorizontal: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.13, shadowRadius: 9, elevation: 4,
  },
  actionBtn: { width: 42, height: 44, alignItems: 'center', justifyContent: 'center' },

  // Section titles — solid brand red, no gradient
  sectionTitle: {
    fontSize: 20, fontWeight: FontWeight.semibold,
    color: Colors.primary,
    marginLeft: H_PAD, marginBottom: 10,
  },

  // Recommended — empty state
  salonsEmpty: {
    marginHorizontal: H_PAD, paddingVertical: 28, paddingHorizontal: 20,
    alignItems: 'center', gap: 8,
    borderRadius: 24, backgroundColor: Colors.gray50,
    borderWidth: 1, borderColor: Colors.border,
  },
  salonsEmptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.gray700, marginTop: 4 },
  salonsEmptyBody: { fontSize: FontSize.sm, color: Colors.gray500, textAlign: 'center', lineHeight: 19 },

  // Recommended salon cards
  salonList: { paddingHorizontal: H_PAD, gap: 25, paddingVertical: 5 },
  salonCard: { width: CARD_W },
  salonImgWrap: {
    width: CARD_W, height: CARD_IMG_H, borderRadius: 37, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', backgroundColor: Colors.gray100,
  },
  salonImg: { width: '100%', height: '100%' },
  salonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 11 },
  salonName: { flex: 1, fontSize: 20, fontWeight: FontWeight.semibold, color: '#222' },
  salonRating: { fontSize: 20, fontWeight: FontWeight.semibold, color: '#222', marginLeft: 8 },
  salonAddress: { fontSize: 15, fontWeight: FontWeight.medium, color: MUTED, marginTop: 9 },

  // Best professionals
  proList: { paddingHorizontal: H_PAD, gap: 12, paddingVertical: 2 },
  proCard: {
    width: PRO_W, height: 104, flexDirection: 'row', alignItems: 'center', gap: 20,
    borderRadius: 46, borderWidth: 1, borderColor: 'rgba(216,216,216,0.8)',
    paddingHorizontal: 24, backgroundColor: Colors.white,
  },
  proAvatar: { width: 65, height: 65, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  proInitials: { color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold },
  proName: { fontSize: 20, fontWeight: FontWeight.semibold, color: '#222' },
  proRole: { fontSize: 15, fontWeight: FontWeight.medium, color: MUTED, marginTop: 2 },
  proReviews: { fontSize: 15, fontWeight: FontWeight.medium, color: 'rgba(0,0,0,0.5)', marginTop: 2 },

  // Categories — horizontal circle row
  catList: { paddingHorizontal: H_PAD, gap: 12, paddingVertical: 2 },
  catItem: { width: 70, alignItems: 'center', gap: 8 },
  catCircle: {
    width: 62, height: 58, borderRadius: 30, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(216,216,216,0.8)', backgroundColor: Colors.white,
  },
  catLabel: { fontSize: 11, fontWeight: FontWeight.medium, color: Colors.black, textAlign: 'center' },
});
