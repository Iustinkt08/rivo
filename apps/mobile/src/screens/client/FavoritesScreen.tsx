import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import SalonCard from '../../components/common/SalonCard';
import { Colors, FontSize, FontWeight, Gradients, Radius, Spacing } from '../../theme';
import { useFavoritesStore } from '../../store/favoritesStore';

// Matches the vertical start used by the Bookings empty-state so both screens
// feel visually consistent when switching between tabs.
const EMPTY_BLOCK_TOP = 72;

export default function FavoritesScreen() {
  const router = useRouter();
  const { favorites, removeFavorite } = useFavoritesStore();

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Favorite</Text>
          {favorites.length > 0 && (
            <Text style={styles.count}>{favorites.length} saloane</Text>
          )}
        </View>
      </SafeAreaView>

      {favorites.length === 0 ? (
        <View style={styles.empty}>
          <LinearGradient
            colors={Gradients.brand}
            start={Gradients.start}
            end={Gradients.end}
            style={styles.emptyIconBox}
          >
            <Ionicons name="heart" size={44} color={Colors.white} />
          </LinearGradient>
          <Text style={styles.emptyTitle}>Nicio locație salvată</Text>
          <Text style={styles.emptySubtitle}>
            Apasă inima de pe profilul unui salon pentru a-l adăuga la favorite.
          </Text>
          <TouchableOpacity
            style={styles.emptyAction}
            onPress={() => router.push('/search')}
            activeOpacity={0.75}
          >
            <Text style={styles.emptyActionText}>Explorează saloane</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <SalonCard
                salon={item}
                horizontal
                onPress={() => router.push(`/salon/${item.id}`)}
              />
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => removeFavorite(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="heart" size={22} color={Colors.error} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.black,
    letterSpacing: -0.5,
  },
  count: { fontSize: FontSize.sm, color: Colors.gray500 },

  // ── Populated list ───────────────────────────────────────────────────────────
  list: { paddingHorizontal: Spacing.lg, paddingBottom: 130 },

  cardWrap: { position: 'relative', marginBottom: Spacing.md },
  removeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Empty state — mirrors BookingsScreen.EmptyState exactly ─────────────────
  empty: {
    alignItems: 'center',
    paddingTop: EMPTY_BLOCK_TOP,
    paddingHorizontal: Spacing.xl,
  },
  emptyIconBox: {
    width: 96,
    height: 96,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.black,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.gray500,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  emptyAction: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 11,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  emptyActionText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
});
