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

const TOTAL_STEPS = 4;
const DONE = TOTAL_STEPS; // success screen index

interface Props {
  role: 'CLIENT' | 'ADMIN_SALON';
}

export default function SignUpWizard({ role }: Props) {
  const router = useRouter();
  const { signUpWithEmail, completeProfile } = useAuthStore();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [phone, setPhone]         = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');

  const phoneDigits = phone.replace(/\D/g, '');
  const isPhoneValid = phoneDigits.length >= 9;

  const stepValid = [
    email.includes('@') && email.includes('.'),
    password.length >= 6,
    isPhoneValid,
    firstName.trim().length > 0 && lastName.trim().length > 0,
  ][step];

  const handleBack = () => {
    if (step === 0) router.back();
    else setStep(s => s - 1);
  };

  const handleNext = () => {
    if (!stepValid) return;
    setStep(s => s + 1);
  };

  // Final: create account + profile, then enter the app
  const handleFinish = async () => {
    setLoading(true);
    try {
      await signUpWithEmail(email.trim(), password);
      await completeProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phoneDigits ? `+40${phoneDigits.replace(/^0/, '')}` : undefined,
        role,
      });
      if (role === 'CLIENT') {
        router.replace('/(client)');
      } else {
        // ADMIN_SALON: navigate explicitly so Expo Router's navigation state
        // advances — relying solely on _layout re-render is unreliable.
        router.replace('/(onboarding)');
      }
    } catch (e: any) {
      // Axios errors bury the backend message in response.data
      const status: number | undefined = e?.response?.status;
      const serverMsg: string = e?.response?.data?.message ?? '';
      const msg: string = serverMsg || e?.message || '';

      if (status === 409 && /phone/i.test(serverMsg)) {
        Alert.alert(
          'Număr de telefon folosit',
          'Acest număr de telefon este deja asociat altui cont. Folosește alt număr.',
          [{ text: 'Modifică numărul', onPress: () => setStep(2) }],
        );
      } else if (status === 409 && /email/i.test(serverMsg)) {
        Alert.alert(
          'Email folosit',
          'Acest email este deja asociat altui cont.',
          [
            { text: 'Intră în cont', onPress: () => router.replace('/(auth)/login') },
            { text: 'Modifică emailul', onPress: () => setStep(0) },
          ],
        );
      } else if (/already (registered|exists|been registered)/i.test(msg)) {
        Alert.alert(
          'Cont existent',
          'Există deja un cont cu acest email. Vrei să te autentifici?',
          [
            { text: 'Intră în cont', onPress: () => router.replace('/(auth)/login') },
            { text: 'Modifică emailul', onPress: () => setStep(0) },
          ],
        );
      } else if (/network request failed|network error/i.test(msg)) {
        Alert.alert(
          'Fără conexiune la server',
          'Nu am putut contacta serverul. Verifică-ți conexiunea la internet ' +
          'și asigură-te că backend-ul rulează, apoi apasă din nou pe Continuă.',
        );
      } else {
        Alert.alert('Eroare', msg || 'A apărut o problemă. Încearcă din nou.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ───────────────────────────────────────────────────────
  if (step === DONE) {
    const isSalon = role === 'ADMIN_SALON';
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.doneContainer}>
          <View style={{ flex: 1 }} />

          <LinearGradient colors={Gradients.brand} start={Gradients.start} end={Gradients.end} style={styles.doneCircle}>
            <Ionicons name="checkmark" size={44} color={Colors.white} />
          </LinearGradient>

          <Text style={styles.doneTitle}>{isSalon ? 'Contul tău e gata' : 'Totul este gata'}</Text>
          <Text style={styles.doneSubtitle}>
            {isSalon
              ? 'Urmează configurarea salonului:\nidentitate, locație și servicii'
              : 'Începe experiența ta de rezervare\napăsând butonul de mai jos'}
          </Text>

          <View style={{ flex: 1.4 }} />

          <TouchableOpacity
            activeOpacity={0.88}
            onPress={handleFinish}
            disabled={loading}
            style={[styles.ctaWrap, { alignSelf: 'stretch' }, loading && { opacity: 0.6 }]}
          >
            <LinearGradient colors={Gradients.brand} start={Gradients.start} end={Gradients.end} style={styles.cta}>
              <Text style={styles.ctaText}>
                {loading ? 'Se creează contul…' : isSalon ? 'Configurează salonul' : 'Continuă'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Wizard ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleBack} disabled={loading} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={step === 0 ? 'close' : 'chevron-back'} size={26} color={Colors.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{role === 'ADMIN_SALON' ? 'Cont de salon' : 'Înregistrare'}</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Step 0: Email ─────────────────────────────────────────────── */}
          {step === 0 && (
            <View>
              <Text style={styles.question}>Care e emailul tău?</Text>
              <TextInput
                style={styles.bigInput}
                placeholder="Adresa de email"
                placeholderTextColor={Colors.gray300}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                autoFocus
              />
              <TouchableOpacity style={styles.loginLink} onPress={() => router.replace('/(auth)/login')}>
                <Text style={styles.loginLinkText}>
                  Ai deja cont?{' '}
                  <Text style={{ color: Colors.coral, fontWeight: FontWeight.bold }}>Intră în cont</Text>
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Step 1: Password ──────────────────────────────────────────── */}
          {step === 1 && (
            <View>
              <Text style={styles.question}>Creează o parolă</Text>
              <TextInput
                style={styles.bigInput}
                placeholder="Parolă"
                placeholderTextColor={Colors.gray300}
                secureTextEntry={!showPass}
                value={password}
                onChangeText={setPassword}
                autoFocus
              />
              <TouchableOpacity style={styles.checkRow} onPress={() => setShowPass(v => !v)} activeOpacity={0.8}>
                <View style={[styles.checkCircle, showPass && styles.checkCircleOn]}>
                  {showPass && <Ionicons name="checkmark" size={13} color={Colors.white} />}
                </View>
                <Text style={styles.checkLabel}>Arată parola</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Step 2: Phone ─────────────────────────────────────────────── */}
          {step === 2 && (
            <View>
              <Text style={styles.question}>Număr de telefon</Text>
              <Text style={styles.questionHint}>
                {role === 'ADMIN_SALON'
                  ? 'Numărul de contact al salonului tău.'
                  : 'Îl folosim pentru confirmarea programărilor tale.'}
              </Text>

              <View style={styles.phoneRow}>
                <Text style={styles.phoneFlag}>🇷🇴</Text>
                <Text style={styles.phonePrefix}>+40</Text>
                <View style={styles.phoneDivider} />
                <TextInput
                  style={styles.phoneInput}
                  placeholder="7XX XXX XXX"
                  placeholderTextColor={Colors.gray300}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  autoFocus
                />
                {isPhoneValid && (
                  <LinearGradient colors={Gradients.brandSoft} start={Gradients.start} end={Gradients.end} style={styles.phoneCheck}>
                    <Ionicons name="checkmark" size={14} color={Colors.white} />
                  </LinearGradient>
                )}
              </View>
            </View>
          )}

          {/* ── Step 3: Name ──────────────────────────────────────────────── */}
          {step === 3 && (
            <View>
              <Text style={styles.question}>Cum te numești?</Text>
              <TextInput
                style={styles.bigInput}
                placeholder="Prenume"
                placeholderTextColor={Colors.gray300}
                autoCapitalize="words"
                value={firstName}
                onChangeText={setFirstName}
                autoFocus
              />
              <TextInput
                style={[styles.bigInput, { marginTop: Spacing.md }]}
                placeholder="Nume"
                placeholderTextColor={Colors.gray300}
                autoCapitalize="words"
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          )}

          {/* Progress + Next */}
          <View style={styles.progressBlock}>
            <Text style={styles.progressLabel}>{step + 1} din {TOTAL_STEPS}</Text>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={Gradients.brandSoft}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${((step + 1) / TOTAL_STEPS) * 100}%` }]}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.88}
              disabled={!stepValid}
              onPress={handleNext}
              style={[styles.ctaWrap, !stepValid && { opacity: 0.5 }]}
            >
              <LinearGradient colors={Gradients.brand} start={Gradients.start} end={Gradients.end} style={styles.cta}>
                <Text style={styles.ctaText}>Continuă</Text>
              </LinearGradient>
            </TouchableOpacity>

            {step === 0 && (
              <Text style={styles.terms}>
                Prin continuare ești de acord cu{' '}
                <Text style={{ color: Colors.coral }}>Termenii</Text> și{' '}
                <Text style={{ color: Colors.coral }}>Politica de Confidențialitate</Text>.
              </Text>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },

  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.sm,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.ink },

  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },

  question: {
    fontSize: 30, fontWeight: FontWeight.heavy, color: Colors.ink,
    letterSpacing: -0.5, marginTop: Spacing.xl, marginBottom: Spacing.sm,
  },
  questionHint: { fontSize: FontSize.md, color: Colors.gray500, lineHeight: 22, marginBottom: Spacing.lg },

  bigInput: { fontSize: 26, color: Colors.ink, paddingVertical: 6 },

  loginLink: { marginTop: Spacing.lg },
  loginLinkText: { fontSize: FontSize.sm, color: Colors.gray500 },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.sm },
  checkCircle: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.gray300,
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircleOn: { backgroundColor: Colors.coral, borderColor: Colors.coral },
  checkLabel: { fontSize: FontSize.sm, color: Colors.ink, fontWeight: FontWeight.medium },

  phoneRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.coral, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md, paddingVertical: 14, gap: 10,
  },
  phoneFlag: { fontSize: 18 },
  phonePrefix: { fontSize: FontSize.lg, color: Colors.ink, fontWeight: FontWeight.semibold },
  phoneDivider: { width: 1, height: 22, backgroundColor: Colors.border },
  phoneInput: { flex: 1, fontSize: FontSize.lg, color: Colors.ink },
  phoneCheck: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },

  progressBlock: { marginTop: Spacing.xxl },
  progressLabel: {
    alignSelf: 'flex-end', fontSize: FontSize.sm, fontWeight: FontWeight.bold,
    color: Colors.ink, marginBottom: 8,
  },
  progressTrack: {
    height: 6, borderRadius: 3, backgroundColor: Colors.gray100,
    overflow: 'hidden', marginBottom: Spacing.lg,
  },
  progressFill: { height: '100%', borderRadius: 3 },

  ctaWrap: { borderRadius: Radius.pill, ...Shadow.brand },
  cta: { borderRadius: Radius.pill, paddingVertical: 17, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },

  terms: { fontSize: FontSize.xs, color: Colors.gray400, textAlign: 'center', marginTop: Spacing.md, lineHeight: 16 },

  // Success screen
  doneContainer: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  doneCircle: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.lg, ...Shadow.brand,
  },
  doneTitle: { fontSize: 30, fontWeight: FontWeight.heavy, color: Colors.ink, marginBottom: 10 },
  doneSubtitle: { fontSize: FontSize.md, color: Colors.gray500, textAlign: 'center', lineHeight: 22 },
});
