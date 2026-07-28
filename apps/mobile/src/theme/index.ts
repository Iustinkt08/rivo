// =============================================================================
// NAVIRA — Design System
// Brand gradient: #6C0000 → #A22921 → #EF6351
// =============================================================================

export const Colors = {
  // ── Brand ──────────────────────────────────────────────────────────────────
  primary: '#A22921',        // brick red — main brand solid
  primaryDark: '#6C0000',    // deep blood red — gradient start, pressed states
  primaryLight: '#FCEAE6',   // soft tint — active chips, light backgrounds
  coral: '#EF6351',          // bright coral — gradient end, highlights

  accent: '#EF6351',         // coral — tags, highlights
  accentLight: '#FDEBE7',

  // ── Functional ─────────────────────────────────────────────────────────────
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#E5484D',

  // ── Neutrals (warm-leaning) ─────────────────────────────────────────────────
  black: '#141414',
  ink: '#1A1A1A',            // headings
  gray900: '#1A1A1A',
  gray700: '#3A3A3A',
  gray500: '#8A8A8A',
  gray400: '#A8A8A8',
  gray300: '#CBCBCB',
  gray100: '#F2F2F2',
  gray50: '#F8F8F8',
  white: '#FFFFFF',

  // ── Surfaces ────────────────────────────────────────────────────────────────
  background: '#FAFAFA',
  card: '#FFFFFF',
  border: '#ECECEC',
  overlay: 'rgba(20,20,20,0.55)',

  star: '#FBBF24',
};

// Diagonal/horizontal gradient stop sets for <LinearGradient colors={...} />
export const Gradients = {
  brand: ['#6C0000', '#A22921', '#EF6351'] as [string, string, string],
  brandSoft: ['#A22921', '#EF6351'] as [string, string],
  brandDeep: ['#5A0000', '#8A1F18'] as [string, string],
  // Standard diagonal direction used across brand surfaces
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 40,
  full: 999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 26,
  xxxl: 34,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 5,
  },
  lg: {
    shadowColor: '#A22921',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 8,
  },
  // Soft red glow used under primary gradient buttons / cards
  brand: {
    shadowColor: '#A22921',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 9,
  },
};
