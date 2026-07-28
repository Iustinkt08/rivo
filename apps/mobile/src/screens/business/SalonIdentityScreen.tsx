import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSize, FontWeight, Radius, Shadow, Spacing } from '../../theme';
import { useBusinessStore } from '../../store/businessStore';
import { businessApi } from '../../services/api/business';
import SettingsHeader, { backToSettings } from '../../components/business/SettingsHeader';

export default function SalonIdentityScreen() {
  const router = useRouter();
  const { salonProfile, setSalonProfile } = useBusinessStore();

  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [phone,       setPhone]       = useState('');
  const [email,       setEmail]       = useState('');
  const [websiteUrl,  setWebsiteUrl]  = useState('');
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    const load = async () => {
      const p = salonProfile ?? await businessApi.getSalonProfile().catch(() => null);
      if (!p) return;
      if (!salonProfile) setSalonProfile(p);
      setName(p.name);
      setDescription(p.description ?? '');
      setPhone(p.phone ?? '');
      setEmail(p.email ?? '');
      setWebsiteUrl(p.websiteUrl ?? '');
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Câmp obligatoriu', 'Numele salonului nu poate fi gol.');
      return;
    }
    setSaving(true);
    try {
      const id = salonProfile?.id;
      if (!id) {
        Alert.alert('Niciun salon', 'Nu am găsit salonul tău. Reîncarcă pagina și încearcă din nou.');
        return;
      }

      const patch = {
        name: name.trim(),
        description: description.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
      };

      await businessApi.updateSalonProfile(id, patch);
      setSalonProfile({ ...salonProfile, ...patch });
      Alert.alert('Salvat', 'Identitatea salonului a fost actualizată.', [
        { text: 'OK', onPress: () => backToSettings(router) },
      ]);
    } catch {
      Alert.alert('Eroare', 'Nu s-au putut salva modificările. Încearcă din nou.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SettingsHeader title="Nume & Descriere" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <SectionTitle>Identitate</SectionTitle>
          <Card>
            <Field label="Nume salon *" value={name} onChange={setName} placeholder="Studio Bella" />
            <Divider />
            <Field
              label="Descriere" value={description} onChange={setDescription}
              placeholder="Salonul nr. 1 din București pentru hair & nails..."
              multiline maxLength={400}
            />
            {description.length > 0 && (
              <Text style={styles.charCount}>{description.length}/400</Text>
            )}
          </Card>

          <SectionTitle>Date de contact</SectionTitle>
          <Card>
            <Field
              label="Telefon" value={phone} onChange={setPhone}
              placeholder="+40712 345 678" keyboardType="phone-pad"
            />
            <Divider />
            <Field
              label="Email" value={email} onChange={setEmail}
              placeholder="contact@salon.ro" keyboardType="email-address" autoCapitalize="none"
            />
            <Divider />
            <Field
              label="Website" value={websiteUrl} onChange={setWebsiteUrl}
              placeholder="https://salon.ro" keyboardType="url" autoCapitalize="none"
            />
          </Card>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={Colors.white} />
              : <><Ionicons name="checkmark-circle" size={20} color={Colors.white} /><Text style={styles.saveBtnText}>Salvează</Text></>
            }
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Shared ────────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Divider() {
  return <View style={styles.divider} />;
}

function Field({
  label, value, onChange, placeholder, multiline, maxLength, keyboardType, autoCapitalize,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  multiline?: boolean; maxLength?: number; keyboardType?: any; autoCapitalize?: any;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.gray300}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        maxLength={maxLength}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        textAlignVertical={multiline ? 'top' : 'auto'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  sectionTitle: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.gray500,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.white, borderRadius: Radius.lg, overflow: 'hidden',
    marginBottom: Spacing.md, ...Shadow.sm,
  },
  divider: { height: 1, backgroundColor: Colors.gray50, marginHorizontal: Spacing.md },
  field: { paddingHorizontal: Spacing.md, paddingVertical: 12 },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.gray500, marginBottom: 4 },
  fieldInput: { fontSize: FontSize.md, color: Colors.black, padding: 0 },
  fieldInputMulti: { minHeight: 80 },
  charCount: { fontSize: FontSize.xs, color: Colors.gray300, textAlign: 'right', paddingHorizontal: Spacing.md, paddingBottom: 8 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: 16, marginTop: Spacing.sm,
  },
  saveBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
