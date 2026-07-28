import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontSize, FontWeight, Radius, Shadow } from '../../theme';

interface RatingMarkerProps {
  rating: number;
  selected?: boolean;
}

export default function RatingMarker({ rating, selected }: RatingMarkerProps) {
  return (
    <View style={[styles.bubble, selected && styles.selected]}>
      <Text style={styles.text}>{rating.toFixed(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    backgroundColor: Colors.black,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 2,
    borderColor: Colors.white,
    ...Shadow.sm,
  },
  selected: {
    backgroundColor: Colors.primary,
  },
  text: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
});
