import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontWeight } from '../../../theme';
import { HOUR_HEIGHT, RAIL_WIDTH } from './constants';

interface Props {
  startHour: number;
  endHour: number;
}

const LABEL_HEIGHT = 16;

/**
 * Absolute layer of hour hairlines + labels behind the appointment blocks.
 * Labels and lines are positioned INDEPENDENTLY (not nested in a 1px row) so
 * the taller label text is never clipped by a thin container.
 */
export default function TimeRail({ startHour, endHour }: Props) {
  const hours: number[] = [];
  for (let h = startHour; h <= endHour; h++) hours.push(h);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {hours.map((h, i) => {
        const top = i * HOUR_HEIGHT;
        return (
          <React.Fragment key={h}>
            <View style={[styles.line, { top, left: RAIL_WIDTH }]} />
            <Text style={[styles.label, { top: top - LABEL_HEIGHT / 2 }]}>
              {String(h).padStart(2, '0')}:00
            </Text>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    position: 'absolute',
    right: 0,
    height: 1,
    backgroundColor: Colors.border,
  },
  label: {
    position: 'absolute',
    left: 0,
    width: RAIL_WIDTH,
    paddingRight: 8,
    height: LABEL_HEIGHT,
    lineHeight: LABEL_HEIGHT,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: FontWeight.medium,
    color: Colors.gray400,
  },
});
