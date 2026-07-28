import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import { Colors, FontSize, FontWeight, Gradients, Radius, Shadow, Spacing } from '../../theme';

const MIN_PASSWORD_LENGTH = 6;

export default function ChangePasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [newFocused,      setNewFocused]      = useState(false);
  const [confirmFocused,  setConfirmFocused]  = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [inlineError,     setInlineError]     = useState<string | null>(null);

  const validate = (): string | null => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return `Parola trebuie să aibă cel puțin ${MIN_PASSWORD_LENGTH} caractere.`;
    }
    if (newPassword !== confirmPassword) {
      return 'Parolele nu coincid. Te rugăm să le reverifici.';
    }
    return null;
  };

  const handleSave = async () => {
    const error = validate();
    if (error) {
      setInlineError(error);
      return;
    }
    setInlineError(null);
    setSaving(true);
    try {
      const { error: supabaseError } = await supabase.auth.updateUser({ password: newPassword });
      if (supabaseError) {
        Alert.alert('Eroare', supabaseError.message ?? 'Nu s-a putut schimba parola.');
        return;
      }
      Alert.alert(
        'Parolă schimbată',
        'Parola ta a fost actualizată cu succes.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (e: any) {
      const msg = e?.message ?? 'A apărut o eroare neașteptată.';
      Alert.alert('Eroare', msg);
    } finally {
      setSaving(false);
    }
  };

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
        <Text style={styles.headerTitle}>Schimbă parola</Text>
        <View style={styles.headerSpacer} />
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Password card ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Parolă nouă</Text>

            {/* New password */}
            <View style={fieldSt.wrap}>
              <Text style={fieldSt.label}>Parolă nouă</Text>
              <View style={[fieldSt.inputRow, newFocused && fieldSt.inputRowFocused]}>
                <TextInput
                  style={fieldSt.input}
                  value={newPassword}
                  onChangeText={(t) => { setNewPassword(t); setInlineError(null); }}
                  placeholder="Introdu parola nouă"
                  placeholderTextColor={Colors.gray300}
                  secureTextEntry={!showNew}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setNewFocused(true)}
                  onBlur={() => setNewFocused(false)}
                />
                <TouchableOpacity
                  onPress={() => setShowNew((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showNew ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={Colors.gray400}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm password */}
            <View style={fieldSt.wrap}>
              <Text style={fieldSt.label}>Confirmă parola</Text>
              <View style={[fieldSt.inputRow, confirmFocused && fieldSt.inputRowFocused]}>
                <TextInput
                  style={fieldSt.input}
                  value={confirmPassword}
                  onChangeText={(t) => { setConfirmPassword(t); setInlineError(null); }}
                  placeholder="Repetă parola nouă"
                  placeholderTextColor={Colors.gray300}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setConfirmFocused(true)}
                  onBlur={() => setConfirmFocused(false)}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirm((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={Colors.gray400}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Inline validation error */}
            {inlineError != null && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={15} color={Colors.error} />
                <Text style={styles.errorText}>{inlineError}</Text>
              </View>
            )}

            {/* Password requirements hint */}
            <View style={styles.hintRow}>
              <Ionicons name="information-circle-outline" size={14} color={Colors.gray400} />
              <Text style={styles.hintText}>
                Parola trebuie să aibă cel puțin {MIN_PASSWORD_LENGTH} caractere.
              </Text>
            </View>
          </View>

          {/* ── Submit button ── */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.saveBtnText}>Salvează parola</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Field sub-styles (matches EditProfileScreen pattern) ──────────────────────

const fieldSt = StyleSheet.create({
  wrap: { marginBottom: Spacing.sm },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.gray500,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  inputRowFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  input: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.ink,
    padding: 0,
  },
});

// ── Screen styles ─────────────────────────────────────────────────────────────

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
    paddingBottom: 48,
  },

  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    marginBottom: Spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.error,
    fontWeight: FontWeight.medium,
  },

  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  hintText: {
    fontSize: FontSize.xs,
    color: Colors.gray400,
    flex: 1,
  },

  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.brand,
  },
  saveBtnDisabled: {
    opacity: 0.65,
  },
  saveBtnText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
});
