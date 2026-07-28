import React, { useState } from 'react';
import {
  ScrollView, Share, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, FontWeight, Gradients, Radius, Shadow, Spacing } from '../../theme';
import { ProfessionalProfile } from '../../services/api/professionals';
import ProfessionalProfileContent from '../../components/client/ProfessionalProfileContent';
import { buildProfessionalShare } from '../../utils/professionalShare';

// NAVIRA visual language (mirrors HomeScreen / SalonDetailScreen)
const H_PAD = 28;
// Keep the sticky CTA clear of the floating tab bar (same offset as SalonDetail).
const CTA_NAVBAR_OFFSET = 74;

/**
 * Public professional profile (client app). The body is rendered by the
 * shared ProfessionalProfileContent — the business app reuses the exact same
 * component for the "Previzualizează" sheet, so both always match.
 */
export default function ProfessionalProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const professionalId = params.id ?? '';

  // Loaded profile mirrored up from the content component (drives the CTA).
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);

  const handleShare = () => {
    const { message, url } = buildProfessionalShare(professionalId, profile?.fullName);
    Share.share({ message, url }).catch(() => {});
  };

  const handleBook = () => {
    if (!profile?.salon) return;
    router.push({
      pathname: '/(client)/booking',
      params: {
        salonId: profile.salon.id,
        salonName: profile.salon.name,
        staffId: profile.id,
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Specialist</Text>
        <TouchableOpacity
          onPress={handleShare}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Distribuie profilul"
        >
          <Ionicons name="share-outline" size={22} color={Colors.black} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 200 }}
      >
        <ProfessionalProfileContent
          professionalId={professionalId}
          onProfileLoaded={setProfile}
          onOpenSalon={(salonId) => router.push(`/salon/${salonId}`)}
        />
      </ScrollView>

      {/* Sticky booking CTA — above the floating tab bar */}
      {profile?.salon && (
        <View style={[styles.ctaWrap, { bottom: insets.bottom + CTA_NAVBAR_OFFSET }]}>
          <TouchableOpacity activeOpacity={0.88} onPress={handleBook} style={styles.ctaShadow}>
            <LinearGradient
              colors={Gradients.brand}
              start={Gradients.start}
              end={Gradients.end}
              style={styles.ctaBtn}
            >
              <Text style={styles.ctaText} numberOfLines={1}>
                Rezervă la {profile.salon.name}
              </Text>
              <Ionicons name="arrow-forward" size={16} color={Colors.white} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: H_PAD, paddingVertical: Spacing.md,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.black },

  ctaWrap: { position: 'absolute', left: H_PAD, right: H_PAD },
  ctaShadow: { borderRadius: Radius.pill, ...Shadow.brand },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: Radius.pill, paddingVertical: 16, paddingHorizontal: 20,
  },
  ctaText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold, flexShrink: 1 },
});
