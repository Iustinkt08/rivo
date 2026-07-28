import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { Colors, FontSize, FontWeight, Radius, Shadow, Spacing } from '../../theme';
import { staffAuthApi } from '../../services/api/staffAuth';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Full-screen password change for staff accounts (hidden business tab route).
 * Requires the current password; the new one must be confirmed and have at
 * least MIN_PASSWORD_LENGTH characters (mirrors the backend DTO rules).
 */
export default function StaffChangePasswordScreen() {
  const router = useRouter();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const isNextTooShort = next.length > 0 && next.length < MIN_PASSWORD_LENGTH;
  const isMismatch = confirm.length > 0 && next !== confirm;
  const isValid =
    current.length >= 1 &&
    next.length >= MIN_PASSWORD_LENGTH &&
    next === confirm;

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(business)/settings');
    }
  };

  const handleSubmit = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      await staffAuthApi.changePassword(current, next);
      Alert.alert(
        'Parolă schimbată',
        'Parola ta a fost actualizată cu succes.',
        [{ text: 'OK', onPress: goBack }],
      );
    } catch (err) {
      const isWrongPassword =
        axios.isAxiosError(err) && err.response?.status === 401;
      Alert.alert(
        'Eroare',
        isWrongPassword
          ? 'Parola actuală este greșită.'
          : 'Nu am putut schimba parola. Încearcă din nou.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={goBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Schimbă parola</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.infoBox}>
            <Ionicons name="key-outline" size={16} color={Colors.gray500} />
            <Text style={styles.infoText}>
              Parola contului tău de staff. Ai nevoie de parola actuală pentru a
              seta una nouă.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Parola actuală</Text>
            <TextInput
              style={styles.input}
              value={current}
              onChangeText={setCurrent}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              placeholder="••••••••"
              placeholderTextColor={Colors.gray300}
            />

            <Text style={styles.label}>
              Parola nouă (minim {MIN_PASSWORD_LENGTH} caractere)
            </Text>
            <TextInput
              style={styles.input}
              value={next}
              onChangeText={setNext}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              placeholder="••••••••"
              placeholderTextColor={Colors.gray300}
            />
            {isNextTooShort && (
              <Text style={styles.errorText}>
                Parola nouă trebuie să aibă minim {MIN_PASSWORD_LENGTH} caractere.
              </Text>
            )}

            <Text style={styles.label}>Confirmă parola nouă</Text>
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              placeholder="••••••••"
              placeholderTextColor={Colors.gray300}
            />
            {isMismatch && (
              <Text style={styles.errorText}>Parolele nu coincid.</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, (!isValid || saving) && { opacity: 0.5 }]}
            disabled={!isValid || saving}
            onPress={handleSubmit}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.saveBtnText}>Salvează parola</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles (mirrors the business settings visual language) ────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: 14,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderColor: Colors.border,
  },
  backBtn: {
    width: 38, height: 38, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.gray50, borderRadius: Radius.full,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black },

  content: { padding: Spacing.lg, paddingBottom: 130 },

  infoBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    marginBottom: Spacing.lg,
    backgroundColor: Colors.gray50, borderRadius: Radius.md, padding: Spacing.sm,
  },
  infoText: { flex: 1, fontSize: FontSize.xs, color: Colors.gray500, lineHeight: 17 },

  card: {
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing.md, ...Shadow.md,
  },
  label: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.gray500,
    marginBottom: 6, marginTop: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.gray50, borderRadius: Radius.lg, borderWidth: 1.5,
    borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 12,
    fontSize: FontSize.md, color: Colors.black,
  },
  errorText: { fontSize: FontSize.xs, color: Colors.error, marginTop: 6 },

  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: 14,
    alignItems: 'center', marginTop: Spacing.lg,
  },
  saveBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
