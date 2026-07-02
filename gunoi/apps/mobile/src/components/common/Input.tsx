import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
}

export default function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  style,
  ...rest
}: InputProps) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrapper, error && styles.inputError]}>
        {leftIcon && (
          <Ionicons name={leftIcon as any} size={20} color={Colors.gray500} style={styles.leftIcon} />
        )}
        <TextInput
          style={[styles.input, leftIcon && styles.inputWithLeftIcon]}
          placeholderTextColor={Colors.gray300}
          {...rest}
        />
        {rightIcon && (
          <Ionicons
            name={rightIcon as any}
            size={20}
            color={Colors.gray500}
            style={styles.rightIcon}
            onPress={onRightIconPress}
          />
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.gray900,
    marginBottom: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.black,
  },
  inputWithLeftIcon: {
    marginLeft: Spacing.sm,
  },
  leftIcon: {
    marginRight: Spacing.sm,
  },
  rightIcon: {
    marginLeft: Spacing.sm,
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    fontSize: FontSize.xs,
    color: Colors.error,
    marginTop: Spacing.sm,
  },
});
