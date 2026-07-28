import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Colors } from '../../../theme';
import { RAIL_WIDTH } from './constants';

/** Red "current time" line. Parent positions it via `top` and controls visibility. */
export default function NowIndicator({ top }: { top: number }) {
  return (
    <View style={[styles.wrap, { top }]} pointerEvents="none">
      <View style={styles.dot} />
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: RAIL_WIDTH - 4,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.primary,
    borderRadius: 1,
  },
});
