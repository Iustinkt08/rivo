import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontWeight, Gradients } from '../../theme';
import Logo from '../../components/common/Logo';

export default function SplashScreen() {
  const router = useRouter();

  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.72)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start(() => {
      Animated.timing(taglineOpacity, { toValue: 1, duration: 400, delay: 100, useNativeDriver: true }).start();
    });

    const timer = setTimeout(() => router.replace('/(auth)/welcome'), 2200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      {/* Soft brand wash in the corners */}
      <LinearGradient
        colors={['#FCEAE6', '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.logoWrap, { opacity, transform: [{ scale }] }]}>
        <Logo variant="full" size={168} />
      </Animated.View>

      <Animated.View style={{ opacity: taglineOpacity, alignItems: 'center' }}>
        <Animated.Text style={styles.tagline}>Frumusețea, la un tap distanță.</Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  logoWrap: { marginBottom: 8 },
  tagline: { fontSize: 15, color: Colors.gray500, letterSpacing: 0.2, fontWeight: FontWeight.medium },
});
