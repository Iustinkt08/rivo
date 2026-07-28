import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';
import { useBusinessStore } from '../../store/businessStore';
import { businessApi, SalonReviewItem } from '../../services/api/business';
import { backToSettings } from '../../components/business/SettingsHeader';

const SUBTLE_BORDER = 'rgba(216,216,216,0.8)';
const MUTED = 'rgba(34,34,34,0.65)';
const MAX_REPLY = 1000;

function Stars({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={14}
          color={i <= rating ? Colors.star : Colors.gray300}
        />
      ))}
    </View>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ReviewsScreen() {
  const router = useRouter();
  const { salonProfile } = useBusinessStore();
  const salonId = salonProfile?.id ?? null;

  const [reviews, setReviews] = useState<SalonReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!salonId) return;
    setError(false);
    try {
      const data = await businessApi.getReviews(salonId);
      setReviews(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [salonId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const openReply = (id: string) => { setReplyingId(id); setReplyText(''); };
  const cancelReply = () => { setReplyingId(null); setReplyText(''); };

  const submitReply = async (reviewId: string) => {
    const text = replyText.trim();
    if (!text) return;
    setSending(true);
    try {
      const updated = await businessApi.replyToReview(reviewId, text);
      // Merge the server reply into the local list (keep staff/client fields).
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? { ...r, replyText: updated.replyText ?? text, repliedAt: updated.repliedAt ?? new Date().toISOString() }
            : r,
        ),
      );
      cancelReply();
    } catch {
      Alert.alert('Eroare', 'Răspunsul nu a putut fi trimis. Încearcă din nou.');
    } finally {
      setSending(false);
    }
  };

  const averageRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => backToSettings(router)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recenzii</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {averageRating && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryAvg}>{averageRating}</Text>
              <View>
                <Stars rating={Math.round(Number(averageRating))} />
                <Text style={styles.summaryCount}>{reviews.length} recenzii</Text>
              </View>
            </View>
          )}

          {error && (
            <TouchableOpacity style={styles.errorBanner} onPress={load} activeOpacity={0.8}>
              <Ionicons name="cloud-offline-outline" size={16} color={Colors.error} />
              <Text style={styles.errorText}>Nu am putut încărca recenziile. Atinge pentru a reîncerca.</Text>
            </TouchableOpacity>
          )}

          {loading ? (
            <View style={styles.loader}><ActivityIndicator color={Colors.primary} size="large" /></View>
          ) : reviews.length === 0 && !error ? (
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={40} color={Colors.gray300} />
              <Text style={styles.emptyTitle}>Nicio recenzie încă</Text>
              <Text style={styles.emptyBody}>Recenziile clienților vor apărea aici după programările finalizate.</Text>
            </View>
          ) : (
            reviews.map((r) => (
              <View key={r.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clientName}>{r.clientName}</Text>
                    {r.staffName && <Text style={styles.staffLine}>cu {r.staffName}</Text>}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Stars rating={r.rating} />
                    <Text style={styles.date}>{formatDate(r.createdAt)}</Text>
                  </View>
                </View>

                {!!r.comment && <Text style={styles.comment}>{r.comment}</Text>}

                {r.replyText ? (
                  <View style={styles.replyBlock}>
                    <Text style={styles.replyLabel}>Răspunsul tău</Text>
                    <Text style={styles.replyTextValue}>{r.replyText}</Text>
                  </View>
                ) : replyingId === r.id ? (
                  <View style={styles.replyEditor}>
                    <TextInput
                      style={styles.replyInput}
                      placeholder="Scrie un răspuns public…"
                      placeholderTextColor={Colors.gray300}
                      value={replyText}
                      onChangeText={setReplyText}
                      multiline
                      maxLength={MAX_REPLY}
                      textAlignVertical="top"
                    />
                    <View style={styles.replyActions}>
                      <TouchableOpacity onPress={cancelReply} style={styles.replyCancel} disabled={sending}>
                        <Text style={styles.replyCancelText}>Anulează</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => submitReply(r.id)}
                        style={[styles.replySend, (!replyText.trim() || sending) && { opacity: 0.5 }]}
                        disabled={!replyText.trim() || sending}
                      >
                        {sending
                          ? <ActivityIndicator color={Colors.white} size="small" />
                          : <Text style={styles.replySendText}>Trimite</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.replyBtn} onPress={() => openReply(r.id)} activeOpacity={0.7}>
                    <Ionicons name="arrow-undo-outline" size={15} color={Colors.primary} />
                    <Text style={styles.replyBtnText}>Răspunde</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black },

  content: { padding: Spacing.lg, paddingTop: Spacing.sm },

  summaryCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderRadius: Radius.xl, borderWidth: 1, borderColor: SUBTLE_BORDER,
  },
  summaryAvg: { fontSize: 34, fontWeight: FontWeight.heavy, color: Colors.primary },
  summaryCount: { fontSize: FontSize.xs, color: MUTED, marginTop: 4 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEE2E2', borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.md,
  },
  errorText: { flex: 1, fontSize: FontSize.xs, color: Colors.error },

  loader: { paddingVertical: 60, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 50, gap: 8 },
  emptyTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.gray700, marginTop: 4 },
  emptyBody: { fontSize: FontSize.sm, color: Colors.gray500, textAlign: 'center', lineHeight: 19, paddingHorizontal: Spacing.lg },

  card: {
    borderRadius: Radius.xl, borderWidth: 1, borderColor: SUBTLE_BORDER,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  clientName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.black },
  staffLine: { fontSize: FontSize.xs, color: MUTED, marginTop: 2 },
  date: { fontSize: 11, color: Colors.gray400 },
  comment: { fontSize: FontSize.sm, color: Colors.gray700, lineHeight: 20, marginTop: Spacing.sm },

  replyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    marginTop: Spacing.sm, paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.primary,
  },
  replyBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.primary },

  replyBlock: {
    marginTop: Spacing.sm, padding: Spacing.sm,
    borderRadius: Radius.md, backgroundColor: Colors.primaryLight,
  },
  replyLabel: { fontSize: 11, fontWeight: FontWeight.semibold, color: Colors.primary, marginBottom: 3 },
  replyTextValue: { fontSize: FontSize.sm, color: Colors.gray700, lineHeight: 19 },

  replyEditor: { marginTop: Spacing.sm },
  replyInput: {
    borderRadius: Radius.md, borderWidth: 1.5, borderColor: SUBTLE_BORDER,
    padding: Spacing.sm, minHeight: 72, fontSize: FontSize.sm, color: Colors.black,
  },
  replyActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.sm },
  replyCancel: { paddingVertical: 8, paddingHorizontal: 16 },
  replyCancelText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.gray500 },
  replySend: {
    paddingVertical: 8, paddingHorizontal: 20, borderRadius: Radius.full,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', minWidth: 90,
  },
  replySendText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.white },
});
