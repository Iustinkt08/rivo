import React, { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, FontWeight, Gradients, Radius, Shadow, Spacing } from '../../theme';
import { InvalidCredentialsError, useAuthStore } from '../../store/authStore';
import { isEmailIdentifier, isUsernameIdentifier } from '../../utils/loginIdentifier';

const SOCIALS = [
  { id: 'facebook', icon: 'logo-facebook' as const, color: '#1877F2' },
  { id: 'google',   icon: 'logo-google' as const,   color: '#EA4335' },
  { id: 'apple',    icon: 'logo-apple' as const,    color: '#111111' },
];

/** Loose email shape check — enough to catch obvious typos before Supabase. */
const EMAIL_FORMAT_REGEX = /^\S+@\S+\.\S+$/;

/** Show "Ai uitat parola?" after this many consecutive failed password attempts. */
const FORGOT_PASSWORD_THRESHOLD = 2;

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithEmail, signInStaff } = useAuthStore();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading]   = useState(false);

  // Field-level error highlighting + consecutive failed password attempts.
  const [hasEmailError, setHasEmailError]       = useState(false);
  const [hasPasswordError, setHasPasswordError] = useState(false);
  const [failedAttempts, setFailedAttempts]     = useState(0);

  // Email → Supabase login; plain handle (no @) → staff username login.
  const isStaffLogin = isUsernameIdentifier(email);
  const isValid =
    (isEmailIdentifier(email) || isStaffLogin) && password.length >= 6;

  const showForgotPassword = failedAttempts >= FORGOT_PASSWORD_THRESHOLD;

  // Editing a field clears its error border; a new identifier restarts the
  // failed-attempt counter (it is per-account, not global).
  const handleEmailChange = (value: string) => {
    setEmail(value);
    setHasEmailError(false);
    setFailedAttempts(0);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setHasPasswordError(false);
  };

  const openForgotPassword = () => {
    router.push({
      pathname: '/(auth)/forgot-password',
      params: { email: email.includes('@') ? email.trim() : '' },
    });
  };

  const handleLogin = async () => {
    if (!isValid) return;

    // Client-side email shape check — only for the email branch; a staff
    // username (no '@') is intentionally NOT held to email format.
    if (!isStaffLogin && !EMAIL_FORMAT_REGEX.test(email.trim())) {
      setHasEmailError(true);
      Alert.alert('Eroare', 'Credențialele introduse sunt greșite.');
      return;
    }

    setLoading(true);
    try {
      if (isStaffLogin) {
        await signInStaff(email, password);
        setFailedAttempts(0);
        // Explicit navigation: the root _layout only swaps which <Stack>
        // branch is rendered — expo-router keeps the CURRENT route alive, so
        // without a replace() the user would stay parked on /(auth)/login.
        router.replace('/(business)');
        return;
      }
      const { isNewUser } = await signInWithEmail(email.trim(), password);
      setFailedAttempts(0);
      if (isNewUser) {
        router.replace('/(auth)/role-selection');
        return;
      }
      // Explicit role-based navigation (see comment above — the conditional
      // root layout does not reset the active route by itself).
      const { user: signedInUser, hasCompletedOnboarding } = useAuthStore.getState();
      const role = signedInUser?.role;
      if (role === 'ADMIN_SALON' && !hasCompletedOnboarding) {
        router.replace('/(onboarding)');
      } else if (role === 'ADMIN_SALON' || role === 'STAFF_MEMBER' || role === 'SUPER_ADMIN') {
        router.replace('/(business)');
      } else {
        router.replace('/(client)');
      }
    } catch (e: any) {
      if (isStaffLogin) {
        setHasPasswordError(true);
        setFailedAttempts((count) => count + 1);
        Alert.alert('Autentificare eșuată', 'Utilizator sau parolă incorectă.');
      } else if (e instanceof InvalidCredentialsError) {
        // Supabase returns a single GENERIC invalid-credentials error — it
        // cannot tell a wrong email from a wrong password. Since the email
        // already passed the shape check, we surface it as a password problem.
        setHasPasswordError(true);
        setFailedAttempts((count) => count + 1);
        Alert.alert('Eroare', 'Parola este greșită.');
      } else {
        // Transient failure (network, backend profile fetch) — not a wrong
        // password, so it does not count towards the forgot-password prompt.
        Alert.alert('Autentificare eșuată', 'A apărut o eroare. Încearcă din nou.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.ink} />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <Text style={styles.title}>Bine ai revenit!</Text>
          <Text style={styles.subtitle}>Autentifică-te pentru a continua</Text>

          {/* Email */}
          <View style={[styles.inputRow, hasEmailError && styles.inputRowError]}>
            <Ionicons name="mail-outline" size={18} color={Colors.ink} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={Colors.gray500}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={handleEmailChange}
            />
          </View>

          {/* Password */}
          <View style={[styles.inputRow, hasPasswordError && styles.inputRowError]}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.ink} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Parolă"
              placeholderTextColor={Colors.gray500}
              secureTextEntry={!showPass}
              autoComplete="password"
              value={password}
              onChangeText={handlePasswordChange}
            />
            <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.eyeBtn}>
              <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.gray500} />
            </TouchableOpacity>
          </View>

          {/* Forgot password — surfaced after repeated failed password attempts */}
          {showForgotPassword && (
            <TouchableOpacity style={styles.forgotBtn} onPress={openForgotPassword}>
              <Text style={styles.forgotText}>Ai uitat parola?</Text>
            </TouchableOpacity>
          )}

          {/* Remember me */}
          <TouchableOpacity style={styles.rememberRow} onPress={() => setRemember(v => !v)} activeOpacity={0.8}>
            <View style={[styles.checkCircle, remember && styles.checkCircleOn]}>
              {remember && <Ionicons name="checkmark" size={13} color={Colors.white} />}
            </View>
            <Text style={styles.rememberText}>Ține-mă minte</Text>
          </TouchableOpacity>

          {/* Sign in */}
          <TouchableOpacity
            activeOpacity={0.88}
            disabled={!isValid || loading}
            onPress={handleLogin}
            style={[styles.ctaWrap, (!isValid || loading) && { opacity: 0.5 }]}
          >
            <LinearGradient colors={Gradients.brand} start={Gradients.start} end={Gradients.end} style={styles.cta}>
              <Text style={styles.ctaText}>{loading ? 'Se conectează…' : 'Intră în cont'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Social */}
          <Text style={styles.socialLabel}>Sau continuă cu</Text>
          <View style={styles.socialRow}>
            {SOCIALS.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.socialBtn}
                activeOpacity={0.8}
                onPress={() => Alert.alert('În curând', 'Autentificarea prin rețele sociale va fi disponibilă în curând.')}
              >
                <Ionicons name={s.icon} size={22} color={s.color} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flex: 1 }} />

          {/* Footer links */}
          <TouchableOpacity style={styles.footerLink} onPress={openForgotPassword}>
            <Text style={styles.footerText}>Ți-ai uitat parola?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.footerLink} onPress={() => router.push('/(auth)/role-selection')}>
            <Text style={styles.footerText}>
              Nu ai cont?{' '}
              <Text style={{ color: Colors.coral, fontWeight: FontWeight.bold }}>Înregistrează-te</Text>
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },
  backBtn: {
    width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center',
    marginLeft: Spacing.lg, marginTop: Spacing.sm,
  },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },

  title: {
    fontSize: 34, fontWeight: FontWeight.heavy, color: Colors.ink,
    letterSpacing: -0.5, marginTop: Spacing.xxl,
  },
  subtitle: { fontSize: FontSize.md, color: Colors.gray500, marginTop: 6, marginBottom: Spacing.xl },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.coral,
    paddingHorizontal: Spacing.md, paddingVertical: 15,
    marginBottom: Spacing.md,
  },
  inputRowError: { borderColor: Colors.error },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: FontSize.md, color: Colors.ink },
  eyeBtn: { padding: 4 },

  forgotBtn: { alignSelf: 'flex-start', paddingVertical: 4, marginTop: -4, marginBottom: Spacing.sm },
  forgotText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },

  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.lg },
  checkCircle: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.gray300,
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircleOn: { backgroundColor: Colors.coral, borderColor: Colors.coral },
  rememberText: { fontSize: FontSize.sm, color: Colors.ink, fontWeight: FontWeight.medium },

  ctaWrap: { borderRadius: Radius.pill, ...Shadow.brand },
  cta: { borderRadius: Radius.pill, paddingVertical: 17, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },

  socialLabel: {
    fontSize: FontSize.md, color: Colors.gray500, textAlign: 'center',
    marginTop: Spacing.xl, marginBottom: Spacing.md,
  },
  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.md },
  socialBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.gray50, alignItems: 'center', justifyContent: 'center',
    ...Shadow.sm,
  },

  footerLink: { alignItems: 'center', paddingVertical: 8 },
  footerText: { fontSize: FontSize.md, color: Colors.ink },
});
