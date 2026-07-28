import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Router } from 'expo-router';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';

/**
 * Shared back behavior for every settings-related screen: pop when there is
 * history, otherwise land on the business settings tab (deep links, resets).
 */
export function backToSettings(router: Router) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/(business)/settings');
  }
}

interface Props {
  title: string;
  /** Optional right-side action (e.g. an add button). Defaults to a spacer. */
  right?: React.ReactNode;
}

/**
 * Reusable settings header: back chevron (top-left) + centered title.
 * Back always works — router.back() with a fallback to the settings tab.
 */
export default function SettingsHeader({ title, right }: Props) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => backToSettings(router)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Înapoi"
      >
        <Ionicons name="chevron-back" size={22} color={Colors.black} />
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {right ?? <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gray50,
    borderRadius: Radius.full,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.black,
    marginHorizontal: Spacing.sm,
  },
  spacer: { width: 38 },
});
