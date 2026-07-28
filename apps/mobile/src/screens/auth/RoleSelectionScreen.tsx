import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, FontWeight, Gradients, Radius, Shadow, Spacing } from '../../theme';

const ROLES = [
  {
    id: 'CLIENT' as const,
    icon: 'person-outline' as const,
    title: 'Client',
    route: '/(auth)/client-onboarding',
  },
  {
    id: 'ADMIN_SALON' as const,
    icon: 'storefront-outline' as const,
    title: 'Proprietar de salon',
    route: '/(auth)/salon-onboarding',
  },
];

export default function RoleSelectionScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>

        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.ink} />
        </TouchableOpacity>

        <Text style={styles.title}>Selectează rolul!</Text>
        <Text style={styles.subtitle}>Alege cum vrei să folosești NAVIRA</Text>

        {/* Hero illustration */}
        <View style={styles.heroWrap}>
          <View style={styles.heroBlob}>
            <LinearGradient colors={Gradients.brand} start={Gradients.start} end={Gradients.end} style={styles.heroCircle}>
              <Ionicons name="cut" size={42} color={Colors.white} />
            </LinearGradient>
            <View style={[styles.heroMini, styles.heroMiniLeft]}>
              <Ionicons name="sparkles" size={16} color={Colors.coral} />
            </View>
            <View style={[styles.heroMini, styles.heroMiniRight]}>
              <Ionicons name="calendar" size={16} color={Colors.primary} />
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Selectează categoria</Text>

        <View style={styles.cards}>
          {ROLES.map((role) => (
            <TouchableOpacity
              key={role.id}
              activeOpacity={0.9}
              onPress={() => router.push(role.route as any)}
              style={[styles.cardShadow, Shadow.brand]}
            >
              <LinearGradient
                colors={Gradients.brand}
                start={Gradients.start}
                end={Gradients.end}
                style={styles.card}
              >
                <Ionicons name={role.icon} size={22} color={Colors.white} />
                <Text style={styles.cardTitle}>{role.title}</Text>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.75)" />
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={styles.loginLink} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.loginLinkText}>
            Ai deja cont?{' '}
            <Text style={{ color: Colors.coral, fontWeight: FontWeight.bold }}>Intră în cont</Text>
          </Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },
  container: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md },

  backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },

  title: {
    fontSize: 32, fontWeight: FontWeight.heavy, color: Colors.ink,
    textAlign: 'center', letterSpacing: -0.5, marginTop: Spacing.sm,
  },
  subtitle: { fontSize: FontSize.md, color: Colors.gray500, textAlign: 'center', marginTop: 6 },

  heroWrap: { alignItems: 'center', marginVertical: Spacing.xl },
  heroBlob: {
    width: 168, height: 168, borderRadius: 84,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  heroCircle: {
    width: 96, height: 96, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center', ...Shadow.brand,
  },
  heroMini: {
    position: 'absolute', width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center',
    ...Shadow.sm,
  },
  heroMiniLeft: { top: 18, left: 6 },
  heroMiniRight: { bottom: 14, right: 4 },

  sectionLabel: {
    fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.ink,
    marginBottom: Spacing.sm,
  },

  cards: { gap: Spacing.sm },
  cardShadow: { borderRadius: Radius.lg },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderRadius: Radius.lg, paddingVertical: 18, paddingHorizontal: 18,
  },
  cardTitle: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.white },

  loginLink: { alignItems: 'center', marginTop: Spacing.md },
  loginLinkText: { fontSize: FontSize.sm, color: Colors.gray500 },
});
