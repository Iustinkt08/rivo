import React from 'react';
import { StyleProp, Text, TextProps, TextStyle, View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

interface Props extends TextProps {
  /** Gradient stops, left→right by default. Figma brand title = #6C0000 → #EF6351. */
  colors?: readonly [string, string, ...string[]];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: StyleProp<TextStyle>;
  children: string;
}

/**
 * Text filled with a linear gradient (used for the brand section titles and the
 * active tab label). Implemented with MaskedView so the gradient fills the exact
 * glyph shapes — matching the Figma `bg-clip-text` titles.
 */
export default function GradientText({
  colors = ['#6C0000', '#EF6351'],
  start = { x: 0, y: 0 },
  end = { x: 1, y: 0 },
  style,
  children,
  ...rest
}: Props) {
  return (
    <MaskedView
      maskElement={
        <Text {...rest} style={style}>
          {children}
        </Text>
      }
    >
      {/* The gradient is clipped to the text; keep the text transparent but
          present (via opacity:0) so the mask gets the right layout size. */}
      <LinearGradient colors={colors} start={start} end={end}>
        <Text {...rest} style={[style, { opacity: 0 }]}>
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
}
