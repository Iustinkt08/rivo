import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Colors } from '../../theme';

// Beyond this many visits the dots stop being readable — the row keeps a fixed
// dot count and fills proportionally; the "X/N" text stays exact.
const MAX_DOTS = 12;

interface Props {
  completed: number;
  required: number;
  /** Dot diameter in px (default 10). */
  size?: number;
}

/**
 * Punch-card progress dots (●●●○○): filled = Colors.primary, empty = gray300.
 * Display is capped — completed never overflows required, and configs above
 * MAX_DOTS visits collapse to a proportional 12-dot row.
 */
export default function PunchDots({ completed, required, size = 10 }: Props) {
  if (required <= 0) return null;

  const capped = Math.min(Math.max(completed, 0), required);
  const dotCount = Math.min(required, MAX_DOTS);
  const filled = Math.round((capped / required) * dotCount);
  const dotStyle = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View style={styles.row}>
      {Array.from({ length: dotCount }, (_, i) => (
        <View
          key={i}
          style={[dotStyle, i < filled ? styles.filled : styles.empty]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  filled: { backgroundColor: Colors.primary },
  empty: { backgroundColor: Colors.gray300 },
});
