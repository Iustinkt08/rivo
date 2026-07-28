import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import SalonCard from '../../components/common/SalonCard';
import { SkeletonCardHorizontal } from '../../components/common/SkeletonCard';
import RatingMarker from '../../components/client/RatingMarker';
import NearbySalonsSheet from '../../components/client/NearbySalonsSheet';
import SearchOverlay from '../../components/client/SearchOverlay';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, FontWeight, Gradients, Radius, Shadow, Spacing } from '../../theme';
import { SalonCard as SalonCardType } from '../../store/salonStore';
import { salonsApi } from '../../services/api/salons';
import { professionalsApi, ProfessionalSearchResult } from '../../services/api/professionals';

// Cap the professionals strip in list mode — salons remain the primary results.
const PRO_RESULTS_LIMIT = 10;

// ── Constants ─────────────────────────────────────────────────────────────────

const BUCHAREST: Region = {
  latitude: 44.4268, longitude: 26.1025,
  latitudeDelta: 0.05, longitudeDelta: 0.05,
};

// Height of the floating summary bar pill (used to offset list-mode content)
const SUMMARY_BAR_H = 64;
const SUMMARY_MARGIN_T = 8;

// Floating tab bar geometry (mirrors FloatingTabBar.tsx): bottom offset + bar height.
// The sheet extends underneath the navbar (Apple-Maps style); this value positions
// the collapsed peek and list padding so usable content clears the navbar.
const FLOATING_TAB_BAR_H = 69;

// ── Sort helpers ──────────────────────────────────────────────────────────────

type SortKey = 'distance' | 'rating' | 'price';

function sortResults(data: SalonCardType[], sort: SortKey): SalonCardType[] {
  const copy = [...data];
  if (sort === 'distance') return copy.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  if (sort === 'rating') return copy.sort((a, b) => b.averageRating - a.averageRating);
  return copy.sort((a, b) => a.reviewCount - b.reviewCount);
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    q?: string;
    category?: string;
    location?: string;
    date?: string;
  }>();

  // Derive display labels from route params (immutable per screen instance)
  const query = params.q ?? '';
  const initCategory = params.category ?? '';
  const locationLabel = params.location ?? 'Current location';
  const queryLabel = query || initCategory || 'All treatments';

  const [activeCategory, setActiveCategory] = useState(initCategory);
  const [activeSort, setActiveSort] = useState<SortKey>('distance');
  const [results, setResults] = useState<SalonCardType[]>([]);
  const [pros, setPros] = useState<ProfessionalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const mapRef = useRef<MapView>(null);
  const regionQueryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Data fetching ───────────────────────────────────────────────────────────

  const fetchResults = useCallback(async (
    q: string,
    cat: string,
    lat?: number,
    lng?: number,
  ) => {
    setLoading(true);
    try {
      const data = await salonsApi.listSmart({
        search: q || undefined,
        category: cat || undefined,
        lat,
        lng,
      });
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }

    // Professionals section (list mode) — only for text queries; best-effort.
    if (q.trim()) {
      professionalsApi.search(q.trim(), PRO_RESULTS_LIMIT)
        .then(setPros)
        .catch(() => setPros([]));
    } else {
      setPros([]);
    }
  }, []);

  // On mount: get user location, animate map, initial fetch
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const userRegion: Region = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          };
          mapRef.current?.animateToRegion(userRegion, 500);
          fetchResults(query, initCategory, pos.coords.latitude, pos.coords.longitude);
          return;
        }
      } catch {
        // Permission denied or location unavailable — fall through
      }
      fetchResults(query, initCategory, BUCHAREST.latitude, BUCHAREST.longitude);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-query when user pans/zooms the map (debounced 400 ms)
  const handleRegionChangeComplete = useCallback((region: Region) => {
    if (regionQueryRef.current) clearTimeout(regionQueryRef.current);
    regionQueryRef.current = setTimeout(() => {
      fetchResults(query, activeCategory, region.latitude, region.longitude);
    }, 400);
  }, [query, activeCategory, fetchResults]);

  // ── Derived data ────────────────────────────────────────────────────────────

  const sorted = useMemo(() => sortResults(results, activeSort), [results, activeSort]);

  // Top offset for list mode content (below the floating summary bar)
  const listTopPad = insets.top + SUMMARY_BAR_H + SUMMARY_MARGIN_T + Spacing.sm;

  // topInset for the bottom sheet: clamps the sheet so it can never expand above the summary bar.
  // SafeAreaView absorbs insets.top, then the bar has SUMMARY_MARGIN_T gap + SUMMARY_BAR_H height,
  // plus an 8px breathing gap so the bar is never obscured.
  const sheetTopInset = insets.top + SUMMARY_MARGIN_T + SUMMARY_BAR_H + 8;

  // Vertical space the floating tab bar occupies from the screen bottom. The sheet
  // itself extends underneath the navbar (no bottomInset); this value is used to keep
  // the collapsed peek content and the last list item clear of the navbar.
  const navbarOccupied = Math.max(insets.bottom - 8, 6) + FLOATING_TAB_BAR_H;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>

      {/* ── Layer 1: Map (full-screen, map mode only) ─────────────────────── */}
      {viewMode === 'map' && (
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={StyleSheet.absoluteFillObject}
          initialRegion={BUCHAREST}
          showsUserLocation
          onRegionChangeComplete={handleRegionChangeComplete}
        >
          {sorted
            .filter((s) => s.latitude && s.longitude)
            .map((salon) => (
              <Marker
                key={salon.id}
                coordinate={{ latitude: salon.latitude!, longitude: salon.longitude! }}
                onPress={() => setSelectedId(salon.id)}
                tracksViewChanges={false}
              >
                <RatingMarker
                  rating={salon.averageRating}
                  selected={selectedId === salon.id}
                />
              </Marker>
            ))}
        </MapView>
      )}

      {/* ── Layer 2: Bottom sheet (map mode only) ─────────────────────────── */}
      {viewMode === 'map' && (
        <NearbySalonsSheet
          results={sorted}
          loading={loading}
          selectedId={selectedId}
          activeSort={activeSort}
          onSortChange={setActiveSort}
          onVenuesPress={() => setOverlayVisible(true)}
          onCardPress={(id) => router.push(`/salon/${id}`)}
          topInset={sheetTopInset}
          navbarHeight={navbarOccupied}
        />
      )}

      {/* ── Layer 3: List mode (replaces map + sheet) ─────────────────────── */}
      {viewMode === 'list' && (
        <View style={[styles.listOuter, { paddingTop: listTopPad }]}>
          {loading ? (
            <FlatList
              data={Array.from({ length: 6 })}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={styles.listPad}
              renderItem={() => <SkeletonCardHorizontal />}
            />
          ) : sorted.length === 0 && pros.length === 0 ? (
            <View style={styles.emptyCenter}>
              <Ionicons name="search-outline" size={52} color={Colors.gray300} />
              <Text style={styles.emptyTitle}>No results</Text>
              <Text style={styles.emptyBody}>Try a different search or category.</Text>
            </View>
          ) : (
            <FlatList
              data={sorted}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listPad}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <SalonCard
                  salon={item}
                  horizontal
                  onPress={() => router.push(`/salon/${item.id}`)}
                />
              )}
              ListHeaderComponent={
                <>
                  {pros.length > 0 && (
                    <View style={styles.prosSection}>
                      <Text style={styles.prosTitle}>Specialiști</Text>
                      {pros.map((pro) => {
                        const initials = pro.fullName
                          .split(' ')
                          .filter(Boolean)
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase();
                        const subtitle = [pro.specialty, pro.salon?.name]
                          .filter(Boolean)
                          .join(' · ');
                        return (
                          <TouchableOpacity
                            key={pro.id}
                            style={styles.proRow}
                            activeOpacity={0.8}
                            onPress={() => router.push(`/professional/${pro.id}`)}
                          >
                            {pro.avatarUrl ? (
                              <Image source={{ uri: pro.avatarUrl }} style={styles.proAvatar} />
                            ) : (
                              <LinearGradient
                                colors={Gradients.brand}
                                start={Gradients.start}
                                end={Gradients.end}
                                style={styles.proAvatar}
                              >
                                <Text style={styles.proInitials}>
                                  {pro.avatarEmoji || initials}
                                </Text>
                              </LinearGradient>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={styles.proName} numberOfLines={1}>{pro.fullName}</Text>
                              {!!subtitle && (
                                <Text style={styles.proSubtitle} numberOfLines={1}>{subtitle}</Text>
                              )}
                            </View>
                            {pro.reviewCount > 0 && (
                              <View style={styles.proRating}>
                                <Ionicons name="star" size={12} color={Colors.star} />
                                <Text style={styles.proRatingText}>
                                  {pro.averageRating.toFixed(1).replace('.', ',')}
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                      <Text style={styles.prosTitle}>Saloane</Text>
                    </View>
                  )}
                  <Text style={styles.resultCount}>
                    {sorted.length} {sorted.length === 1 ? 'venue' : 'venues'}
                  </Text>
                </>
              }
            />
          )}
        </View>
      )}

      {/* ── Layer 4: Floating summary bar (always on top) ─────────────────── */}
      <SafeAreaView
        edges={['top']}
        style={styles.summaryOverlay}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={styles.summaryBar}
          activeOpacity={0.92}
          onPress={() => setOverlayVisible(true)}
        >
          <View style={styles.summaryIconWrap}>
            <Ionicons name="search" size={18} color={Colors.black} />
          </View>
          <View style={styles.summaryTextWrap}>
            <Text style={styles.summaryQuery} numberOfLines={1}>{queryLabel}</Text>
            <Text style={styles.summaryLocation} numberOfLines={1}>{locationLabel}</Text>
          </View>
          <TouchableOpacity
            style={styles.listToggleBtn}
            onPress={() => {
              setSelectedId(null);
              setViewMode((v) => (v === 'map' ? 'list' : 'map'));
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={viewMode === 'map' ? 'list-outline' : 'map-outline'}
              size={20}
              color={Colors.black}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </SafeAreaView>

      {/* ── Search Overlay Modal ──────────────────────────────────────────── */}
      <SearchOverlay visible={overlayVisible} onClose={() => setOverlayVisible(false)} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Floating summary bar — absolute so it floats over both map and list
  summaryOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginTop: SUMMARY_MARGIN_T,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    height: SUMMARY_BAR_H,
    backgroundColor: Colors.white,
    borderRadius: Radius.full,
    ...Shadow.md,
  },
  summaryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTextWrap: { flex: 1 },
  summaryQuery: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.black,
  },
  summaryLocation: {
    fontSize: FontSize.xs,
    color: Colors.gray500,
    marginTop: 1,
  },
  listToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // List mode
  listOuter: { flex: 1 },
  listPad: { padding: Spacing.md },
  resultCount: {
    fontSize: FontSize.sm,
    color: Colors.gray500,
    marginBottom: Spacing.sm,
  },

  // Professionals section (list mode)
  prosSection: { marginBottom: Spacing.sm },
  prosTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
    marginBottom: Spacing.sm,
    marginTop: 2,
  },
  proRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
  },
  proAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gray100,
  },
  proInitials: { color: Colors.white, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  proName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink },
  proSubtitle: { fontSize: FontSize.xs, color: Colors.gray500, marginTop: 1 },
  proRating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  proRatingText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.gray700 },

  // Empty state
  emptyCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.gray700,
  },
  emptyBody: {
    fontSize: FontSize.md,
    color: Colors.gray500,
    textAlign: 'center',
  },
});
