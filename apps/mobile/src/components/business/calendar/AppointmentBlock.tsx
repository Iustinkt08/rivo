import React, { useCallback } from 'react';
import { DimensionValue, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Colors, FontWeight, Radius } from '../../../theme';
import type { BusinessAppointment } from '../../../store/businessStore';
import { SOURCE_COLORS, STATUS_COLORS } from './constants';

interface Props {
  appt: BusinessAppointment;
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
  onPress: () => void;
  /** PENDING/CONFIRMED blocks can be long-press dragged to a new time. */
  draggable?: boolean;
  /** Raw vertical drag offset (px) when a long-press drag ends. */
  onDragEnd?: (offsetPx: number) => void;
}

// Hold this long before the block starts following the finger. Long enough to
// keep normal timeline scrolling untouched, short enough to feel responsive.
const LONG_PRESS_ACTIVATION_MS = 300;
const SETTLE_MS = 160;

const pct = (n: number): DimensionValue => `${n}%`;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

/** A single positioned appointment block on the timeline. */
export default function AppointmentBlock({
  appt, top, height, leftPct, widthPct, onPress, draggable = false, onDragEnd,
}: Props) {
  const barColor = SOURCE_COLORS[appt.source] ?? Colors.primary;
  const statusColor = STATUS_COLORS[appt.status] ?? Colors.gray500;
  const blockHeight = Math.max(height - 3, 22);
  const compact = blockHeight < 46;

  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const finishDrag = useCallback(
    (offsetPx: number) => { onDragEnd?.(offsetPx); },
    [onDragEnd],
  );

  // Long-press arms the drag; the surrounding gesture-handler ScrollView yields
  // once the pan activates, so the block follows the finger instead of scrolling.
  const panGesture = Gesture.Pan()
    .enabled(draggable && !!onDragEnd)
    .activateAfterLongPress(LONG_PRESS_ACTIVATION_MS)
    .onStart(() => {
      isDragging.value = true;
    })
    .onChange((e) => {
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      runOnJS(finishDrag)(e.translationY);
    })
    .onFinalize(() => {
      // Runs on end AND on cancellation — always settle back; the optimistic
      // data update (if the move is confirmed) repositions the block via `top`.
      isDragging.value = false;
      translateY.value = withTiming(0, { duration: SETTLE_MS });
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: withTiming(isDragging.value ? 1.04 : 1, { duration: 120 }) },
    ],
    zIndex: isDragging.value ? 20 : 0,
    shadowOpacity: withTiming(isDragging.value ? 0.28 : 0.06, { duration: 120 }),
    elevation: isDragging.value ? 8 : 2,
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          styles.block,
          { top, height: blockHeight, left: pct(leftPct), width: pct(widthPct) },
          animStyle,
        ]}
      >
        <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.touch}>
          <View style={[styles.bar, { backgroundColor: barColor }]} />
          <View style={styles.body}>
            <View style={styles.topRow}>
              <Text style={styles.time} numberOfLines={1}>{formatTime(appt.startAt)}</Text>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            </View>
            <Text style={styles.client} numberOfLines={1}>{appt.clientName}</Text>
            {!compact && (
              <Text style={styles.service} numberOfLines={1}>
                {appt.serviceName}{appt.staffName ? ` · ${appt.staffName}` : ''}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  block: {
    position: 'absolute',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    overflow: 'hidden',
    // Base shadow mirrors theme Shadow.sm; opacity/elevation animate while dragging.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  touch: { flex: 1, flexDirection: 'row' },
  bar: { width: 4 },
  body: { flex: 1, paddingHorizontal: 8, paddingVertical: 5 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  time: { fontSize: 11, fontWeight: FontWeight.bold, color: Colors.gray700 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  client: { fontSize: 13, fontWeight: FontWeight.bold, color: Colors.black, marginTop: 1 },
  service: { fontSize: 11, color: Colors.gray500, marginTop: 1 },
});
