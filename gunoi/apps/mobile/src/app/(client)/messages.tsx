import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import GradientText from '../../components/common/GradientText';
import { Colors, FontSize, FontWeight, Gradients, Spacing } from '../../theme';

// Placeholder until a messaging backend exists — keeps the Figma 4-tab bar wired.
export default function MessagesScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <GradientText colors={['#6C0000', '#EF6351']} style={styles.title}>Messages</GradientText>

      <View style={styles.center}>
        <LinearGradient colors={Gradients.brand} start={Gradients.start} end={Gradients.end} style={styles.iconWrap}>
          <Ionicons name="chatbubble-ellipses-outline" size={34} color={Colors.white} />
        </LinearGradient>
        <Text style={styles.emptyTitle}>Niciun mesaj încă</Text>
        <Text style={styles.emptyText}>
          Conversațiile cu saloanele tale vor apărea aici după prima programare.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },
  title: { fontSize: 20, fontWeight: FontWeight.semibold, marginLeft: 28, marginTop: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, marginTop: -60 },
  iconWrap: {
    width: 84, height: 84, borderRadius: 42,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg,
  },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.ink, marginBottom: 8 },
  emptyText: { fontSize: FontSize.md, color: Colors.gray500, textAlign: 'center', lineHeight: 22 },
});
