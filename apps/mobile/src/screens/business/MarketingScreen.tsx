import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';
import SettingsHeader from '../../components/business/SettingsHeader';

/**
 * Marketing hub — entry points for the salon's growth tools:
 * discount codes (F6) and the loyalty punch card (F7).
 */
export default function MarketingScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SettingsHeader title="Marketing" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Atrage clienți noi și fidelizează-i pe cei existenți.
        </Text>

        <HubCard
          icon="pricetag-outline"
          title="Coduri de reducere"
          subtitle="Creează și gestionează coduri promoționale"
          onPress={() => router.push('/(business)/discount-codes')}
        />
        <HubCard
          icon="ribbon-outline"
          title="Card de fidelitate"
          subtitle="Recompensează clienții după un număr de vizite"
          onPress={() => router.push('/(business)/punch-card')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function HubCard({ icon, title, subtitle, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={22} color={Colors.primary} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.gray300} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: 130, gap: Spacing.md },
  intro: { fontSize: FontSize.sm, color: Colors.gray500, lineHeight: 20, marginBottom: Spacing.xs },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    padding: Spacing.lg,
  },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.black },
  cardSubtitle: { fontSize: FontSize.xs, color: Colors.gray500, marginTop: 2 },
});
