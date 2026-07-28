import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Colors, FontSize, FontWeight, Gradients, Radius, Spacing } from '../../theme';
import { CATEGORIES, renderIcon } from '../../constants/categories';
import { professionalsApi, ProfessionalSearchResult } from '../../services/api/professionals';

// ── Constants ──────────────────────────────────────────────────────────────────

const RECENT_KEY = 'navira-recent-searches';
const MAX_RECENT = 8;
const PRO_SEARCH_MIN_CHARS = 2;
const PRO_SEARCH_DEBOUNCE_MS = 300;
const PRO_SEARCH_LIMIT = 5;
const { width: SCREEN_W } = Dimensions.get('window');
const H_PAD = 20;
const COL_GAP = 10;
const CAT_CARD_W = (SCREEN_W - H_PAD * 2 - COL_GAP) / 2;

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function SearchOverlay({ visible, onClose }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [searchText, setSearchText] = useState('');
  const [locationText, setLocationText] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [recents, setRecents] = useState<string[]>([]);
  const [proResults, setProResults] = useState<ProfessionalSearchResult[]>([]);

  const searchInputRef = useRef<TextInput>(null);

  // Live professional matches while typing (debounced); errors just clear the list.
  useEffect(() => {
    if (!visible) return;
    const term = searchText.trim();
    if (term.length < PRO_SEARCH_MIN_CHARS) {
      setProResults([]);
      return;
    }
    const t = setTimeout(() => {
      professionalsApi.search(term, PRO_SEARCH_LIMIT)
        .then(setProResults)
        .catch(() => setProResults([]));
    }, PRO_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchText, visible]);

  const openProfessional = (id: string) => {
    if (searchText.trim()) saveRecent(searchText);
    onClose();
    router.push(`/professional/${id}`);
  };

  // Load recents and auto-focus search when overlay opens
  useEffect(() => {
    if (!visible) return;
    AsyncStorage.getItem(RECENT_KEY)
      .then((raw) => { if (raw) setRecents(JSON.parse(raw)); })
      .catch(() => {});
    const t = setTimeout(() => searchInputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, [visible]);

  // Persist a search term to recents
  const saveRecent = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecents((prev) => {
      const updated = [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, MAX_RECENT);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  const clearRecents = () => {
    setRecents([]);
    AsyncStorage.removeItem(RECENT_KEY).catch(() => {});
  };

  // Fetch device location and reverse geocode to a human-readable string
  const fetchCurrentLocation = async () => {
    if (locationLoading) return;
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const parts = [place?.street, place?.city].filter(Boolean);
      if (parts.length) setLocationText(parts.join(', '));
    } catch {
      // Keep whatever the user has typed
    } finally {
      setLocationLoading(false);
    }
  };

  const handleLocationFocus = () => {
    if (!locationText) fetchCurrentLocation();
  };

  // Central navigation: save term, close overlay, push to search screen
  const navigateToSearch = (q: string, category: string) => {
    if (q.trim()) saveRecent(q);
    onClose();

    const params: Record<string, string> = {};
    if (q.trim()) params.q = q.trim();
    if (category) params.category = category;
    if (locationText) params.location = locationText;
    if (selectedDate) params.date = selectedDate.toISOString();

    router.push({ pathname: '/search', params });
  };

  const handleSearch = () => navigateToSearch(searchText, selectedCategory);
  const handleRecentTap = (term: string) => navigateToSearch(term, '');
  const handleCategoryTap = (cat: (typeof CATEGORIES)[number]) => {
    navigateToSearch(searchText, cat.category);
  };

  const dateLabel = selectedDate
    ? selectedDate.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Anytime';

  const topPad = Math.max(insets.top, 24);
  const bottomPad = Math.max(insets.bottom, 16);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        {/* Tapping the thin dark strip at the top closes the overlay */}
        <TouchableOpacity style={styles.backdropStrip} onPress={onClose} activeOpacity={1} />

        <View style={[styles.sheet, { paddingTop: topPad }]}>
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Search</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={Colors.black} />
            </TouchableOpacity>
          </View>

          {/* ── Scrollable body ─────────────────────────────────────────────── */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Input group */}
            <View style={styles.inputGroup}>
              {/* Search */}
              <View style={[styles.inputRow, styles.inputRowFirst]}>
                <Ionicons name="search-outline" size={20} color={Colors.gray500} />
                <TextInput
                  ref={searchInputRef}
                  style={styles.textInput}
                  placeholder="Any treatments, venues or professionals"
                  placeholderTextColor={Colors.gray400}
                  value={searchText}
                  onChangeText={setSearchText}
                  returnKeyType="search"
                  onSubmitEditing={handleSearch}
                />
              </View>

              {/* Location */}
              <View style={styles.inputRow}>
                <TouchableOpacity onPress={fetchCurrentLocation} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  {locationLoading
                    ? <ActivityIndicator size="small" color={Colors.gray500} />
                    : <Ionicons name="location-outline" size={20} color={Colors.gray500} />
                  }
                </TouchableOpacity>
                <TextInput
                  style={styles.textInput}
                  placeholder="Current location"
                  placeholderTextColor={Colors.gray400}
                  value={locationText}
                  onChangeText={setLocationText}
                  onFocus={handleLocationFocus}
                />
              </View>

              {/* Date */}
              <TouchableOpacity
                style={styles.inputRow}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={20} color={Colors.gray500} />
                <Text style={[styles.valueText, !selectedDate && styles.placeholderText]}>
                  {dateLabel}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Date picker (Android dialog; iOS spinner rendered inline) */}
            {showDatePicker && (
              <DateTimePicker
                value={selectedDate ?? new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={(_, date) => {
                  if (Platform.OS === 'android') setShowDatePicker(false);
                  if (date) setSelectedDate(date);
                }}
              />
            )}
            {showDatePicker && Platform.OS === 'ios' && (
              <TouchableOpacity style={styles.dateConfirmBtn} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.dateConfirmText}>Done</Text>
              </TouchableOpacity>
            )}

            {/* ── Live professional matches ────────────────────────────────── */}
            {proResults.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Specialiști</Text>
                {proResults.map((pro) => {
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
                      onPress={() => openProfessional(pro.id)}
                      activeOpacity={0.7}
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
                          <Text style={styles.proInitials}>{pro.avatarEmoji || initials}</Text>
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
              </View>
            )}

            {/* ── Recents ──────────────────────────────────────────────────── */}
            {recents.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionTitle}>Recents</Text>
                  <TouchableOpacity onPress={clearRecents} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.clearText}>Clear</Text>
                  </TouchableOpacity>
                </View>
                {recents.map((term) => (
                  <TouchableOpacity
                    key={term}
                    style={styles.recentRow}
                    onPress={() => handleRecentTap(term)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.recentAvatar}>
                      <Ionicons name="search" size={13} color={Colors.coral} />
                    </View>
                    <Text style={styles.recentTerm} numberOfLines={1}>{term}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* ── Categories ───────────────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Categories</Text>
              <View style={styles.catGrid}>
                {CATEGORIES.map((cat) => {
                  const isActive = cat.category !== '' && selectedCategory === cat.category;
                  return (
                    <TouchableOpacity
                      key={cat.label}
                      style={[styles.catCard, isActive && styles.catCardActive]}
                      onPress={() => handleCategoryTap(cat)}
                      activeOpacity={0.75}
                    >
                      {renderIcon(cat.icon, 26, isActive ? Colors.primary : Colors.gray700)}
                      <Text
                        style={[styles.catLabel, isActive && styles.catLabelActive]}
                        numberOfLines={2}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={{ height: 12 }} />
          </ScrollView>

          {/* ── Sticky footer ────────────────────────────────────────────────── */}
          <View style={[styles.footer, { paddingBottom: bottomPad }]}>
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} activeOpacity={0.85}>
              <Text style={styles.searchBtnText}>Search</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Modal root: dark overlay with the sheet anchored at the bottom
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'flex-end',
  },
  // Tappable dark strip that lets users swipe/tap to dismiss
  backdropStrip: {
    height: 48,
  },
  // White sheet — takes all remaining space with rounded top corners
  sheet: {
    flex: 1,
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    overflow: 'hidden',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.black,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll body
  scrollContent: {
    paddingBottom: Spacing.sm,
  },

  // Input group: outlined rounded container with dividers between rows
  inputGroup: {
    marginHorizontal: H_PAD,
    marginTop: 16,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    backgroundColor: Colors.white,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  // First row: no top divider (parent border covers it)
  inputRowFirst: {
    borderTopWidth: 0,
  },
  textInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.black,
    fontWeight: FontWeight.medium,
    padding: 0,
    margin: 0,
  },
  valueText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.black,
    fontWeight: FontWeight.medium,
  },
  placeholderText: {
    color: Colors.gray400,
    fontWeight: FontWeight.regular,
  },

  // iOS date confirm button
  dateConfirmBtn: {
    alignSelf: 'flex-end',
    marginRight: H_PAD,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
  },
  dateConfirmText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },

  // Sections (Recents + Categories)
  section: {
    marginTop: 24,
    paddingHorizontal: H_PAD,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.black,
  },
  clearText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.coral,
  },

  // Live professional match rows
  proRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
  },
  proAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gray100,
  },
  proInitials: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  proName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
  },
  proSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.gray500,
    marginTop: 1,
  },
  proRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  proRatingText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.gray700,
  },

  // Recent items
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
  },
  recentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentTerm: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.black,
  },

  // Categories 2-column grid
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: COL_GAP,
  },
  catCard: {
    width: CAT_CARD_W,
    backgroundColor: Colors.gray100,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 8,
  },
  catCardActive: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  catLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.gray700,
    textAlign: 'center',
  },
  catLabelActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },

  // Sticky footer with black Search button
  footer: {
    paddingHorizontal: H_PAD,
    paddingTop: 12,
    backgroundColor: Colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  searchBtn: {
    backgroundColor: Colors.black,
    borderRadius: Radius.pill,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: {
    color: Colors.white,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
  },
});
