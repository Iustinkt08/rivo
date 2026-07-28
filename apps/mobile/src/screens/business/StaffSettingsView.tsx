import React from 'react';
import {
  Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Colors, FontSize, FontWeight, Gradients, Radius, Shadow, Spacing } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import type { StaffSession } from '../../utils/staffSession';

/**
 * Settings for a staff account: own profile card, password change and logout.
 * Owner-only sections (salon, services, team, billing) are intentionally absent.
 */
export default function StaffSettingsView({ session }: { session: StaffSession }) {
  const router = useRouter();
  const { signOut } = useAuthStore();

  const { staff, salon } = session;
  const fullName = `${staff.firstName} ${staff.lastName}`.trim();

  const handleLogout = () => {
    Alert.alert('Deconectare', 'Ești sigur că vrei să te deconectezi?', [
      { text: 'Anulează', style: 'cancel' },
      {
        text: 'Deconectează',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
        <Text style={styles.screenTitle}>Setări</Text>

        {/* Staff identity card */}
        <LinearGradient
          colors={Gradients.brand}
          start={Gradients.start}
          end={Gradients.end}
          style={styles.headerCard}
        >
          <View style={styles.headerAvatar}>
            {staff.avatarUrl ? (
              <Image source={{ uri: staff.avatarUrl }} style={styles.headerAvatarImg} />
            ) : (
              <Text style={{ fontSize: 30 }}>{staff.avatarEmoji}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName} numberOfLines={1}>{fullName}</Text>
            {!!staff.specialty && (
              <Text style={styles.headerSpecialty} numberOfLines={1}>{staff.specialty}</Text>
            )}
            <View style={styles.salonRow}>
              <Ionicons name="storefront-outline" size={13} color="rgba(255,255,255,0.9)" />
              <Text style={styles.salonName} numberOfLines={1}>{salon.name}</Text>
            </View>
            <View style={styles.rolePill}>
              <Ionicons name="person-outline" size={11} color={Colors.white} />
              <Text style={styles.rolePillText}>Cont staff</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cont</Text>
          <View style={styles.card}>
            <TouchableOpacity
              activeOpacity={0.6}
              style={styles.row}
              onPress={() => router.push('/(business)/staff-profile')}
            >
              <View style={styles.iconCircle}>
                <Ionicons name="person-circle-outline" size={18} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Profilul meu</Text>
                <Text style={styles.rowSubtitle}>Bio, contact, social media, galerie</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.gray300} />
            </TouchableOpacity>
            <View style={styles.rowDivider} />
            <TouchableOpacity
              activeOpacity={0.6}
              style={styles.row}
              onPress={() => router.push('/(business)/staff-change-password')}
            >
              <View style={styles.iconCircle}>
                <Ionicons name="key-outline" size={18} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Schimbă parola</Text>
                <Text style={styles.rowSubtitle}>Parola contului tău de staff</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.gray300} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.gray500} />
          <Text style={styles.infoText}>
            Vezi doar programările și statisticile tale. Profilul tău public (bio,
            galerie, social media) se editează din „Profilul meu”.
          </Text>
        </View>

        {/* Logout */}
        <TouchableOpacity activeOpacity={0.85} style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={Colors.error} />
          <Text style={styles.logoutText}>Deconectare</Text>
        </TouchableOpacity>

        <Text style={styles.version}>NAVIRA Business v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles (mirrors the owner SettingsScreen visual language) ─────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  screenTitle: {
    fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.ink,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, marginBottom: Spacing.md,
  },

  headerCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.xl,
    padding: Spacing.lg, borderRadius: Radius.xl, ...Shadow.brand,
  },
  headerAvatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  headerAvatarImg: { width: '100%', height: '100%' },
  headerName: { color: Colors.white, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  headerSpecialty: { color: 'rgba(255,255,255,0.92)', fontSize: FontSize.sm, marginTop: 2 },
  salonRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  salonName: { flex: 1, color: 'rgba(255,255,255,0.92)', fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.full,
  },
  rolePillText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  section: { marginHorizontal: Spacing.lg, marginBottom: Spacing.xl },
  sectionTitle: {
    fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.primary,
    marginBottom: 12, marginLeft: 2,
  },
  card: { backgroundColor: Colors.white, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.md },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
  },
  iconCircle: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { fontSize: FontSize.md, color: Colors.black, fontWeight: FontWeight.semibold },
  rowSubtitle: { fontSize: FontSize.xs, color: Colors.gray500, marginTop: 2 },
  rowDivider: {
    height: StyleSheet.hairlineWidth, backgroundColor: Colors.border,
    marginLeft: Spacing.md + 38 + Spacing.md,
  },

  infoBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    marginHorizontal: Spacing.lg, marginBottom: Spacing.xl,
    backgroundColor: Colors.gray50, borderRadius: Radius.md, padding: Spacing.sm,
  },
  infoText: { flex: 1, fontSize: FontSize.xs, color: Colors.gray500, lineHeight: 17 },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: '#F3C9C7',
    borderRadius: Radius.lg, paddingVertical: 15,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
  },
  logoutText: { color: Colors.error, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  version: { textAlign: 'center', fontSize: FontSize.xs, color: Colors.gray300, marginBottom: Spacing.sm },
});
