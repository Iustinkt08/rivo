import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Radius, Shadow, Spacing } from '../../theme';
import { SalonCard as SalonCardType } from '../../store/salonStore';
import NoPhotoPlaceholder from './NoPhotoPlaceholder';

interface Props {
  salon: SalonCardType;
  onPress: () => void;
  horizontal?: boolean;
}

export default function SalonCard({ salon, onPress, horizontal }: Props) {
  if (horizontal) return <HorizontalCard salon={salon} onPress={onPress} />;
  return <VerticalCard salon={salon} onPress={onPress} />;
}

function VerticalCard({ salon, onPress }: { salon: SalonCardType; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.vertical}>
      {salon.coverImageUrl ? (
        <Image source={{ uri: salon.coverImageUrl }} style={styles.coverV} />
      ) : (
        <NoPhotoPlaceholder style={styles.coverV} size={30} />
      )}
      <View style={styles.badge}>
        <Ionicons name="star" size={11} color={Colors.star} />
        <Text style={styles.badgeText}>{salon.averageRating.toFixed(1)}</Text>
      </View>
      <View style={styles.infoV}>
        <Text style={styles.name} numberOfLines={1}>{salon.name}</Text>
        <View style={styles.row}>
          <Ionicons name="location-outline" size={12} color={Colors.gray500} />
          <Text style={styles.sub} numberOfLines={1}>{salon.addressLine1}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.reviewCount}>{salon.reviewCount} recenzii</Text>
          {salon.distanceKm !== undefined && (
            <Text style={styles.distance}>{salon.distanceKm} km</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function HorizontalCard({ salon, onPress }: { salon: SalonCardType; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.horizontal}>
      {salon.coverImageUrl ? (
        <Image source={{ uri: salon.coverImageUrl }} style={styles.coverH} />
      ) : (
        <NoPhotoPlaceholder style={styles.coverH} size={22} />
      )}
      <View style={styles.infoH}>
        <Text style={styles.name} numberOfLines={1}>{salon.name}</Text>
        <View style={styles.row}>
          <Ionicons name="location-outline" size={12} color={Colors.gray500} />
          <Text style={styles.sub} numberOfLines={1}>{salon.city}</Text>
        </View>
        <View style={[styles.row, { marginTop: 6 }]}>
          <Ionicons name="star" size={12} color={Colors.star} />
          <Text style={styles.ratingText}>{salon.averageRating.toFixed(1)}</Text>
          <Text style={styles.reviewCount}>  ·  {salon.reviewCount} recenzii</Text>
          {salon.distanceKm !== undefined && (
            <Text style={styles.distance}>  ·  {salon.distanceKm} km</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Vertical card
  vertical: {
    width: 200,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    marginRight: Spacing.md,
    overflow: 'hidden',
    ...Shadow.md,
  },
  coverV: { width: '100%', height: 130 },
  infoV: { padding: Spacing.sm + 2 },

  // Horizontal card
  horizontal: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  coverH: { width: 100, height: 100 },
  infoH: { flex: 1, padding: Spacing.sm + 2, justifyContent: 'center' },

  // Shared
  name: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.black, marginBottom: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  sub: { fontSize: FontSize.xs, color: Colors.gray500, flex: 1 },
  ratingText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.black, marginLeft: 2 },
  reviewCount: { fontSize: FontSize.xs, color: Colors.gray500 },
  distance: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.medium },
  badge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: Radius.full,
  },
  badgeText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
});
