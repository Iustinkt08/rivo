import React from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors, FontWeight } from '../../theme';

/**
 * NAVIRA logo.
 *
 * The PNG is the full self-contained brand mark (the "N." already spells "Navira").
 * `mark` / `full` render the real logo image; `wordmark` renders gradient-style text
 * for the rare case you only want the name (e.g. a compact one-line lockup).
 */
const NAVIRA_MARK = require('../../assets/navira-logo.png');

type Variant = 'full' | 'mark' | 'wordmark';

interface Props {
  variant?: Variant;
  size?: number;          // height of the mark in px
  tint?: 'dark' | 'light'; // wordmark color — 'light' for use on gradient/dark bg
  style?: ViewStyle;
}

export default function Logo({ variant = 'full', size = 40, tint = 'dark', style }: Props) {
  if (variant === 'wordmark') {
    const wordColor = tint === 'light' ? Colors.white : Colors.ink;
    const dotColor = tint === 'light' ? Colors.white : Colors.coral;
    return (
      <View style={style}>
        <Text style={[styles.word, { color: wordColor, fontSize: size * 0.62 }]}>
          NAVIRA<Text style={{ color: dotColor }}>.</Text>
        </Text>
      </View>
    );
  }

  // `mark` and `full` both render the real logo (it already includes the wordmark)
  return (
    <View style={style}>
      <Image source={NAVIRA_MARK} style={{ width: size, height: size }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  word: {
    fontWeight: FontWeight.heavy,
    letterSpacing: 1.5,
    includeFontPadding: false,
  },
});
