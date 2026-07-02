/**
 * Canonical service-category taxonomy (single source of truth for seeds).
 *
 * `name` MUST equal the code the client search sends as `?category=...`
 * — see apps/mobile/src/constants/categories.tsx → CATEGORIES[].category.
 * The backend (salons.service.ts) matches this value case-insensitively
 * against Category.name, so any drift breaks client search.
 *
 * `sortOrder` mirrors the entry's index in that CATEGORIES array
 * (index 0 = the empty-string "All treatments" entry, which is NOT a real
 * category and is intentionally excluded here).
 */
export interface CanonicalCategory {
  name: string;
  sortOrder: number;
}

export const CANONICAL_CATEGORIES: CanonicalCategory[] = [
  { name: 'Hair', sortOrder: 1 },
  { name: 'Nails', sortOrder: 2 },
  { name: 'Brows', sortOrder: 3 },
  { name: 'HairRemoval', sortOrder: 4 },
  { name: 'Massage', sortOrder: 5 },
  { name: 'Facials', sortOrder: 6 },
  { name: 'Spa', sortOrder: 7 },
  { name: 'Barbering', sortOrder: 8 },
  { name: 'Body', sortOrder: 9 },
  { name: 'Aesthetics', sortOrder: 10 },
  { name: 'Makeup', sortOrder: 11 },
  { name: 'Tattoos', sortOrder: 12 },
  { name: 'Medical', sortOrder: 13 },
  { name: 'Dental', sortOrder: 14 },
  { name: 'Chiropractic', sortOrder: 15 },
  { name: 'PhysicalTherapy', sortOrder: 16 },
  { name: 'Fitness', sortOrder: 17 },
  { name: 'Nutrition', sortOrder: 18 },
  { name: 'MentalHealth', sortOrder: 19 },
  { name: 'Holistic', sortOrder: 20 },
  { name: 'Pets', sortOrder: 21 },
];

/**
 * Legacy (pre-canonical) category names created by the original seed →
 * their canonical replacement. Used to reconcile the live DB without
 * orphaning Services or SalonCategory links. 'Hair' and 'Nails' were
 * already canonical and are intentionally absent.
 */
export const LEGACY_CATEGORY_RENAMES: Record<string, string> = {
  Masaj: 'Massage',
  Facial: 'Facials',
  Barbershop: 'Barbering',
};
