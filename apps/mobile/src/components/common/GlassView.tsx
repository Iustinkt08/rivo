import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

interface Props extends ViewProps {
  /** Blur strength (expo-blur). Higher = frostier. */
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  /** Corner radius for the glass + its clip. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Liquid-glass container: a frosted blur layer + a hairline highlight border +
 * a soft drop shadow. The caller supplies layout (size, flexDirection, padding)
 * via `style`; the blur + tint sit behind the children.
 *
 * expo-blur renders a real material on iOS; Android's blur is weaker, so we lean
 * on a more opaque translucent fill there to keep contrast.
 */
export default function GlassView({
  intensity = 60,
  tint = 'light',
  radius = 37,
  style,
  children,
  ...rest
}: Props) {
  // On iOS we rely on the real BlurView material; a heavy overlay kills the blur,
  // so we keep the white tint light to stay clearly see-through (content shows through).
  // On Android the blur is weaker, so a more opaque fill keeps contrast.
  const overlayOpacity = Platform.OS === 'android' ? 0.8 : 0.14;

  return (
    <View style={[styles.shadow, { borderRadius: radius }, style]} {...rest}>
      <BlurView
        intensity={intensity}
        tint={tint}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }, styles.clip]}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            backgroundColor: `rgba(255,255,255,${overlayOpacity})`,
          },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  clip: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
});
