import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View, ViewStyle,
} from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import GlassView from './GlassView';
import { Colors, FontWeight } from '../../theme';

// ─── Public tab config ────────────────────────────────────────────────────────
// Each consumer (client / business) supplies its own tabs. `renderIcon` receives
// the active state so the caller controls its own icon set (SVG, Ionicons, …).
export interface GlassTab {
  name: string;
  label: string;
  renderIcon: (active: boolean) => React.ReactNode;
}

// Apple-like spring: responsive snap, light terminal bounce.
const SPRING = { damping: 20, stiffness: 220, mass: 0.85 };

// ─── GlassPill subcomponent ───────────────────────────────────────────────────

interface GlassPillProps {
  pillX: SharedValue<number>;
  pillOpacity: SharedValue<number>;
  slotWidth: number;
}

function GlassPill({ pillX, pillOpacity, slotWidth }: GlassPillProps) {
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    opacity: pillOpacity.value,
  }));

  return (
    // Outer wrapper carries the transform + soft shadow (no clipping, so the shadow shows).
    <Animated.View
      style={[styles.glassPillShadow, { width: slotWidth }, animStyle]}
      pointerEvents="none"
    >
      {/* Inner clipped capsule: frosted blur + brand tint + crisp hairline border. */}
      <View style={styles.glassPillClip} pointerEvents="none">
        {/* Denser frost than the bar so the capsule reads as a distinct glass element */}
        <BlurView intensity={55} tint="light" style={StyleSheet.absoluteFill} />
        {/* Faint brand tint separates the pill from the lighter, see-through bar */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pillTint]} />
      </View>
    </Animated.View>
  );
}

// ─── GlassTabBar ──────────────────────────────────────────────────────────────

export default function GlassTabBar({
  state,
  navigation,
  descriptors,
  tabs,
}: BottomTabBarProps & { tabs: GlassTab[] }) {
  const insets = useSafeAreaInsets();
  const TAB_COUNT = tabs.length;

  // Respect the standard per-screen `tabBarStyle: { display: 'none' }` option —
  // full-screen flows (booking) need the bottom area for their own CTA.
  const focusedKey = state.routes[state.index]?.key;
  const focusedOptions = focusedKey ? descriptors[focusedKey]?.options : undefined;
  const isBarHidden =
    (StyleSheet.flatten(focusedOptions?.tabBarStyle) as ViewStyle | undefined)
      ?.display === 'none';

  // Map the CURRENT route to one of the visible tab slots. Hidden (href:null)
  // screens are NOT in `tabs`, so tabIndex is -1 for them — we must NOT translate
  // the pill to an out-of-range slot.
  const currentName = state.routes[state.index]?.name;
  const tabIndex = tabs.findIndex((t) => t.name === currentName);
  const onTab = tabIndex >= 0;

  // Inner row width measured after first layout.
  const [barWidth, setBarWidth] = useState(0);
  const slotWidth = barWidth > 0 ? barWidth / TAB_COUNT : 0;

  // Visual index drives icon/label color (-1 = no tab active). May differ briefly
  // from tabIndex while dragging.
  const [visualIndex, setVisualIndex] = useState(tabIndex);

  // Shared values used in worklets.
  const pillX       = useSharedValue(0);
  const pillOpacity = useSharedValue(onTab ? 1 : 0);
  const slotWidthSV = useSharedValue(0);
  const dragStartX  = useSharedValue(0);

  // Stable ref so worklet callbacks always see current nav/state without capturing stale closures.
  // `tabs` is included because the visible tab list can be shorter than
  // `state.routes` (e.g. staff mode hides a tab): a tab's position in `tabs`
  // is NOT its index in `state.routes`, so navigation must resolve by name.
  const navRef = useRef({ state, navigation, tabs });
  navRef.current = { state, navigation, tabs };

  // Sync pill to navigation-driven route changes (deep links, programmatic navigation, etc.)
  // and to the first layout when slotWidth becomes known.
  useEffect(() => {
    if (slotWidth <= 0) return;
    slotWidthSV.value = slotWidth;
    if (tabIndex >= 0) {
      // On a real tab: slide pill to its slot and mark it active.
      pillX.value = withSpring(tabIndex * slotWidth, SPRING);
      pillOpacity.value = withTiming(1, { duration: 160 });
      setVisualIndex(tabIndex);
    } else {
      // On a hidden, non-tab screen: hide the pill, no tab active. Leave pillX
      // where it is (a safe in-range value) so it never flies off-screen.
      pillOpacity.value = withTiming(0, { duration: 160 });
      setVisualIndex(-1);
    }
  }, [tabIndex, slotWidth]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width);
  }, []);

  // Called from the UI thread via runOnJS to update label/icon color during drag.
  const setVI = useCallback((i: number) => setVisualIndex(i), []);

  // Called from the UI thread via runOnJS when drag ends.
  const snapAndNavigate = useCallback((index: number) => {
    const { state: s, navigation: nav, tabs: t } = navRef.current;
    // `index` is a slot in the visible `tabs` array — resolve the real route by
    // name, since hidden tabs make positions diverge from `state.routes`.
    const route = s.routes.find((r) => r.name === t[index]?.name);
    if (!route) return;
    const event = nav.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented) nav.navigate(route.name);
  }, []);

  // Pan gesture: drag pill horizontally; snap to nearest tab on release.
  const panGesture = Gesture.Pan()
    .activeOffsetX([-8, 8])      // require 8 px horizontal intent before stealing from taps
    .onBegin(() => {
      dragStartX.value = pillX.value;
    })
    .onChange((e) => {
      const sw = slotWidthSV.value;
      if (sw === 0) return;
      const next = Math.max(0, Math.min(dragStartX.value + e.translationX, (TAB_COUNT - 1) * sw));
      pillX.value = next;
      // A deliberate drag reveals the pill even if we started on a hidden screen.
      pillOpacity.value = 1;
      // Update visual active index as the pill crosses midpoints.
      runOnJS(setVI)(Math.round(next / sw));
    })
    .onEnd(() => {
      const sw = slotWidthSV.value;
      if (sw === 0) return;
      const nearest = Math.max(0, Math.min(Math.round(pillX.value / sw), TAB_COUNT - 1));
      pillX.value = withSpring(nearest * sw, SPRING);
      runOnJS(snapAndNavigate)(nearest);
    });

  // Normal tap handler: reveal + animate pill, then navigate.
  const handleTabPress = useCallback((index: number) => {
    const sw = slotWidthSV.value;
    if (sw > 0) pillX.value = withSpring(index * sw, SPRING);
    pillOpacity.value = withTiming(1, { duration: 160 });
    setVisualIndex(index);
    const { state: s, navigation: nav, tabs: t } = navRef.current;
    // Resolve by name: the tapped slot's index in `tabs` is not its index in
    // `state.routes` when a tab is hidden (staff mode).
    const route = s.routes.find((r) => r.name === t[index]?.name);
    if (!route) return;
    const event = nav.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented && s.routes[s.index]?.key !== route.key) {
      nav.navigate(route.name);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // After all hooks, so the hook order stays stable across renders.
  if (isBarHidden) return null;

  return (
    <View style={[styles.wrapper, { bottom: Math.max(insets.bottom - 8, 6) }]} pointerEvents="box-none">
      <GlassView radius={37} intensity={30} style={styles.bar}>
        <GestureDetector gesture={panGesture}>
          <View style={styles.innerRow} onLayout={handleLayout}>

            {/* Single shared animated glass pill — sits behind all tab buttons.
                Hidden (opacity 0) when the current route is not one of the tabs. */}
            {slotWidth > 0 && (
              <GlassPill pillX={pillX} pillOpacity={pillOpacity} slotWidth={slotWidth} />
            )}

            {/* Tab buttons */}
            {tabs.map((tab, index) => {
              const route = state.routes.find((r) => r.name === tab.name);
              if (!route) return null;
              const active = visualIndex === index;
              const labelColor = active ? Colors.primary : Colors.black;

              return (
                <TouchableOpacity
                  key={tab.name}
                  style={styles.tab}
                  activeOpacity={0.8}
                  onPress={() => handleTabPress(index)}
                >
                  <View style={styles.pill}>
                    {tab.renderIcon(active)}
                    <Text style={[styles.label, { color: labelColor }]}>
                      {tab.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

          </View>
        </GestureDetector>
      </GlassView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  // Layout only — GlassView supplies the frosted fill, border, and shadow.
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '92%',
    maxWidth: 415,
    height: 69,
    paddingHorizontal: 6,
  },
  // Full-width flex row inside the bar; glass pill and tab buttons live here.
  innerRow: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
  },
  // ── Animated glass pill ──────────────────────────────────────────────────────
  // Outer wrapper: positioning + transform + soft shadow (NOT clipped, so the
  // shadow renders and the capsule visibly floats above the bar).
  glassPillShadow: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
  },
  // Inner capsule: clips the blur + tint and draws a crisp specular border.
  glassPillClip: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
    // Crisper highlight border so the capsule edge separates from the bar.
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  pillTint: {
    borderRadius: 28,
    // Faint brand tint (Colors.primary @ ~10%) gives clear separation from the white bar.
    backgroundColor: 'rgba(162,41,33,0.1)',
  },
  // ── Per-tab layout ────────────────────────────────────────────────────────────
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    height: 60,
    width: '100%',
    maxWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 30,
  },
  label: {
    fontSize: 11,
    fontWeight: FontWeight.medium,
  },
});
