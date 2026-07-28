import React from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, FontWeight, Gradients, Radius, Shadow, Spacing } from '../../theme';
import { useAuthStore } from '../../store/authStore';

const BANNER_HEIGHT = 200;

type MenuItem = {
  icon: string;
  label: string;
  screen: string;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const insets = useSafeAreaInsets();

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  const handleLogout = () => {
    Alert.alert(
      'Deconectare',
      'Ești sigur că vrei să te deconectezi?',
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Deconectează',
          style: 'destructive',
          onPress: async () => { await signOut(); router.replace('/(auth)'); },
        },
      ],
      { cancelable: false },
    );
  };

  const handleMenuPress = (screen: string) => {
    switch (screen) {
      case 'bookings':        router.navigate('/(client)/bookings');      break;
      case 'favorites':       router.navigate('/(client)/favorites');     break;
      case 'settings':        router.push('/settings');                   break;
      default:
        Alert.alert('În curând', 'Această secțiune va fi disponibilă în curând.');
    }
  };

  const MENU_ITEMS: MenuItem[] = [
    { icon: 'calendar-outline', label: 'Programările mele', screen: 'bookings' },
    { icon: 'heart-outline',    label: 'Saloane favorite',  screen: 'favorites' },
    { icon: 'settings-outline', label: 'Setări',            screen: 'settings' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
      >
        {/* ── Brand gradient banner — spans full width, extends under status bar ── */}
        <LinearGradient
          colors={Gradients.brand}
          start={Gradients.start}
          end={Gradients.end}
          style={[styles.gradientBanner, { paddingTop: insets.top }]}
        />

        {/* ── Profile card — solid white for clear name/contact contrast ── */}
        <View style={styles.profileCard}>
          <View style={styles.cardInner}>
            {/* Avatar — tappable → edit-profile */}
            <TouchableOpacity
              style={styles.avatarWrap}
              onPress={() => router.push('/edit-profile')}
              activeOpacity={0.85}
            >
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.initials}>{initials || '?'}</Text>
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={11} color={Colors.white} />
              </View>
            </TouchableOpacity>

            {/* Name + contact */}
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {user?.firstName} {user?.lastName}
              </Text>
              <Text style={styles.userContact} numberOfLines={1}>
                {user?.phone ?? user?.email ?? '—'}
              </Text>
            </View>

            {/* Pencil edit button (top-right of card) */}
            <TouchableOpacity
              style={styles.pencilBtn}
              onPress={() => router.push('/edit-profile')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="pencil-outline" size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Section title — mirrors HomeScreen sectionTitle for visual cohesion ── */}
        <Text style={styles.sectionTitle}>Contul meu</Text>

        {/* ── Menu list card ── */}
        <View style={styles.menuCard}>
          {MENU_ITEMS.map((item, i) => {
            const isLast = i === MENU_ITEMS.length - 1;
            return (
              <TouchableOpacity
                key={item.label}
                style={[styles.menuRow, !isLast && styles.menuRowBorder]}
                onPress={() => handleMenuPress(item.screen)}
                activeOpacity={0.7}
              >
                <View style={styles.menuIconChip}>
                  <Ionicons name={item.icon as any} size={18} color={Colors.primary} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward-outline" size={15} color={Colors.gray300} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Logout — refined outline button ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={Colors.error} />
          <Text style={styles.logoutText}>Deconectare</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>NAVIRA v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  gradientBanner: {
    width: '100%',
    height: BANNER_HEIGHT,
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },

  // Solid white card — floats -60px over the gradient edge; white bg ensures readable text
  profileCard: {
    marginHorizontal: Spacing.lg,
    marginTop: -60,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    ...Shadow.md,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },

  avatarWrap: { position: 'relative' },
  avatarImg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: Colors.primaryLight,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primaryLight,
  },
  initials: { color: Colors.white, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.white,
  },

  userInfo: { flex: 1, paddingRight: 4 },
  userName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.ink },
  userContact: { fontSize: FontSize.sm, color: Colors.gray500, marginTop: 2 },

  pencilBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Section title — fontSize 20 / semibold / brand-red: matches HomeScreen sectionTitle
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },

  menuCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: Spacing.sm,
  },
  menuRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.gray100,
  },
  menuIconChip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.ink,
    fontWeight: FontWeight.medium,
  },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.error,
    backgroundColor: 'transparent',
    marginBottom: Spacing.lg,
  },
  logoutText: { fontSize: FontSize.md, color: Colors.error, fontWeight: FontWeight.semibold },

  versionText: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.gray300,
    marginBottom: Spacing.xl,
  },
});
