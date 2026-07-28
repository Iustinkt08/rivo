import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import GlassTabBar, { GlassTab } from '../../components/common/GlassTabBar';
import { Colors } from '../../theme';
import { useIsStaffSession } from '../../store/authStore';

// Business tabs — Calendar / Clienți / Analize / Setări. "Servicii" was removed
// from the bar and now lives inside Settings.
const BUSINESS_TABS: GlassTab[] = [
  {
    name: 'index',
    label: 'Calendar',
    renderIcon: (active) => (
      <Ionicons name="calendar-outline" size={22} color={active ? Colors.primary : Colors.black} />
    ),
  },
  {
    name: 'clients',
    label: 'Clienți',
    renderIcon: (active) => (
      <Ionicons name="people-outline" size={22} color={active ? Colors.primary : Colors.black} />
    ),
  },
  {
    name: 'analytics',
    label: 'Analize',
    renderIcon: (active) => (
      <Ionicons name="bar-chart-outline" size={22} color={active ? Colors.primary : Colors.black} />
    ),
  },
  {
    name: 'settings',
    label: 'Setări',
    renderIcon: (active) => (
      <Ionicons name="settings-outline" size={22} color={active ? Colors.primary : Colors.black} />
    ),
  },
];

// Staff accounts only see their own work: the salon-wide client database is
// owner-only, so the tab disappears entirely in staff mode.
const STAFF_TABS = BUSINESS_TABS.filter((t) => t.name !== 'clients');

export default function BusinessLayout() {
  const isStaffSession = useIsStaffSession();
  const tabs = isStaffSession ? STAFF_TABS : BUSINESS_TABS;

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} tabs={tabs} />}
      screenOptions={{ headerShown: false }}
    >
      {/* Visible tabs — declared first, in BUSINESS_TABS order */}
      <Tabs.Screen name="index" />
      <Tabs.Screen
        name="clients"
        options={isStaffSession ? { href: null } : undefined}
      />
      <Tabs.Screen name="analytics" />
      <Tabs.Screen name="settings" />

      {/* Hidden screens — navigated to programmatically, not shown in the tab bar.
          Services moved into Settings; still reachable via router.push. */}
      <Tabs.Screen name="services" options={{ href: null }} />
      <Tabs.Screen name="salon-settings" options={{ href: null }} />
      <Tabs.Screen name="salon-profile" options={{ href: null }} />
      <Tabs.Screen name="reviews" options={{ href: null }} />
      <Tabs.Screen name="staff-change-password" options={{ href: null }} />
      <Tabs.Screen name="staff-profile" options={{ href: null }} />
      <Tabs.Screen name="discount-codes" options={{ href: null }} />
      <Tabs.Screen name="discount-code-new" options={{ href: null }} />
      <Tabs.Screen name="marketing" options={{ href: null }} />
      <Tabs.Screen name="punch-card" options={{ href: null }} />
    </Tabs>
  );
}
