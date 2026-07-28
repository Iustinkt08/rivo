import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, FontWeight, Gradients, Radius, Shadow, Spacing } from '../../theme';
import { supabase } from '../../services/supabase';

/** Loose email shape check — enough to catch obvious typos before Supabase. */
const EMAIL_FORMAT_REGEX = /^\S+@\S+\.\S+$/;

const RECOVERY_CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Forgot-password: email + recovery code on ONE screen.
 *
 * NOTE for the recovery email template: supabase.auth.resetPasswordForEmail
 * sends the "Reset Password" template, which by default contains only a
 * {{ .ConfirmationURL }} magic link. The 6-digit code entered here is the OTP
 * ({{ .Token }}) — the Supabase email template MUST include {{ .Token }} or
 * the user will never see a code to type.
 *
 * Routing safety: verifyOtp(type: 'recovery') establishes a real SIGNED_IN
 * Supabase session, but authStore has no onAuthStateChange listener and
 * restoreSession only runs on cold start, so store.isAuthenticated stays
 * false and the root layout keeps us inside the (auth) stack for the whole
 * flow. The only listener (services/api/client.ts) merely attaches the token
 * to axios. ResetPasswordScreen signs the recovery session out at the end.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [code, setCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [hasEmailError, setHasEmailError] = useState(false);
  const [hasCodeError, setHasCodeError] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Guards the autodetect against firing twice for the same 6 digits.
  const verifyingTokenRef = useRef<string | null>(null);

  // 60s resend cooldown ticker.
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((seconds) => (seconds > 0 ? seconds - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown > 0]);

  const sendCode = async () => {
    const trimmed = email.trim();
    if (!EMAIL_FORMAT_REGEX.test(trimmed)) {
      setHasEmailError(true);
      Alert.alert('Eroare', 'Introdu o adresă de email validă.');
      return;
    }
    setIsSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed);
      if (error) throw new Error(error.message);
      setIsCodeSent(true);
      setCode('');
      setHasCodeError(false);
      setResendCountdown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      console.warn('[forgot-password] resetPasswordForEmail failed:', err);
      Alert.alert('Eroare', 'Nu am putut trimite codul. Încearcă din nou.');
    } finally {
      setIsSending(false);
    }
  };

  const verifyCode = async (token: string) => {
    if (verifyingTokenRef.current === token) return;
    verifyingTokenRef.current = token;
    setIsVerifying(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token,
        type: 'recovery',
      });
      if (error || !data.session) {
        setHasCodeError(true);
        return;
      }
      // Recovery session established — go set the new password.
      router.replace('/(auth)/reset-password');
    } catch (err) {
      console.warn('[forgot-password] verifyOtp failed:', err);
      setHasCodeError(true);
    } finally {
      setIsVerifying(false);
      verifyingTokenRef.current = null;
    }
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setHasEmailError(false);
  };

  // Autodetect: verify as soon as 6 digits are typed.
  const handleCodeChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, RECOVERY_CODE_LENGTH);
    setCode(digits);
    setHasCodeError(false);
    if (digits.length === RECOVERY_CODE_LENGTH && !isVerifying) {
      verifyCode(digits);
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

          <Text style={styles.title}>Resetează parola</Text>
          <Text style={styles.subtitle}>
            Îți trimitem un cod de verificare pe email pentru a-ți seta o parolă nouă.
          </Text>

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

          {/* Send / resend CTA */}
          {!isCodeSent && (
            <TouchableOpacity
              activeOpacity={0.88}
              disabled={isSending || email.trim().length === 0}
              onPress={sendCode}
              style={[styles.ctaWrap, (isSending || email.trim().length === 0) && { opacity: 0.5 }]}
            >
              <LinearGradient colors={Gradients.brand} start={Gradients.start} end={Gradients.end} style={styles.cta}>
                <Text style={styles.ctaText}>{isSending ? 'Se trimite…' : 'Trimite codul'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Code entry — revealed once the email was sent */}
          {isCodeSent && (
            <>
              <Text style={styles.helperText}>Ți-am trimis un cod pe email.</Text>

              <View style={[styles.codeRow, hasCodeError && styles.inputRowError]}>
                <TextInput
                  style={styles.codeInput}
                  placeholder="______"
                  placeholderTextColor={Colors.gray300}
                  keyboardType="number-pad"
                  maxLength={RECOVERY_CODE_LENGTH}
                  value={code}
                  onChangeText={handleCodeChange}
                  editable={!isVerifying}
                  autoFocus
                />
              </View>

              {hasCodeError && <Text style={styles.errorText}>Cod invalid sau expirat.</Text>}
              {isVerifying && <Text style={styles.helperText}>Se verifică…</Text>}

              <TouchableOpacity
                style={styles.resendBtn}
                disabled={resendCountdown > 0 || isSending}
                onPress={sendCode}
              >
                <Text style={[styles.resendText, (resendCountdown > 0 || isSending) && styles.resendTextDisabled]}>
                  {resendCountdown > 0 ? `Retrimite codul (${resendCountdown}s)` : 'Retrimite codul'}
                </Text>
              </TouchableOpacity>
            </>
          )}

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

  ctaWrap: { borderRadius: Radius.pill, marginTop: Spacing.sm, ...Shadow.brand },
  cta: { borderRadius: Radius.pill, paddingVertical: 17, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },

  helperText: { fontSize: FontSize.sm, color: Colors.gray500, marginBottom: Spacing.md },

  codeRow: {
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.coral,
    paddingHorizontal: Spacing.md, paddingVertical: 15,
    marginBottom: Spacing.sm,
  },
  codeInput: {
    fontSize: FontSize.xl, color: Colors.ink, textAlign: 'center',
    letterSpacing: 12, fontWeight: FontWeight.bold,
  },
  errorText: { fontSize: FontSize.sm, color: Colors.error, marginBottom: Spacing.sm },

  resendBtn: { alignSelf: 'center', paddingVertical: 8, marginTop: Spacing.sm },
  resendText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },
  resendTextDisabled: { color: Colors.gray500 },
});
