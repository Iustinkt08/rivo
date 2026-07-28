// Pure mappers for the public professionals API (GET /professionals/:id and
// GET /professionals?search=). Kept free of API-client imports so they are
// unit-testable in isolation (same convention as notificationMapping.ts).

export interface ProfessionalSalonRef {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
}

export interface ProfessionalService {
  id: string;
  name: string;
  price: number;
  durationMin: number;
}

export interface ProfessionalReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string; // ISO
  clientName: string;
}

// Socials keys mirror the backend whitelist; values are full https:// URLs
// (the backend normalizes bare handles server-side).
export const PROFESSIONAL_SOCIAL_KEYS = [
  'instagram',
  'facebook',
  'tiktok',
  'website',
] as const;
export type ProfessionalSocialKey = (typeof PROFESSIONAL_SOCIAL_KEYS)[number];
export type ProfessionalSocials = Partial<
  Record<ProfessionalSocialKey, string>
>;

export interface ProfessionalGalleryPhoto {
  id: string;
  url: string;
  caption: string | null;
}

export interface ProfessionalGalleryCategory {
  id: string;
  name: string;
  photos: ProfessionalGalleryPhoto[];
}

/**
 * Public professional profile. Visibility-gated fields (phone, email, socials,
 * completedAppointmentsCount, galleryCategories) are filtered SERVER-SIDE by
 * the professional's publicSettings — when hidden they simply never arrive,
 * so absent means "not public".
 */
export interface ProfessionalProfile {
  id: string;
  fullName: string;
  specialty: string;
  avatarEmoji: string | null;
  avatarUrl: string | null;
  bio: string | null;
  phone: string | null;
  email: string | null;
  socials: ProfessionalSocials | null;
  completedAppointmentsCount: number | null;
  galleryCategories: ProfessionalGalleryCategory[];
  salon: ProfessionalSalonRef | null;
  services: ProfessionalService[];
  averageRating: number;
  reviewCount: number;
  reviews: ProfessionalReview[];
}

export interface ProfessionalSearchResult {
  id: string;
  fullName: string;
  specialty: string;
  avatarEmoji: string | null;
  avatarUrl: string | null;
  salon: ProfessionalSalonRef | null;
  /** null when the professional hides their count (publicSettings gate). */
  appointmentCount: number | null;
  averageRating: number;
  reviewCount: number;
}

function mapSalonRef(raw: any): ProfessionalSalonRef | null {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  return {
    id: String(raw.id),
    name: raw.name ?? '',
    slug: raw.slug ?? null,
    city: raw.city ?? null,
  };
}

function fullNameOf(raw: any): string {
  return (
    raw?.fullName ??
    `${raw?.firstName ?? ''} ${raw?.lastName ?? ''}`.trim()
  );
}

/** Keeps only known social keys with non-empty string values; null if none. */
function mapSocials(raw: any): ProfessionalSocials | null {
  if (!raw || typeof raw !== 'object') return null;
  const entries = PROFESSIONAL_SOCIAL_KEYS.flatMap((key) => {
    const value = raw[key];
    return typeof value === 'string' && value ? [[key, value] as const] : [];
  });
  return entries.length ? Object.fromEntries(entries) : null;
}

function mapGalleryCategories(raw: any): ProfessionalGalleryCategory[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c && c.id)
    .map((c) => ({
      id: String(c.id),
      name: c.name ?? '',
      photos: (Array.isArray(c.photos) ? c.photos : [])
        .filter((p: any) => p && p.id && typeof p.url === 'string' && p.url)
        .map((p: any) => ({
          id: String(p.id),
          url: p.url as string,
          caption: p.caption ?? null,
        })),
    }));
}

export function mapProfessionalProfile(raw: any): ProfessionalProfile {
  const services: any[] = Array.isArray(raw?.services) ? raw.services : [];
  const reviews: any[] = Array.isArray(raw?.reviews) ? raw.reviews : [];
  return {
    id: String(raw?.id ?? ''),
    fullName: fullNameOf(raw),
    specialty: raw?.specialty ?? '',
    avatarEmoji: raw?.avatarEmoji ?? null,
    avatarUrl: raw?.avatarUrl ?? null,
    bio: raw?.bio ?? null,
    phone: raw?.phone ?? null,
    email: raw?.email ?? null,
    socials: mapSocials(raw?.socials),
    completedAppointmentsCount:
      typeof raw?.completedAppointmentsCount === 'number'
        ? raw.completedAppointmentsCount
        : null,
    galleryCategories: mapGalleryCategories(raw?.galleryCategories),
    salon: mapSalonRef(raw?.salon),
    services: services.map((s) => ({
      id: String(s.id),
      name: s.name ?? '',
      price: Number(s.price ?? 0),
      durationMin: Number(s.durationMin ?? 0),
    })),
    averageRating: Number(raw?.averageRating ?? 0),
    reviewCount: Number(raw?.reviewCount ?? 0),
    reviews: reviews.map((r) => ({
      id: String(r.id),
      rating: Number(r.rating ?? 0),
      comment: r.comment ?? null,
      createdAt: r.createdAt ?? '',
      clientName: r.clientName ?? 'Client',
    })),
  };
}

// ─── Editable staff profile (business app, staff-self or owner) ───────────────

/** Public visibility toggles, mirrored from the backend publicSettings Json. */
export interface StaffVisibilitySettings {
  showSocials: boolean;
  showContact: boolean;
  showApptCount: boolean;
  showGallery: boolean;
}

/** Backend defaults: socials + gallery public, contact + count private. */
export const DEFAULT_STAFF_VISIBILITY: StaffVisibilitySettings = {
  showSocials: true,
  showContact: false,
  showApptCount: false,
  showGallery: true,
};

/** Form-friendly shape: every text field is a string ('' when unset). */
export interface EditableStaffProfile {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  bio: string;
  phone: string;
  email: string;
  avatarEmoji: string;
  avatarUrl: string | null;
  socials: Record<ProfessionalSocialKey, string>;
  publicSettings: StaffVisibilitySettings;
}

function mapVisibilitySettings(raw: any): StaffVisibilitySettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_STAFF_VISIBILITY;
  return (
    Object.keys(DEFAULT_STAFF_VISIBILITY) as (keyof StaffVisibilitySettings)[]
  ).reduce<StaffVisibilitySettings>(
    (acc, key) =>
      typeof raw[key] === 'boolean' ? { ...acc, [key]: raw[key] } : acc,
    DEFAULT_STAFF_VISIBILITY,
  );
}

/** Maps GET/PATCH salons/:salonId/staff/:staffId/profile into form state. */
export function mapEditableStaffProfile(raw: any): EditableStaffProfile {
  const socialsRaw =
    raw?.socials && typeof raw.socials === 'object' ? raw.socials : {};
  const socials = PROFESSIONAL_SOCIAL_KEYS.reduce(
    (acc, key) => ({
      ...acc,
      [key]: typeof socialsRaw[key] === 'string' ? socialsRaw[key] : '',
    }),
    {} as Record<ProfessionalSocialKey, string>,
  );
  return {
    id: String(raw?.id ?? ''),
    firstName: raw?.firstName ?? '',
    lastName: raw?.lastName ?? '',
    specialty: raw?.specialty ?? '',
    bio: raw?.bio ?? '',
    phone: raw?.phone ?? '',
    email: raw?.email ?? '',
    avatarEmoji: raw?.avatarEmoji ?? '👤',
    avatarUrl: raw?.avatarUrl ?? null,
    socials,
    publicSettings: mapVisibilitySettings(raw?.publicSettings),
  };
}

export function mapProfessionalSearchResults(
  raw: unknown,
): ProfessionalSearchResult[] {
  const list: any[] = Array.isArray(raw) ? raw : ((raw as any)?.data ?? []);
  if (!Array.isArray(list)) return [];
  return list
    .filter((p) => p && p.id)
    .map((p) => ({
      id: String(p.id),
      fullName: fullNameOf(p),
      specialty: p.specialty ?? '',
      avatarEmoji: p.avatarEmoji ?? null,
      avatarUrl: p.avatarUrl ?? null,
      salon: mapSalonRef(p.salon),
      appointmentCount:
        p.appointmentCount == null ? null : Number(p.appointmentCount),
      averageRating: Number(p.averageRating ?? 0),
      reviewCount: Number(p.reviewCount ?? 0),
    }));
}
