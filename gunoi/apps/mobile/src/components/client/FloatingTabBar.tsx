import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors, FontSize, FontWeight, Shadow } from '../../theme';

const TABS = [
  {
    label: 'Acasă',
    icon: 'home',
    iconOutline: 'home-outline',
    href: '/(client)' as const,
    match: ['/(client)', '/(client)/index'],
  },
  {
    label: 'Programări',
    icon: 'calendar',
    iconOutline: 'calendar-outline',
    href: '/(client)/bookings' as const,
    match: ['/(client)/bookings'],
  },
  {
    label: 'Favorite',
    icon: 'heart',
    iconOutline: 'heart-outline',
    href: '/(client)/favorites' as const,
    match: ['/(client)/favorites'],
  },
] as const;

export default function FloatingTabBar() {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (tab: (typeof TABS)[number]) => {
    // pathname from expo-router looks like "/" or "/bookings" or "/favorites"
    if (pathname === '/' && tab.href === '/(client)') return true;
    return tab.match.some(m => pathname === m.replace('/(client)', '') || pathname === m);
  };

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <BlurView intensity={55} tint="light" style={styles.bar}>
        {TABS.map(tab => {
          const active = isActive(tab);
          return (
            <TouchableOpacity
              key={tab.href}
              style={styles.tab}
              onPress={() => router.push(tab.href)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                <Ionicons
                  name={active ? tab.icon : tab.iconOutline}
                  size={22}
                  color={active ? Colors.primary : Colors.gray500}
                />
              </View>
              <Text style={[styles.label, active && styles.labelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    // Translucent base so the glass reads on Android (no real blur there)
    // and stays frosted-white over photos on iOS.
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 4,
    ...Shadow.lg,
  },
  tab: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 4,
    gap: 3,
    minWidth: 76,
  },
  iconWrap: {
    width: 40,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: Colors.primaryLight,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.gray500,
  },
  labelActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
});
