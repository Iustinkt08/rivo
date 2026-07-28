import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import SalonCard from '../common/SalonCard';
import { SalonCard as SalonCardType } from '../../store/salonStore';
import { useFavoritesStore } from '../../store/favoritesStore';
import { Colors, FontSize, FontWeight, Radius, Shadow, Spacing } from '../../theme';

type SortKey = 'distance' | 'rating' | 'price';

interface Props {
  results: SalonCardType[];
  loading: boolean;
  selectedId: string | null;
  activeSort: SortKey;
  onSortChange: (sort: SortKey) => void;
  onVenuesPress: () => void;
  onCardPress: (id: string) => void;
  /** Prevents the sheet from expanding above the floating summary bar. */
  topInset?: number;
  /** Space the floating tab bar occupies from the screen bottom. */
  navbarHeight?: number;
}

// Header block height (px): drag handle + filter chip row + venue count line.
// Added on top of the navbar height so the collapsed peek shows them above it.
const COLLAPSED_HEADER_H = 140;
// Extra gap so the last list item clears the floating navbar when scrolled.
const LIST_BOTTOM_GAP = 16;

export default function NearbySalonsSheet({
  results,
  loading,
  selectedId,
  activeSort,
  onSortChange,
  onVenuesPress,
  onCardPress,
  topInset,
  navbarHeight = 0,
}: Props) {
  // Collapsed peek = navbar footprint + header block, so the handle, chips, and
  // "{N} venues in map area" line sit just above the navbar while the white sheet
  // body extends down behind it (Apple-Maps style).
  const snapPoints = useMemo(
    () => [navbarHeight + COLLAPSED_HEADER_H, '50%', '90%'],
    [navbarHeight],
  );
  const sheetRef = useRef<BottomSheet>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flatListRef = useRef<any>(null);

  const { isFavorite, addFavorite, removeFavorite } = useFavoritesStore();

  // When a marker is selected, expand to 50% and scroll to card
  useEffect(() => {
    if (!selectedId) return;
    const idx = results.findIndex((r) => r.id === selectedId);
    if (idx < 0) return;
    sheetRef.current?.snapToIndex(1);
    try {
      flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0 });
    } catch {
      flatListRef.current?.scrollToOffset({ offset: idx * 116, animated: true });
    }
  }, [selectedId, results]);

  const renderItem = useCallback(
    ({ item }: { item: SalonCardType }) => {
      const fav = isFavorite(item.id);
      return (
        <View style={styles.cardWrap}>
          <SalonCard salon={item} horizontal onPress={() => onCardPress(item.id)} />
          <TouchableOpacity
            style={styles.heartBtn}
            onPress={() => (fav ? removeFavorite(item.id) : addFavorite(item))}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={fav ? 'heart' : 'heart-outline'}
              size={20}
              color={fav ? Colors.primary : Colors.gray400}
            />
          </TouchableOpacity>
        </View>
      );
    },
    [isFavorite, addFavorite, removeFavorite, onCardPress],
  );

  const ListHeader = (
    <>
      {/* Horizontal filter chip row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipsScroll}
      >
        <TouchableOpacity style={styles.tuneBtn} onPress={onVenuesPress}>
          <Ionicons name="options-outline" size={18} color={Colors.gray700} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.chip} onPress={onVenuesPress}>
          <Text style={styles.chipLabel}>Venues</Text>
          <Ionicons name="chevron-down" size={13} color={Colors.gray700} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chip, activeSort === 'rating' && styles.chipActive]}
          onPress={() => onSortChange('rating')}
        >
          <Text style={[styles.chipLabel, activeSort === 'rating' && styles.chipLabelActive]}>
            Best match
          </Text>
          <Ionicons
            name="chevron-down"
            size={13}
            color={activeSort === 'rating' ? Colors.white : Colors.gray700}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chip, activeSort === 'price' && styles.chipActive]}
          onPress={() => onSortChange('price')}
        >
          <Text style={[styles.chipLabel, activeSort === 'price' && styles.chipLabelActive]}>
            Price
          </Text>
          <Ionicons
            name="chevron-down"
            size={13}
            color={activeSort === 'price' ? Colors.white : Colors.gray700}
          />
        </TouchableOpacity>
      </ScrollView>

      {/* Venue count */}
      <View style={styles.countRow}>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <Text style={styles.countText}>
            {results.length} {results.length === 1 ? 'venue' : 'venues'} in map area
          </Text>
        )}
      </View>
    </>
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={1}
      snapPoints={snapPoints}
      topInset={topInset}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetFlatList
        ref={flatListRef}
        data={results}
        keyExtractor={(item: SalonCardType) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: navbarHeight + LIST_BOTTOM_GAP },
        ]}
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={(info: { index: number; highestMeasuredFrameIndex: number; averageItemLength: number }) => {
          flatListRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: true,
          });
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="search-outline" size={40} color={Colors.gray300} />
              <Text style={styles.emptyText}>No venues in this area</Text>
            </View>
          ) : null
        }
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    ...Shadow.md,
  },
  handle: {
    backgroundColor: Colors.gray300,
    width: 40,
  },

  // Chip row
  chipsScroll: { flexGrow: 0 },
  chips: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  tuneBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  chipActive: {
    backgroundColor: Colors.black,
    borderColor: Colors.black,
  },
  chipLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.gray700,
  },
  chipLabelActive: {
    color: Colors.white,
  },

  // Count line
  countRow: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    minHeight: 28,
    justifyContent: 'center',
  },
  countText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.gray700,
  },

  // Card + heart overlay
  cardWrap: {
    position: 'relative',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  heartBtn: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },

  listContent: {
    paddingBottom: Spacing.xl,
  },

  emptyWrap: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.gray500,
  },
});
