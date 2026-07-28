import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, FontWeight, Gradients, Radius, Shadow } from '../../theme';

interface Props extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

export default function Button({
  title, variant = 'primary', size = 'md',
  loading, fullWidth, style, disabled, ...rest
}: Props) {
  const s = sizeMap[size];
  const isDisabled = disabled || loading;

  const label = loading ? (
    <ActivityIndicator color={variant === 'primary' ? Colors.white : Colors.primary} />
  ) : (
    <Text style={[styles.text, variantText[variant], s.text]}>{title}</Text>
  );

  // Primary → brand gradient pill
  if (variant === 'primary') {
    return (
      <TouchableOpacity
        activeOpacity={0.88}
        disabled={isDisabled}
        style={[
          styles.shadowWrap,
          fullWidth && { width: '100%' },
          isDisabled && styles.disabled,
          style,
        ]}
        {...rest}
      >
        <LinearGradient
          colors={Gradients.brand}
          start={Gradients.start}
          end={Gradients.end}
          style={[styles.base, s.container]}
        >
          {label}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      disabled={isDisabled}
      style={[
        styles.base,
        variantStyles[variant],
        s.container,
        fullWidth && { width: '100%' },
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {label}
    </TouchableOpacity>
  );
}

const sizeMap = {
  sm: { container: { paddingVertical: 10, paddingHorizontal: 18 }, text: { fontSize: FontSize.sm } },
  md: { container: { paddingVertical: 15, paddingHorizontal: 24 }, text: { fontSize: FontSize.md } },
  lg: { container: { paddingVertical: 18, paddingHorizontal: 32 }, text: { fontSize: FontSize.lg } },
};

const styles = StyleSheet.create({
  shadowWrap: { borderRadius: Radius.pill, ...Shadow.brand },
  base: {
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: { fontWeight: FontWeight.bold },
  disabled: { opacity: 0.45 },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: Colors.primary },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary },
  ghost: { backgroundColor: 'transparent' },
});

const variantText = StyleSheet.create({
  primary: { color: Colors.white },
  outline: { color: Colors.primary },
  ghost: { color: Colors.primary },
});
