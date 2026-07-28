import { StyleSheet } from 'react-native';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';

// ── Visual constants (NAVIRA look — mirrors HomeScreen) ──────────────────────
const H_PAD = 28;                               // screen horizontal padding
const SUBTLE_BORDER = 'rgba(216,216,216,0.8)';  // hairline card border
const MUTED = 'rgba(34,34,34,0.65)';            // secondary text
// Soft ambient shadow — same recipe as the Home search bar; used sparingly.
const SOFT_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.13,
  shadowRadius: 9,
  elevation: 4,
} as const;

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: H_PAD, paddingVertical: Spacing.md,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.ink },
  headerSubtitle: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.medium, marginTop: 1 },

  // Step indicator — thin segments, gradient fill on progress
  stepBar: { flexDirection: 'row', gap: 6, paddingHorizontal: H_PAD, marginTop: 2 },
  stepSegment: {
    flex: 1, height: 4, borderRadius: Radius.full,
    backgroundColor: Colors.gray100, overflow: 'hidden',
  },
  stepSegmentFill: { flex: 1, borderRadius: Radius.full },
  stepCaption: {
    fontSize: 12, fontWeight: FontWeight.medium, color: MUTED,
    paddingHorizontal: H_PAD, marginTop: 8, marginBottom: 2,
  },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },

  stepContent: { paddingHorizontal: H_PAD, paddingVertical: Spacing.lg },
  stepTitle: { fontSize: 20, fontWeight: FontWeight.semibold, color: Colors.primary, marginBottom: Spacing.lg },

  stepEmpty: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  stepEmptyText: {
    fontSize: FontSize.sm, color: MUTED,
    textAlign: 'center', lineHeight: 20, paddingHorizontal: H_PAD,
  },

  // Category chips — pills with hairline border
  chipsRow: { gap: 8, marginBottom: Spacing.md },
  categoryChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: SUBTLE_BORDER,
  },
  categoryChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  categoryChipText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: MUTED },
  categoryChipTextActive: { color: Colors.primary },

  // Option cards — white pill cards, hairline border (like Home ProCard)
  optionCard: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: Colors.white, borderRadius: Radius.xl, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: SUBTLE_BORDER,
  },
  optionCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  optionName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: '#222', marginBottom: 3 },
  optionMeta: { fontSize: FontSize.xs, color: MUTED },
  optionPrice: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: '#222', marginBottom: 4 },
  staffAvatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.gray50,
    alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm,
    borderWidth: 1, borderColor: SUBTLE_BORDER,
  },

  // Date strip — rounded day chips
  dateStrip: { gap: Spacing.sm, paddingBottom: Spacing.md },
  dayChip: {
    width: 58, alignItems: 'center', paddingVertical: 12,
    borderRadius: Radius.xl, backgroundColor: Colors.white,
    borderWidth: 1, borderColor: SUBTLE_BORDER,
  },
  dayChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  dayLabel: { fontSize: FontSize.xs, color: MUTED, fontWeight: FontWeight.medium },
  dayNum: { fontSize: FontSize.xl, fontWeight: FontWeight.semibold, color: '#222', marginTop: 3 },

  // Slots — pill chips
  slotsHeading: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink, marginBottom: Spacing.sm },
  slotsLoader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: Spacing.lg },
  slotsLoaderText: { fontSize: FontSize.sm, color: MUTED },
  noSlots: { alignItems: 'center', paddingVertical: Spacing.xl },
  noSlotsText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: MUTED, marginTop: Spacing.sm },
  noSlotsSubText: {
    fontSize: FontSize.sm, color: Colors.gray400, marginTop: 4,
    textAlign: 'center', paddingHorizontal: Spacing.lg,
  },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotChip: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: Radius.full,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: SUBTLE_BORDER,
    alignItems: 'center',
  },
  slotChipActive:  { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  slotChipUnavail: { backgroundColor: Colors.gray50, borderColor: Colors.gray100 },
  slotText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#222' },
  slotUnavailLabel: { fontSize: 9, color: Colors.gray300, marginTop: 1 },

  // Lock notice
  lockNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.primaryLight, borderRadius: Radius.lg,
    padding: Spacing.sm, marginTop: Spacing.md,
  },
  lockNoticeUrgent: { backgroundColor: '#FEE2E2' },
  lockText: { fontSize: FontSize.xs, color: Colors.primary, flex: 1, lineHeight: 17 },

  // Summary — soft-shadow white card (shadow used sparingly, like Home search bar)
  summaryCard: {
    backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.lg,
    ...SOFT_SHADOW,
  },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: Spacing.sm,
    borderBottomWidth: 1, borderColor: Colors.gray50,
  },
  summaryLabel: { fontSize: FontSize.sm, color: MUTED, flex: 1 },
  summaryValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#222', flex: 1, textAlign: 'right' },
  divider: { height: 1, backgroundColor: Colors.gray100, marginVertical: Spacing.sm },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 },
  totalLabel: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: '#222' },
  totalValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary },

  // Discount code (step 4) — green accents mark an applied, server-validated code
  discountSummaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 4,
  },
  discountSummaryLabel: { fontSize: FontSize.sm, color: MUTED },
  discountSummaryStruck: {
    fontSize: FontSize.sm, color: MUTED, textDecorationLine: 'line-through',
  },
  discountSummaryGreen: {
    fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.success,
  },
  discountInputRow: { flexDirection: 'row', gap: Spacing.sm },
  discountInput: {
    flex: 1, backgroundColor: Colors.white, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: SUBTLE_BORDER,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    fontSize: FontSize.sm, color: Colors.ink, letterSpacing: 1,
  },
  discountApplyBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center',
    minWidth: 84,
  },
  discountApplyText: {
    color: Colors.white, fontSize: FontSize.sm, fontWeight: FontWeight.semibold,
  },
  discountAppliedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#ECFDF3', borderRadius: Radius.lg,
    borderWidth: 1, borderColor: '#BBF0CC',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
  },
  discountAppliedCode: {
    flex: 1, fontSize: FontSize.sm, fontWeight: FontWeight.bold,
    color: Colors.ink, letterSpacing: 1,
  },
  discountAppliedAmount: {
    fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.success,
  },
  discountErrorText: {
    fontSize: FontSize.xs, color: Colors.error, marginTop: 6, lineHeight: 16,
  },

  notesLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  notesInput: {
    backgroundColor: Colors.white, borderRadius: Radius.lg, borderWidth: 1, borderColor: SUBTLE_BORDER,
    padding: Spacing.md, fontSize: FontSize.sm, color: Colors.ink, minHeight: 90,
  },
  notesCounter: { fontSize: 11, color: Colors.gray400, textAlign: 'right', marginTop: 4, marginBottom: 4 },

  cancelPolicy: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: Spacing.md,
    backgroundColor: Colors.gray50, borderRadius: Radius.lg, padding: Spacing.sm,
  },
  cancelText: { fontSize: FontSize.xs, color: MUTED, flex: 1, lineHeight: 17 },

  // Footer — clean white, no hard top border
  footer: {
    paddingHorizontal: H_PAD, paddingBottom: 28, paddingTop: 10,
    backgroundColor: Colors.white,
  },
  countdownBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primaryLight, borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 8, marginBottom: 10,
  },
  countdownBannerText: {
    fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold, flex: 1,
  },
});
