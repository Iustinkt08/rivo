import React, { useEffect, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, FontWeight, Gradients, Radius, Shadow, Spacing } from '../../theme';
import { supabase } from '../../services/supabase';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Sets a new password using the recovery session established by
 * ForgotPasswordScreen (verifyOtp type 'recovery'). After the change we sign
 * the recovery session out on purpose: the user must log in manually with the
 * new password, and a lingering session would silently authenticate them on
 * the next cold start (root restoreSession).
 */
export default function ResetPasswordScreen() {
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Guard: this screen only makes sense with a recovery session. Opened
  // directly (deep link, stale navigation) → back to the forgot-password step.
  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted && !session) {
        router.replace('/(auth)/forgot-password');
      }
    });
    return () => { isMounted = false; };
  }, []);

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setPasswordError(null);
  };

  const handleConfirmChange = (value: string) => {
    setConfirmPassword(value);
    setConfirmError(null);
  };

  const validate = (): boolean => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Parola trebuie să aibă cel puțin ${MIN_PASSWORD_LENGTH} caractere.`);
      return false;
    }
    if (password !== confirmPassword) {
      setConfirmError('Parolele nu coincid.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        // Supabase rejects reusing the current password — the only failure
        // worth a specific message; everything else gets a generic retry.
        const isSamePassword = /different from the old password/i.test(error.message);
        Alert.alert(
          'Eroare',
          isSamePassword
            ? 'Parola nouă trebuie să fie diferită de cea veche.'
            : 'Nu am putut schimba parola. Încearcă din nou.',
        );
        return;
      }

      // Kill the recovery session BEFORE leaving: manual re-login required,
      // and it must not resurrect as an authenticated app session later.
      await supabase.auth.signOut();

      Alert.alert('Succes', 'Parola a fost schimbată.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ], { cancelable: false });
    } catch (err) {
      console.warn('[reset-password] updateUser failed:', err);
      Alert.alert('Eroare', 'Nu am putut schimba parola. Încearcă din nou.');
    } finally {
      setIsSaving(false);
    }
  };

  const isValid = password.length > 0 && confirmPassword.length > 0;

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

          <Text style={styles.title}>Parolă nouă</Text>
          <Text style={styles.subtitle}>Alege o parolă nouă pentru contul tău.</Text>

          {/* New password */}
          <View style={[styles.inputRow, passwordError != null && styles.inputRowError]}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.ink} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Parolă nouă"
              placeholderTextColor={Colors.gray500}
              secureTextEntry={!showPass}
              autoComplete="new-password"
              value={password}
              onChangeText={handlePasswordChange}
            />
            <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.eyeBtn}>
              <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.gray500} />
            </TouchableOpacity>
          </View>
          {passwordError != null && <Text style={styles.errorText}>{passwordError}</Text>}

          {/* Confirm password */}
          <View style={[styles.inputRow, confirmError != null && styles.inputRowError]}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.ink} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Confirmă parola"
              placeholderTextColor={Colors.gray500}
              secureTextEntry={!showPass}
              autoComplete="new-password"
              value={confirmPassword}
              onChangeText={handleConfirmChange}
            />
          </View>
          {confirmError != null && <Text style={styles.errorText}>{confirmError}</Text>}

          {/* Submit */}
          <TouchableOpacity
            activeOpacity={0.88}
            disabled={!isValid || isSaving}
            onPress={handleSubmit}
            style={[styles.ctaWrap, (!isValid || isSaving) && { opacity: 0.5 }]}
          >
            <LinearGradient colors={Gradients.brand} start={Gradients.start} end={Gradients.end} style={styles.cta}>
              <Text style={styles.ctaText}>{isSaving ? 'Se salvează…' : 'Schimbă parola'}</Text>
            </LinearGradient>
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

  errorText: {
    fontSize: FontSize.sm, color: Colors.error,
    marginTop: -(Spacing.md - 4), marginBottom: Spacing.md,
  },

  ctaWrap: { borderRadius: Radius.pill, marginTop: Spacing.sm, ...Shadow.brand },
  cta: { borderRadius: Radius.pill, paddingVertical: 17, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
