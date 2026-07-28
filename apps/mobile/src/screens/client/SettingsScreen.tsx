import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, FontSize, FontWeight, Gradients, Radius, Shadow, Spacing } from '../../theme';

// UI-only language selection — placeholder until i18n (react-i18next / expo-localization) is wired up
const LANGUAGE_STORAGE_KEY = 'navira-language';
type Language = 'ro' | 'en';

type SettingsRow = {
  icon: string;
  label: string;
  value?: string;
  onPress: () => void;
};

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [language, setLanguage] = useState<Language>('ro');

  // Restore persisted language on mount
  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then((val) => {
      if (val === 'en' || val === 'ro') setLanguage(val);
    });
  }, []);

  // UI-only: persists choice to AsyncStorage; actual locale switching deferred to i18n integration
  const handleLanguagePress = () => {
    Alert.alert(
      'Limbă / Language',
      '',
      [
        {
          text: 'Română',
          onPress: () => {
            const lang: Language = 'ro';
            setLanguage(lang);
            AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
          },
        },
        {
          text: 'English',
          onPress: () => {
            const lang: Language = 'en';
            setLanguage(lang);
            AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
          },
        },
        { text: 'Anulează', style: 'cancel' },
      ],
    );
  };

  const showComingSoon = () =>
    Alert.alert('În curând', 'Această secțiune va fi disponibilă în curând.');

  const ROWS: SettingsRow[] = [
    {
      // Preference toggles — the notification FEED stays on the header bell
      // (/(client)/notifications).
      icon: 'notifications-outline',
      label: 'Notificări',
      onPress: () => router.push('/(client)/notification-settings'),
    },
    {
      icon: 'language-outline',
      label: 'Limbă',
      value: language.toUpperCase(),
      onPress: handleLanguagePress,
    },
    {
      icon: 'lock-closed-outline',
      label: 'Schimbă parola',
      onPress: () => router.push('/change-password'),
    },
    {
      icon: 'help-circle-outline',
      label: 'Ajutor & Contact',
      onPress: showComingSoon,
    },
    {
      icon: 'shield-checkmark-outline',
      label: 'Confidențialitate',
      onPress: showComingSoon,
    },
    {
      icon: 'document-text-outline',
      label: 'Termeni și condiții',
      onPress: showComingSoon,
    },
    {
      icon: 'star-outline',
      label: 'Evaluează aplicația',
      onPress: showComingSoon,
    },
  ];

  return (
    <View style={styles.root}>
      {/* ── Brand gradient header ── */}
      <LinearGradient
        colors={Gradients.brand}
        start={Gradients.start}
        end={Gradients.end}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Setări</Text>
        {/* Spacer to keep title centred */}
        <View style={styles.headerSpacer} />
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
      >
        {/* ── Settings card ── */}
        <View style={styles.card}>
          {ROWS.map((row, i) => {
            const isLast = i === ROWS.length - 1;
            return (
              <TouchableOpacity
                key={row.label}
                style={[styles.row, !isLast && styles.rowBorder]}
                onPress={row.onPress}
                activeOpacity={0.7}
              >
                <View style={styles.iconChip}>
                  <Ionicons name={row.icon as any} size={18} color={Colors.primary} />
                </View>
                <Text style={styles.rowLabel}>{row.label}</Text>
                {row.value != null && (
                  <Text style={styles.rowValue}>{row.value}</Text>
                )}
                <Ionicons name="chevron-forward-outline" size={15} color={Colors.gray300} />
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.white,
    textAlign: 'center',
  },
  headerSpacer: { width: 36 },

  body: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 130,
  },

  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadow.sm,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: Spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.gray100,
  },

  iconChip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  rowLabel: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.ink,
    fontWeight: FontWeight.medium,
  },
  rowValue: {
    fontSize: FontSize.sm,
    color: Colors.gray500,
    fontWeight: FontWeight.semibold,
    marginRight: Spacing.xs,
  },
});
