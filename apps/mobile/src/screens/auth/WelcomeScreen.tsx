import React, { useEffect, useRef } from 'react';
import {
  Animated, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, FontWeight, Gradients, Radius, Shadow, Spacing } from '../../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W * 0.56;
const CARD_H = CARD_W * 1.6;
const SPACING = 14;
const SNAP = CARD_W + SPACING;
const SIDE_INSET = (SCREEN_W - CARD_W) / 2;

const DOT_W = 18;
const DOT_GAP = 8;
const DOT_PITCH = DOT_W + DOT_GAP;

const DOTS_TRACK_W = 3 * DOT_W + 2 * DOT_GAP;

const SLIDES = [
  {
    label: 'Tuns',
    uri: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80',
  },
  {
    label: 'Beauty',
    uri: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80',
  },
  {
    label: 'Barber',
    uri: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&q=80',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();

  const scrollX = useRef(new Animated.Value(SNAP)).current;

  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Animated.View style={[styles.container, { opacity, transform: [{ translateY }] }]}>

        {/* Photo carousel — decorative, swipe freely; the CTA always continues */}
        <View style={styles.carouselWrap}>
          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={SNAP}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: SIDE_INSET }}
            contentOffset={{ x: SNAP, y: 0 }}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: true },
            )}
            scrollEventThrottle={16}
          >
            {SLIDES.map((slide, i) => {
              const inputRange = [(i - 1) * SNAP, i * SNAP, (i + 1) * SNAP];
              const scale = scrollX.interpolate({
                inputRange,
                outputRange: [0.88, 1, 0.88],
                extrapolate: 'clamp',
              });
              return (
                <Animated.View
                  key={slide.label}
                  style={[styles.card, { transform: [{ scale }] }, i < SLIDES.length - 1 && { marginRight: SPACING }]}
                >
                  <Image source={{ uri: slide.uri }} style={styles.cardImage} />
                  <View style={styles.cardPill}>
                    <Text style={styles.cardPillText}>{slide.label}</Text>
                  </View>
                </Animated.View>
              );
            })}
          </Animated.ScrollView>

          {/* Dots — the gradient bar follows the scroll position continuously,
              stretching while moving between photos */}
          <View style={styles.dots}>
            <View style={styles.dotsTrack}>
              {SLIDES.map((_, i) => (
                <View key={i} style={styles.dot} />
              ))}
              <Animated.View
                style={[
                  styles.dotIndicator,
                  {
                    transform: [
                      {
                        translateX: scrollX.interpolate({
                          inputRange: [0, (SLIDES.length - 1) * SNAP],
                          outputRange: [0, (SLIDES.length - 1) * DOT_PITCH],
                          extrapolate: 'clamp',
                        }),
                      },
                      {
                        scaleX: scrollX.interpolate({
                          inputRange: [0, SNAP * 0.5, SNAP, SNAP * 1.5, SNAP * 2],
                          outputRange: [1, 1.7, 1, 1.7, 1],
                          extrapolate: 'clamp',
                        }),
                      },
                    ],
                  },
                ]}
              >
                <LinearGradient
                  colors={Gradients.brandSoft}
                  start={Gradients.start}
                  end={Gradients.end}
                  style={styles.dotIndicatorFill}
                />
              </Animated.View>
            </View>
          </View>
        </View>

        {/* Headline */}
        <View style={styles.bottom}>
          <Text style={styles.headline}>
            Rezervă-ți{'\n'}
            <Text style={styles.headlineAccent}>programările</Text>{'\n'}
            fără efort
          </Text>
          <Text style={styles.subheadline}>
            Găsește stiliști de top din zona ta și descoperă stilurile în tendințe.
          </Text>

          <TouchableOpacity
            style={styles.ctaWrap}
            onPress={() => router.push('/(auth)/role-selection')}
            activeOpacity={0.88}
          >
            <LinearGradient colors={Gradients.brand} start={Gradients.start} end={Gradients.end} style={styles.cta}>
              <Text style={styles.ctaText}>Rezervă acum</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginLink} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.loginLinkText}>
              Ai deja cont?{' '}
              <Text style={{ color: Colors.coral, fontWeight: FontWeight.bold }}>Intră în cont</Text>
            </Text>
          </TouchableOpacity>
        </View>

      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },
  container: { flex: 1, justifyContent: 'space-between', paddingTop: Spacing.lg },

  carouselWrap: { marginTop: Spacing.md },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 36,
    overflow: 'hidden',
    backgroundColor: Colors.gray100,
    ...Shadow.md,
  },
  cardImage: { width: '100%', height: '100%' },
  cardPill: {
    position: 'absolute', bottom: 18, alignSelf: 'center',
    backgroundColor: 'rgba(20,20,20,0.62)',
    borderRadius: Radius.full, paddingHorizontal: 26, paddingVertical: 10,
  },
  cardPillText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  dots: { alignItems: 'center', marginTop: Spacing.lg },
  dotsTrack: {
    flexDirection: 'row', gap: DOT_GAP, height: 6,
    width: DOTS_TRACK_W,
  },
  dot: { width: DOT_W, height: 6, borderRadius: 3, backgroundColor: Colors.gray100 },
  dotIndicator: {
    position: 'absolute', left: 0, top: 0,
    width: DOT_W, height: 6, borderRadius: 3, overflow: 'hidden',
  },
  dotIndicatorFill: { flex: 1 },

  bottom: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
  headline: {
    fontSize: 33, fontWeight: FontWeight.heavy, color: Colors.ink,
    lineHeight: 42, letterSpacing: -0.5, marginBottom: 12,
  },
  headlineAccent: { color: Colors.coral },
  subheadline: { fontSize: FontSize.md, color: Colors.gray500, lineHeight: 22, marginBottom: Spacing.lg },

  ctaWrap: { borderRadius: Radius.pill, ...Shadow.brand },
  cta: {
    borderRadius: Radius.pill, paddingVertical: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },

  loginLink: { alignItems: 'center', marginTop: Spacing.md },
  loginLinkText: { fontSize: FontSize.sm, color: Colors.gray500 },
});
