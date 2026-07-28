import React, { useMemo } from 'react';
import { GestureResponderEvent, Pressable, StyleSheet, View } from 'react-native';
// Gesture-handler's ScrollView coordinates with the blocks' long-press pan:
// once a drag activates, the scroll yields instead of fighting the gesture.
import { ScrollView } from 'react-native-gesture-handler';
import type { BusinessAppointment } from '../../../store/businessStore';
import {
  layoutAppointments, isoToMinutes, minutesToHHMM, dragOffsetToStartMin, localDateKey,
} from '../../../utils/calendarLayout';
import TimeRail from './TimeRail';
import NowIndicator from './NowIndicator';
import AppointmentBlock from './AppointmentBlock';
import {
  START_HOUR, END_HOUR, DAY_START_MIN, DAY_END_MIN,
  PX_PER_MIN, HOUR_HEIGHT, RAIL_WIDTH, SLOT_SNAP_MIN, MIN_BLOCK_HEIGHT,
} from './constants';

interface Props {
  appointments: BusinessAppointment[];
  selectedDate: string; // YYYY-MM-DD
  onBlockPress: (a: BusinessAppointment) => void;
  onEmptySlotPress: (hhmm: string) => void;
  /** Long-press drag finished: the appointment and its snapped new start minute. */
  onBlockDragEnd?: (a: BusinessAppointment, newStartMin: number) => void;
}

const LANE_GAP_PCT = 1.5;

// Only not-yet-final appointments may be moved (mirrors the server rule).
const RESCHEDULABLE = new Set(['PENDING', 'CONFIRMED']);

export default function Timeline({
  appointments, selectedDate, onBlockPress, onEmptySlotPress, onBlockDragEnd,
}: Props) {
  const bodyHeight = (DAY_END_MIN - DAY_START_MIN) * PX_PER_MIN + HOUR_HEIGHT / 2;

  const positioned = useMemo(
    () =>
      layoutAppointments(appointments, {
        getStartMin: (a) => isoToMinutes(a.startAt),
        getEndMin: (a) => isoToMinutes(a.endAt),
        dayStartMin: DAY_START_MIN,
        pxPerMin: PX_PER_MIN,
        minHeight: MIN_BLOCK_HEIGHT,
      }),
    [appointments],
  );

  const todayKey = localDateKey(new Date());
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = selectedDate === todayKey && nowMin >= DAY_START_MIN && nowMin <= DAY_END_MIN;
  const nowTop = (nowMin - DAY_START_MIN) * PX_PER_MIN;

  const handleEmptyPress = (e: GestureResponderEvent) => {
    const y = e.nativeEvent.locationY;
    const rawMin = DAY_START_MIN + y / PX_PER_MIN;
    const snapped = Math.round(rawMin / SLOT_SNAP_MIN) * SLOT_SNAP_MIN;
    const clamped = Math.max(DAY_START_MIN, Math.min(snapped, DAY_END_MIN - SLOT_SNAP_MIN));
    onEmptySlotPress(minutesToHHMM(clamped));
  };

  const handleDragEnd = (appt: BusinessAppointment, offsetPx: number) => {
    if (!onBlockDragEnd) return;
    const startMin = isoToMinutes(appt.startAt);
    const durationMin = Math.max(isoToMinutes(appt.endAt) - startMin, SLOT_SNAP_MIN);
    const newStartMin = dragOffsetToStartMin(startMin, offsetPx, {
      pxPerMin: PX_PER_MIN,
      snapMin: SLOT_SNAP_MIN,
      dayStartMin: DAY_START_MIN,
      dayEndMin: DAY_END_MIN,
      durationMin,
    });
    if (newStartMin !== startMin) onBlockDragEnd(appt, newStartMin);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 12, paddingBottom: 140 }}>
      <View style={{ height: bodyHeight }}>
        {/* Hour lines + labels */}
        <TimeRail startHour={START_HOUR} endHour={END_HOUR} />

        {/* Tap layer for empty slots — sits under the blocks */}
        <Pressable style={[StyleSheet.absoluteFill, { left: RAIL_WIDTH }]} onPress={handleEmptyPress} />

        {/* Appointment blocks — box-none lets empty taps fall through to the Pressable */}
        <View style={[StyleSheet.absoluteFill, { left: RAIL_WIDTH }]} pointerEvents="box-none">
          {positioned.map((p) => {
            const widthPct = 100 / p.laneCount - (p.laneCount > 1 ? LANE_GAP_PCT : 0);
            const leftPct = (100 / p.laneCount) * p.laneIndex;
            return (
              <AppointmentBlock
                key={p.item.id}
                appt={p.item}
                top={p.top}
                height={p.height}
                leftPct={leftPct}
                widthPct={widthPct}
                onPress={() => onBlockPress(p.item)}
                draggable={!!onBlockDragEnd && RESCHEDULABLE.has(p.item.status)}
                onDragEnd={(offsetPx) => handleDragEnd(p.item, offsetPx)}
              />
            );
          })}
        </View>

        {/* Now indicator */}
        {showNow && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <NowIndicator top={nowTop} />
          </View>
        )}
      </View>
    </ScrollView>
  );
}
