import React, { useState } from 'react';
import {
  Modal, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';
import type { StaffCredentials } from '../../services/api/business';

/**
 * One-time display of a staff member's login credentials. The password can
 * never be retrieved again — the owner must save/share it now.
 */
export default function StaffCredentialsModal({
  credentials, staffName, onClose,
}: {
  credentials: StaffCredentials | null;
  staffName: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<'username' | 'password' | null>(null);

  const copy = async (field: 'username' | 'password', value: string) => {
    await Clipboard.setStringAsync(value);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Modal visible={!!credentials} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="key" size={26} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Cont de staff creat</Text>
          <Text style={styles.subtitle}>
            Date de autentificare pentru {staffName}. Se conectează din ecranul
            de login, cu username în loc de email.
          </Text>

          {credentials && (
            <>
              <CredentialRow
                label="Username"
                value={credentials.username}
                copied={copied === 'username'}
                onCopy={() => copy('username', credentials.username)}
              />
              <CredentialRow
                label="Parolă"
                value={credentials.password}
                copied={copied === 'password'}
                onCopy={() => copy('password', credentials.password)}
              />
            </>
          )}

          <View style={styles.warning}>
            <Ionicons name="warning-outline" size={16} color={Colors.warning} />
            <Text style={styles.warningText}>
              Parola se afișează o singură dată. Salveaz-o acum — ulterior o poți
              doar reseta.
            </Text>
          </View>

          <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.doneText}>Am salvat datele</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function CredentialRow({
  label, value, copied, onCopy,
}: {
  label: string; value: string; copied: boolean; onCopy: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue} selectable>{value}</Text>
      </View>
      <TouchableOpacity style={styles.copyBtn} onPress={onCopy}>
        <Ionicons
          name={copied ? 'checkmark-outline' : 'copy-outline'}
          size={16}
          color={copied ? Colors.success : Colors.primary}
        />
      </TouchableOpacity>
    </View>
  );
}

const SUBTLE_BORDER = 'rgba(216,216,216,0.8)';

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: Colors.overlay,
    alignItems: 'center', justifyContent: 'center', padding: Spacing.lg,
  },
  card: {
    width: '100%', maxWidth: 380, backgroundColor: Colors.white,
    borderRadius: Radius.xl, padding: Spacing.lg, alignItems: 'center',
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm,
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black },
  subtitle: {
    fontSize: FontSize.sm, color: Colors.gray500, textAlign: 'center',
    marginTop: 6, marginBottom: Spacing.md, lineHeight: 19,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch',
    borderWidth: 1, borderColor: SUBTLE_BORDER, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md, paddingVertical: 10, marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  rowLabel: { fontSize: FontSize.xs, color: Colors.gray500, fontWeight: FontWeight.semibold },
  rowValue: {
    fontSize: FontSize.md, color: Colors.black, fontWeight: FontWeight.semibold,
    fontFamily: 'Menlo', marginTop: 2,
  },
  copyBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },

  warning: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start', alignSelf: 'stretch',
    backgroundColor: '#FEF3C7', borderRadius: Radius.md, padding: Spacing.sm,
    marginTop: 4, marginBottom: Spacing.md,
  },
  warningText: { flex: 1, fontSize: FontSize.xs, color: Colors.gray700, lineHeight: 17 },

  doneBtn: {
    alignSelf: 'stretch', backgroundColor: Colors.primary,
    borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center',
  },
  doneText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
