// Pure helpers for the staff public profile: social-link normalization and
// public visibility settings. Kept free of Nest/Prisma imports so they are
// unit-testable in isolation.

export const SOCIAL_KEYS = [
  'instagram',
  'facebook',
  'tiktok',
  'website',
] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

/** Normalized socials: every value is a full https:// URL. */
export type StaffSocials = Partial<Record<SocialKey, string>>;

// Bare handles ("@ana" / "ana") are expanded to the platform profile URL.
const HANDLE_BASE_URL: Record<SocialKey, string> = {
  instagram: 'https://instagram.com/',
  facebook: 'https://facebook.com/',
  tiktok: 'https://www.tiktok.com/@',
  website: 'https://',
};

/**
 * Normalizes one social value: full https:// URLs pass through, bare handles
 * (with or without a leading @) become platform URLs. Returns null when the
 * value is empty after trimming.
 */
export function normalizeSocialValue(
  key: SocialKey,
  raw: string,
): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith('https://')) return value;
  const handle = value.replace(/^@/, '');
  if (!handle) return null;
  return `${HANDLE_BASE_URL[key]}${handle}`;
}

/**
 * Normalizes an untyped socials payload (DTO body or Json column) into a clean
 * object with only known keys and full https:// URLs. Unknown keys and
 * non-string / empty values are dropped.
 */
export function normalizeSocials(raw: unknown): StaffSocials {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const entries = SOCIAL_KEYS.flatMap((key) => {
    const value = source[key];
    if (typeof value !== 'string') return [];
    const normalized = normalizeSocialValue(key, value);
    return normalized ? [[key, normalized] as const] : [];
  });
  return Object.fromEntries(entries);
}

// ─── Public visibility settings ───────────────────────────────────────────────

export interface PublicVisibility {
  showSocials: boolean;
  showContact: boolean;
  showApptCount: boolean;
  showGallery: boolean;
}

/**
 * Defaults when Staff.publicSettings is null (or a key is missing):
 * gallery + socials are shown, contact + appointment count are hidden.
 */
export const DEFAULT_PUBLIC_VISIBILITY: PublicVisibility = {
  showSocials: true,
  showContact: false,
  showApptCount: false,
  showGallery: true,
};

export const VISIBILITY_KEYS = Object.keys(
  DEFAULT_PUBLIC_VISIBILITY,
) as (keyof PublicVisibility)[];

/** Resolves a raw Json column into full visibility flags with defaults. */
export function resolvePublicVisibility(raw: unknown): PublicVisibility {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return DEFAULT_PUBLIC_VISIBILITY;
  }
  const source = raw as Record<string, unknown>;
  return VISIBILITY_KEYS.reduce<PublicVisibility>(
    (acc, key) =>
      typeof source[key] === 'boolean' ? { ...acc, [key]: source[key] } : acc,
    DEFAULT_PUBLIC_VISIBILITY,
  );
}

/**
 * Merges a partial visibility update over the stored Json value (immutable:
 * returns a new object). Only known boolean keys are taken from the update.
 */
export function mergeVisibilitySettings(
  storedRaw: unknown,
  update: Partial<PublicVisibility>,
): Record<string, boolean> {
  const stored =
    storedRaw && typeof storedRaw === 'object' && !Array.isArray(storedRaw)
      ? (storedRaw as Record<string, unknown>)
      : {};
  const storedBooleans = Object.fromEntries(
    VISIBILITY_KEYS.flatMap((key) =>
      typeof stored[key] === 'boolean' ? [[key, stored[key]] as const] : [],
    ),
  );
  const updates = Object.fromEntries(
    VISIBILITY_KEYS.flatMap((key) =>
      typeof update[key] === 'boolean' ? [[key, update[key]] as const] : [],
    ),
  );
  return { ...storedBooleans, ...updates };
}
