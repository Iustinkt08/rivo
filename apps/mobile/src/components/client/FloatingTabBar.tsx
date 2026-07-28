import React from 'react';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import GlassTabBar, { GlassTab } from '../common/GlassTabBar';
import { Colors } from '../../theme';

import HomeIcon from '../../assets/icons/home/home.svg';
import SearchIcon from '../../assets/icons/home/search.svg';
import BookingIcon from '../../assets/icons/home/booking.svg';
import ProfileIcon from '../../assets/icons/home/profile.svg';

// Client tabs — Home / Search / Booking / Profile. Icon color follows the active
// state so the glass pill and the active label stay in sync.
const CLIENT_TABS: GlassTab[] = [
  {
    name: 'index',
    label: 'Home',
    renderIcon: (active) => (
      <HomeIcon width={22} height={22} color={active ? Colors.primary : Colors.black} />
    ),
  },
  {
    name: 'search',
    label: 'Search',
    renderIcon: (active) => (
      <SearchIcon width={22} height={22} color={active ? Colors.primary : Colors.black} />
    ),
  },
  {
    name: 'bookings',
    label: 'Booking',
    renderIcon: (active) => (
      <BookingIcon width={22} height={22} color={active ? Colors.primary : Colors.black} />
    ),
  },
  {
    name: 'profile',
    label: 'Profile',
    renderIcon: (active) => (
      <ProfileIcon width={20} height={22} color={active ? Colors.primary : Colors.black} />
    ),
  },
];

export default function FloatingTabBar(props: BottomTabBarProps) {
  return <GlassTabBar {...props} tabs={CLIENT_TABS} />;
}
