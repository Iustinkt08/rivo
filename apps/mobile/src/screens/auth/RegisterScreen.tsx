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
import { useAuthStore } from '../../store/authStore';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUpWithEmail } = useAuthStore();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);

  const passwordsMatch = password === confirm;
  const isValid = email.includes('@') && password.length >= 6 && passwordsMatch;

  const handleRegister = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      await signUpWithEmail(email.trim(), password);
      router.replace('/(auth)/role-selection');
    } catch (e: any) {
      Alert.alert('Înregistrare eșuată', e?.message ?? 'A apărut o eroare. Încearcă din nou.');
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

          <Text style={styles.title}>Creează cont</Text>
          <Text style={styles.subtitle}>Completează datele pentru a te înregistra</Text>

          {/* Email */}
          <View style={styles.inputRow}>
            <Ionicons name="mail-outline" size={18} color={Colors.ink} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={Colors.gray500}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Password */}
          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.ink} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Parolă (minim 6 caractere)"
              placeholderTextColor={Colors.gray500}
              secureTextEntry={!showPass}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.eyeBtn}>
              <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.gray500} />
            </TouchableOpacity>
          </View>

          {/* Confirm password */}
          <View style={[styles.inputRow, confirm.length > 0 && !passwordsMatch && styles.inputError]}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.ink} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Repetă parola"
              placeholderTextColor={Colors.gray500}
              secureTextEntry={!showPass}
              value={confirm}
              onChangeText={setConfirm}
            />
            {confirm.length > 0 && (
              <Ionicons
                name={passwordsMatch ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={passwordsMatch ? Colors.success : Colors.error}
              />
            )}
          </View>
          {confirm.length > 0 && !passwordsMatch && (
            <Text style={styles.errorText}>Parolele nu se potrivesc</Text>
          )}

          <TouchableOpacity
            activeOpacity={0.88}
            disabled={!isValid || loading}
            onPress={handleRegister}
            style={[styles.ctaWrap, (!isValid || loading) && { opacity: 0.5 }]}
          >
            <LinearGradient colors={Gradients.brand} start={Gradients.start} end={Gradients.end} style={styles.cta}>
              <Text style={styles.ctaText}>{loading ? 'Se creează contul…' : 'Creează cont'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.footerLink} onPress={() => router.back()}>
            <Text style={styles.footerText}>
              Ai deja cont?{' '}
              <Text style={{ color: Colors.coral, fontWeight: FontWeight.bold }}>Intră în cont</Text>
            </Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <Text style={styles.terms}>
            Prin înregistrare ești de acord cu{' '}
            <Text style={{ color: Colors.coral }}>Termenii</Text> și{' '}
            <Text style={{ color: Colors.coral }}>Politica de Confidențialitate</Text>.
          </Text>

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
    letterSpacing: -0.5, marginTop: Spacing.xl,
  },
  subtitle: { fontSize: FontSize.md, color: Colors.gray500, marginTop: 6, marginBottom: Spacing.xl },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.coral,
    paddingHorizontal: Spacing.md, paddingVertical: 15,
    marginBottom: Spacing.md,
  },
  inputError: { borderColor: Colors.error },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: FontSize.md, color: Colors.ink },
  eyeBtn: { padding: 4 },
  errorText: { fontSize: FontSize.xs, color: Colors.error, marginTop: -8, marginBottom: Spacing.sm },

  ctaWrap: { borderRadius: Radius.pill, marginTop: Spacing.sm, ...Shadow.brand },
  cta: { borderRadius: Radius.pill, paddingVertical: 17, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },

  footerLink: { alignItems: 'center', paddingVertical: Spacing.md },
  footerText: { fontSize: FontSize.md, color: Colors.ink },

  terms: { fontSize: FontSize.xs, color: Colors.gray400, textAlign: 'center', marginTop: Spacing.lg, lineHeight: 16 },
});
