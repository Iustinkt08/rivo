import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, FontWeight, Radius } from '../../../theme';
import { localDateKey } from '../../../utils/calendarLayout';

interface DayCell {
  key: string;
  dayName: string;
  dayNum: string;
  isToday: boolean;
}

// 14-day window centred a few days back so the user can scroll recent + upcoming.
function buildWeekDays(baseDate: Date): DayCell[] {
  const todayKey = localDateKey(new Date());
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - 3 + i);
    const key = localDateKey(d);
    return {
      key,
      dayName: d.toLocaleDateString('ro-RO', { weekday: 'short' }),
      dayNum: String(d.getDate()).padStart(2, '0'),
      isToday: key === todayKey,
    };
  });
}

interface Props {
  selectedDate: string;
  onSelect: (key: string) => void;
}

export default function WeekStrip({ selectedDate, onSelect }: Props) {
  const days = buildWeekDays(new Date());
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.strip}
    >
      {days.map((d) => {
        const active = selectedDate === d.key;
        return (
          <TouchableOpacity
            key={d.key}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(d.key)}
            activeOpacity={0.85}
          >
            <Text style={[styles.name, active && styles.activeText]}>{d.dayName}</Text>
            <Text style={[styles.num, active && styles.activeText]}>{d.dayNum}</Text>
            {d.isToday && <View style={[styles.dot, active && styles.dotActive]} />}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // A horizontal ScrollView needs a bounded height, otherwise it greedily
  // expands vertically inside a flex column and pushes the timeline down.
  scroll: { flexGrow: 0, height: 88 },
  strip: { paddingHorizontal: 20, gap: 8, paddingVertical: 4 },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 54,
    height: 72,
    borderRadius: Radius.lg,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  name: { fontSize: 10, color: Colors.gray500, fontWeight: FontWeight.semibold, textTransform: 'uppercase' },
  num: { fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black, marginTop: 2 },
  activeText: { color: Colors.white },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.primary, marginTop: 3 },
  dotActive: { backgroundColor: Colors.white },
});
