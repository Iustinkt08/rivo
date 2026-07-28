import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Colors, Radius, Spacing } from '../../theme';

function Bone({ width, height, style }: { width: number | string; height: number; style?: object }) {
  return <View style={[styles.bone, { width: width as any, height }, style]} />;
}

export function SkeletonCardVertical() {
  const anim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View style={[styles.vertical, { opacity: anim }]}>
      <Bone width="100%" height={130} style={{ borderRadius: 0 }} />
      <View style={styles.infoV}>
        <Bone width="75%" height={14} style={{ marginBottom: 8 }} />
        <Bone width="55%" height={11} style={{ marginBottom: 6 }} />
        <Bone width="40%" height={11} />
      </View>
    </Animated.View>
  );
}

export function SkeletonCardHorizontal() {
  const anim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View style={[styles.horizontal, { opacity: anim }]}>
      <Bone width={100} height={100} style={{ borderRadius: 0 }} />
      <View style={styles.infoH}>
        <Bone width="70%" height={14} style={{ marginBottom: 8 }} />
        <Bone width="45%" height={11} style={{ marginBottom: 6 }} />
        <Bone width="60%" height={11} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bone: {
    backgroundColor: Colors.gray100,
    borderRadius: Radius.sm,
  },
  vertical: {
    width: 200,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    marginRight: Spacing.md,
    overflow: 'hidden',
  },
  infoV: {
    padding: Spacing.sm + 2,
  },
  horizontal: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  infoH: {
    flex: 1,
    padding: Spacing.sm + 2,
    justifyContent: 'center',
  },
});
