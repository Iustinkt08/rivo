import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';
import {
  formatPunchReward,
  loyaltyApi,
  PunchProgress,
} from '../../services/api/loyalty';
import PunchDots from '../common/PunchDots';

// Matches the ClientSheet card styling (SUBTLE_BORDER there).
const SUBTLE_BORDER = 'rgba(216,216,216,0.8)';
const MUTED_TEXT = 'rgba(34,34,34,0.65)';
const TINT_EARNED = '#EAF7EE';

interface Props {
  salonId: string;
  clientId: string;
}

/**
 * "Card de fidelitate" mini-card for the ClientSheet extension slot: fetches
 * the client's punch progress lazily when the sheet opens (mount) and renders
 * nothing while loading fails or the salon has no active punch card.
 */
export default function PunchProgressSection({ salonId, clientId }: Props) {
  const [progress, setProgress] = useState<PunchProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loyaltyApi
      .getClientPunchProgress(salonId, clientId)
      .then((p) => { if (!cancelled) setProgress(p); })
      .catch(() => { /* silent — the section simply stays hidden */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [salonId, clientId]);

  if (loading) {
    return (
      <View style={[styles.card, styles.loadingCard]}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }
  if (!progress?.active || progress.requiredVisits == null) return null;

  const { completedVisits, requiredVisits, earned } = progress;
  const shownVisits = Math.min(completedVisits, requiredVisits);
  const rewardLabel = formatPunchReward(progress.rewardType, progress.rewardValue);

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Ionicons name="ribbon-outline" size={15} color={Colors.primary} />
        <Text style={styles.title}>Card de fidelitate</Text>
        <Text style={styles.count}>{shownVisits}/{requiredVisits} vizite</Text>
      </View>

      <PunchDots completed={completedVisits} required={requiredVisits} />

      <Text style={styles.reward}>
        Recompensă: {rewardLabel} la fiecare {requiredVisits} vizite
      </Text>

      {earned && (
        <View style={styles.earnedPill}>
          <Ionicons name="gift-outline" size={13} color={Colors.success} />
          <Text style={styles.earnedText}>
            Recompensă disponibilă la următoarea programare
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl, borderWidth: 1, borderColor: SUBTLE_BORDER,
    backgroundColor: Colors.white, padding: Spacing.md, marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  loadingCard: { alignItems: 'center', paddingVertical: Spacing.md },

  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink },
  count: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },

  reward: { fontSize: FontSize.xs, color: MUTED_TEXT },

  earnedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: TINT_EARNED, borderRadius: Radius.md,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  earnedText: {
    flex: 1, fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.success,
  },
});
