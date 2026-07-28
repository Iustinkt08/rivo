import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';
import { bookingsApi } from '../../services/api/bookings';

const STAR_LABELS = ['', 'Slab', 'Acceptabil', 'Bun', 'Foarte bun', 'Excelent'];

export default function WriteReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    appointmentId: string;
    salonName: string;
    serviceName: string;
    date: string;
  }>();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setLoading(true);
    try {
      await bookingsApi.submitReview({
        appointmentId: params.appointmentId,
        rating,
        comment: comment.trim() || undefined,
      });
      setDone(true);
      setTimeout(() => router.back(), 1800);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => router.back();

  if (done) {
    return (
      <View style={styles.doneWrap}>
        <View style={styles.doneCircle}>
          <Ionicons name="checkmark" size={40} color={Colors.white} />
        </View>
        <Text style={styles.doneTitle}>Mulțumim!</Text>
        <Text style={styles.doneSub}>Recenzia ta a fost trimisă.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>Recenzează experiența</Text>
          <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color={Colors.gray500} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* Appointment context */}
          <View style={styles.contextCard}>
            <Text style={styles.salonName}>{params.salonName}</Text>
            <Text style={styles.serviceName}>{params.serviceName}</Text>
            {params.date ? (
              <Text style={styles.dateText}>
                {new Date(params.date + 'T12:00:00').toLocaleDateString('ro-RO', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })}
              </Text>
            ) : null}
          </View>

          {/* Stars */}
          <View style={styles.starsSection}>
            <Text style={styles.starsPrompt}>Cum a fost experiența?</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => setRating(n)} activeOpacity={0.7}>
                  <Ionicons
                    name={n <= rating ? 'star' : 'star-outline'}
                    size={48}
                    color={n <= rating ? Colors.star : Colors.gray300}
                  />
                </TouchableOpacity>
              ))}
            </View>
            {rating > 0 && (
              <Text style={styles.starLabel}>{STAR_LABELS[rating]}</Text>
            )}
          </View>

          {/* Comment */}
          <TextInput
            style={styles.commentInput}
            placeholder="Adaugă un comentariu (opțional)..."
            placeholderTextColor={Colors.gray300}
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={400}
            textAlignVertical="top"
          />
        </View>

        {/* Submit */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitBtn, rating === 0 && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={rating === 0 || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.submitText}>Trimite recenzia</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
            <Text style={styles.skipText}>Acum nu</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  headerLabel: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.black },

  body: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },

  contextCard: {
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.xl,
    borderLeftWidth: 3, borderLeftColor: Colors.primary,
  },
  salonName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.black },
  serviceName: { fontSize: FontSize.sm, color: Colors.gray700, marginTop: 2 },
  dateText: { fontSize: FontSize.xs, color: Colors.gray500, marginTop: 4 },

  starsSection: { alignItems: 'center', marginBottom: Spacing.xl },
  starsPrompt: {
    fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.black,
    marginBottom: Spacing.lg,
  },
  starsRow: { flexDirection: 'row', gap: Spacing.sm },
  starLabel: {
    marginTop: Spacing.md, fontSize: FontSize.md, fontWeight: FontWeight.semibold,
    color: Colors.star,
  },

  commentInput: {
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing.md, height: 110,
    fontSize: FontSize.md, color: Colors.black,
    borderWidth: 1, borderColor: Colors.border,
  },

  footer: {
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, paddingTop: Spacing.md,
    backgroundColor: Colors.background,
  },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingVertical: 16, alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: Colors.gray300 },
  submitText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  skipBtn: { alignItems: 'center', paddingTop: Spacing.md },
  skipText: { fontSize: FontSize.sm, color: Colors.gray500 },

  // Done state
  doneWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.background, gap: Spacing.md,
  },
  doneCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center',
  },
  doneTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.black },
  doneSub: { fontSize: FontSize.md, color: Colors.gray500 },
});
