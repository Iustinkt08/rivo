import React, { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, FontWeight, Gradients, Radius, Shadow, Spacing } from '../../theme';
import { formatPunchReward, loyaltyApi, MyPunchCard } from '../../services/api/loyalty';
import PunchDots from '../common/PunchDots';

const TINT_EARNED = '#EAF7EE';

function salonInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
}

/**
 * Compact horizontal "Cardurile mele de fidelitate" strip for the client
 * bookings screen. Self-contained: refreshes silently on focus and renders
 * nothing while empty or on fetch errors.
 */
export default function PunchCardsStrip() {
  const [cards, setCards] = useState<MyPunchCard[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loyaltyApi
        .getMyPunchCards()
        .then((list) => { if (!cancelled) setCards(list); })
        .catch(() => { /* silent — the strip simply stays hidden */ });
      return () => { cancelled = true; };
    }, []),
  );

  if (cards.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Cardurile mele de fidelitate</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {cards.map((card) => (
          <PunchCardItem key={card.salon.id} card={card} />
        ))}
      </ScrollView>
    </View>
  );
}

function PunchCardItem({ card }: { card: MyPunchCard }) {
  const shownVisits = Math.min(card.completedVisits, card.requiredVisits);

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        {card.salon.logoUrl ? (
          <Image source={{ uri: card.salon.logoUrl }} style={styles.logo} />
        ) : (
          <LinearGradient
            colors={Gradients.brand}
            start={Gradients.start}
            end={Gradients.end}
            style={styles.logo}
          >
            <Text style={styles.logoInitials}>{salonInitials(card.salon.name)}</Text>
          </LinearGradient>
        )}
        <View style={styles.headBody}>
          <Text style={styles.salonName} numberOfLines={1}>{card.salon.name}</Text>
          <Text style={styles.count}>{shownVisits}/{card.requiredVisits} vizite</Text>
        </View>
      </View>

      <PunchDots completed={card.completedVisits} required={card.requiredVisits} size={8} />

      {card.earned ? (
        <View style={styles.earnedBadge}>
          <Text style={styles.earnedText}>Reducere activată</Text>
        </View>
      ) : (
        <Text style={styles.reward} numberOfLines={1}>
          {formatPunchReward(card.rewardType, card.rewardValue)} la {card.requiredVisits} vizite
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.md },
  title: {
    fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.gray700,
    marginBottom: Spacing.sm,
  },
  row: { gap: Spacing.sm, paddingRight: Spacing.lg },

  card: {
    width: 220, backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm, ...Shadow.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logo: {
    width: 34, height: 34, borderRadius: 17, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  logoInitials: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.white },
  headBody: { flex: 1 },
  salonName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.black },
  count: { fontSize: FontSize.xs, color: Colors.gray500, marginTop: 1 },

  reward: { fontSize: FontSize.xs, color: Colors.gray500 },

  earnedBadge: {
    alignSelf: 'flex-start', backgroundColor: TINT_EARNED,
    borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4,
  },
  earnedText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.success },
});
