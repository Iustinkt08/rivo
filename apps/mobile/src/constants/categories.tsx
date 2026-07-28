/**
 * Shared categories list used by HomeScreen (horizontal circle row)
 * and SearchOverlay (2-column grid). Centralised here to avoid drift.
 */
import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// ── Types ──────────────────────────────────────────────────────────────────────

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export type IconDef =
  | { lib: 'Ionicons'; name: IoniconsName }
  | { lib: 'MCI'; name: MCIName };

// ── Data ───────────────────────────────────────────────────────────────────────

export const CATEGORIES: Array<{ label: string; icon: IconDef; category: string }> = [
  { label: 'All treatments',     icon: { lib: 'Ionicons', name: 'apps-outline' },        category: '' },
  { label: 'Hair and styling',   icon: { lib: 'Ionicons', name: 'cut-outline' },         category: 'Hair' },
  { label: 'Nails',              icon: { lib: 'MCI',      name: 'nail' },                category: 'Nails' },
  { label: 'Brows & lashes',     icon: { lib: 'Ionicons', name: 'eye-outline' },         category: 'Brows' },
  { label: 'Hair removal',       icon: { lib: 'Ionicons', name: 'flash-outline' },       category: 'HairRemoval' },
  { label: 'Massage',            icon: { lib: 'MCI',      name: 'hand-heart-outline' },  category: 'Massage' },
  { label: 'Facials',            icon: { lib: 'MCI',      name: 'face-woman-outline' },  category: 'Facials' },
  { label: 'Spa & sauna',        icon: { lib: 'MCI',      name: 'hot-tub' },            category: 'Spa' },
  { label: 'Barbering',          icon: { lib: 'Ionicons', name: 'man-outline' },         category: 'Barbering' },
  { label: 'Body',               icon: { lib: 'Ionicons', name: 'body-outline' },        category: 'Body' },
  { label: 'Aesthetics',         icon: { lib: 'Ionicons', name: 'sparkles-outline' },    category: 'Aesthetics' },
  { label: 'Makeup',             icon: { lib: 'MCI',      name: 'palette-outline' },     category: 'Makeup' },
  { label: 'Tattoos & piercing', icon: { lib: 'MCI',      name: 'needle' },             category: 'Tattoos' },
  { label: 'Medical',            icon: { lib: 'Ionicons', name: 'medkit-outline' },      category: 'Medical' },
  { label: 'Dental',             icon: { lib: 'MCI',      name: 'tooth-outline' },       category: 'Dental' },
  { label: 'Chiropractic',       icon: { lib: 'MCI',      name: 'human-handsdown' },    category: 'Chiropractic' },
  { label: 'Physical therapy',   icon: { lib: 'Ionicons', name: 'fitness-outline' },     category: 'PhysicalTherapy' },
  { label: 'Fitness',            icon: { lib: 'MCI',      name: 'dumbbell' },           category: 'Fitness' },
  { label: 'Nutrition',          icon: { lib: 'MCI',      name: 'food-apple-outline' }, category: 'Nutrition' },
  { label: 'Mental Health',      icon: { lib: 'MCI',      name: 'brain' },              category: 'MentalHealth' },
  { label: 'Holistic health',    icon: { lib: 'Ionicons', name: 'leaf-outline' },        category: 'Holistic' },
  { label: 'Pets',               icon: { lib: 'Ionicons', name: 'paw-outline' },         category: 'Pets' },
];

// ── Renderer ──────────────────────────────────────────────────────────────────

export function renderIcon(icon: IconDef, size: number, color: string): React.ReactElement {
  if (icon.lib === 'Ionicons') {
    return <Ionicons name={icon.name} size={size} color={color} />;
  }
  return <MaterialCommunityIcons name={icon.name} size={size} color={color} />;
}

/** Generic icon used when a category name doesn't match any known entry. */
const FALLBACK_ICON: IconDef = { lib: 'Ionicons', name: 'pricetag-outline' };

/**
 * Resolve an IconDef for a backend category name so the Business app can reuse
 * the exact same icons as the Client app. Case-insensitive match against a
 * CATEGORIES entry's `label` OR `category`, falling back to a generic icon.
 */
export function getCategoryIcon(name: string): IconDef {
  const key = (name ?? '').trim().toLowerCase();
  if (!key) return FALLBACK_ICON;
  const match = CATEGORIES.find(
    (c) => c.label.toLowerCase() === key || c.category.toLowerCase() === key,
  );
  return match?.icon ?? FALLBACK_ICON;
}

/**
 * Resolve a human-readable label for a backend category code/name.
 * The DB stores short codes (e.g. 'HairRemoval', 'MentalHealth'); this maps them
 * to their display label ('Hair removal', 'Mental Health'). Case-insensitive
 * match against a CATEGORIES entry's `category` OR `label`, falling back to the
 * input string when nothing matches.
 */
export function getCategoryLabel(name: string): string {
  const key = (name ?? '').trim().toLowerCase();
  if (!key) return name ?? '';
  const match = CATEGORIES.find(
    (c) => c.category.toLowerCase() === key || c.label.toLowerCase() === key,
  );
  return match?.label ?? name;
}
