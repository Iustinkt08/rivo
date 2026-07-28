import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, FontWeight, Gradients, Radius, Shadow, Spacing } from '../../theme';
import { useAuthStore } from '../../store/authStore';

const CODE_LENGTH = 6;

export default function OTPScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const phone = params.phone as string;

  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(59);
  const [loading, setLoading] = useState(false);
  const [wrongCode, setWrongCode] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const { verifyOtp, sendOtp } = useAuthStore();

  useEffect(() => {
    inputRef.current?.focus();
    const interval = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleVerify = async () => {
    if (code.length < CODE_LENGTH) return;
    setLoading(true);
    setWrongCode(false);
    try {
      const { isNewUser } = await verifyOtp(phone, code);
      const { user } = useAuthStore.getState();
      if (user?.role === 'ADMIN_SALON' && isNewUser) {
        router.replace('/(onboarding)');
      } else if (user?.role === 'ADMIN_SALON') {
        router.replace('/(business)');
      } else {
        router.replace('/(client)');
      }
    } catch {
      setWrongCode(true);
      setCode('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await sendOtp(phone);
      setCountdown(59);
      setCode('');
      setWrongCode(false);
    } catch {
      Alert.alert('Eroare', 'Nu am putut retrimite codul. Încearcă din nou.');
    }
  };

  const digits = Array.from({ length: CODE_LENGTH }, (_, i) => code[i] ?? '');

  return (
    <SafeAreaView style={styles.safe}>

      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={26} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Înregistrare</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Verifică telefonul</Text>
        <Text style={styles.subtitle}>
          Introdu codul de securitate de {CODE_LENGTH} cifre{'\n'}trimis la{' '}
          <Text style={{ color: Colors.coral, fontWeight: FontWeight.semibold }}>{phone}</Text>
        </Text>

        {/* OTP digit display */}
        <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()} style={styles.codeRow}>
          {digits.map((d, i) => (
            <View
              key={i}
              style={[
                styles.digitBox,
                i === code.length && styles.digitActive,
                wrongCode && styles.digitError,
              ]}
            >
              <Text style={styles.digit}>{d}</Text>
            </View>
          ))}
        </TouchableOpacity>

        {/* Hidden real input */}
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          keyboardType="number-pad"
          maxLength={CODE_LENGTH}
          value={code}
          onChangeText={(v) => { setCode(v); if (wrongCode) setWrongCode(false); }}
        />

        {/* Error / resend */}
        {wrongCode && (
          <Text style={styles.statusText}>
            <Text style={{ color: Colors.coral, fontWeight: FontWeight.semibold }}>Cod greșit</Text>
            , te rugăm încearcă din nou
          </Text>
        )}

        {countdown > 0 ? (
          <Text style={styles.statusText}>
            Retrimite codul în <Text style={{ color: Colors.coral, fontWeight: FontWeight.bold }}>{countdown}</Text>
          </Text>
        ) : (
          <TouchableOpacity onPress={handleResend}>
            <Text style={styles.statusText}>
              Nu am primit codul.{' '}
              <Text style={{ color: Colors.coral, fontWeight: FontWeight.bold }}>Retrimite</Text>
            </Text>
          </TouchableOpacity>
        )}

        {/* Verify */}
        <TouchableOpacity
          activeOpacity={0.88}
          disabled={code.length < CODE_LENGTH || loading}
          onPress={handleVerify}
          style={[styles.ctaWrap, (code.length < CODE_LENGTH || loading) && { opacity: 0.5 }]}
        >
          <LinearGradient colors={Gradients.brand} start={Gradients.start} end={Gradients.end} style={styles.cta}>
            <Text style={styles.ctaText}>{loading ? 'Se verifică…' : 'Verifică'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
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

  content: { flex: 1, paddingHorizontal: Spacing.lg },

  title: {
    fontSize: 30, fontWeight: FontWeight.heavy, color: Colors.ink,
    letterSpacing: -0.5, marginTop: Spacing.xl, marginBottom: Spacing.sm,
  },
  subtitle: { fontSize: FontSize.md, color: Colors.gray500, lineHeight: 22, marginBottom: Spacing.xl },

  codeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.lg },
  digitBox: {
    width: 52, height: 60, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.coral,
    backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center',
    ...Shadow.sm,
  },
  digitActive: { borderColor: Colors.primary, borderWidth: 2 },
  digitError: { borderColor: Colors.error },
  digit: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.ink },
  hiddenInput: { position: 'absolute', opacity: 0, height: 0 },

  statusText: { fontSize: FontSize.md, color: Colors.gray700, textAlign: 'center', marginBottom: Spacing.md },

  ctaWrap: { borderRadius: Radius.pill, marginTop: Spacing.md, ...Shadow.brand },
  cta: { borderRadius: Radius.pill, paddingVertical: 17, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
