import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';

interface Props {
  /** Extra style (typically sizing) merged over the filling container. */
  style?: StyleProp<ViewStyle>;
  /** Icon size in px. Defaults to 28. */
  size?: number;
  /** Rounds the corners: `true` uses Radius.lg, a number applies that radius. */
  rounded?: boolean | number;
}

/**
 * Branded fallback shown in the Client app wherever a salon has no image.
 * Fills its container with a soft brand tint, a centered icon and a muted
 * "No photo yet" label. Never renders a broken/blank image.
 */
export default function NoPhotoPlaceholder({ style, size = 28, rounded }: Props) {
  const radiusStyle: ViewStyle | null =
    rounded === undefined || rounded === false
      ? null
      : { borderRadius: rounded === true ? Radius.lg : rounded, overflow: 'hidden' };

  return (
    <View style={[styles.container, radiusStyle, style]}>
      <Ionicons name="image-outline" size={size} color={Colors.primary} />
      <Text style={styles.text} numberOfLines={1}>No photo yet</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primaryLight,
  },
  text: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.gray500,
  },
});
