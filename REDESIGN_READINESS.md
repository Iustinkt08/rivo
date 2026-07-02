# Redesign Readiness (Figma → App) — NAVIRA

This document is the bridge for dropping a **full Figma redesign** into the mobile app with
all elements and flows. It captures the complete screen/flow inventory, the component surface
a Figma library must cover, the design-token plan, and the Figma→code ingestion workflow.

> Context: the app is an Expo / React Native (Expo Router) app. The theme already lives in a
> single module (`apps/mobile/src/theme/index.ts`, ~44 importers), which is what makes a
> 1:1 token remap feasible. Rebrand direction: NAVIRA, red-gradient minimalist.

---

## 1. Design tokens — single source of truth

Centralize every visual decision in `apps/mobile/src/theme/index.ts` so a Figma palette maps
1:1 and a rebrand changes **values, not call sites**. Target token groups:

| Token group | Examples | Figma equivalent |
|---|---|---|
| Color / brand | `brand.primary`, `brand.gradientFrom/To`, `surface`, `text`, `muted`, `danger`, `success` | Figma Variables (color) |
| Typography | `font.family`, `size.{xs..3xl}`, `weight`, `lineHeight` | Text styles |
| Spacing | `space.{1..10}` (4pt scale) | Spacing variables |
| Radius | `radius.{sm,md,lg,pill}` | Corner radius variables |
| Shadow / elevation | `shadow.{card,modal}` | Effect styles |
| Gradients | `gradient.brand` (NAVIRA red) | Gradient fills |

**Action:** extend the theme to expose all of the above as named tokens; refactor any
hardcoded hex/spacing in screens to reference them. Then a Figma variable export = a token diff.

## 2. Complete flow & screen inventory (what a redesign must cover)

**Auth / onboarding:** splash → welcome slides → role selection (CLIENT / ADMIN_SALON) →
salon-type → client-onboarding / salon-onboarding → login (email+password) → register → OTP.

**Client app (tabs: Home · Bookings · Favorites · Profile):**
Home (category browse, hero carousel, recommendations) · Search (text + 10km geo) ·
Salon detail (gallery, services, staff, hours, reviews, map, favorite) ·
Booking flow (service → staff → date/time + slot lock → confirmed) ·
Bookings list (status filters) · Appointment detail (cancel/rebook) · Write review ·
Notifications · Edit profile · Payment history (stub).

**Business app (tabs: Calendar · Clients · Services · Analytics · Settings):**
Calendar/day view + walk-in · Clients CRM (notes, block) · Services CRUD ·
Analytics (stub) · Settings · Salon profile edit (identity / location / media / staff).

> Full screen→file map: see `MOBILE_APP_WALKTHROUGH.md`. Every screen above already exists in
> `apps/mobile/src/app/**` and `src/screens/**`, so the redesign is a re-skin, not a rebuild.

## 3. Component inventory (Figma components ↔ code components)

Build/confirm these reusable primitives so each Figma component maps to exactly one code
component (enables Figma Code Connect):

- **Primitives:** Button (variants: primary/secondary/ghost/danger), Input/Field, Chip/Tag,
  Avatar, Badge, Rating stars, Icon, Divider, Card, Sheet/Modal, Toast/Empty-state, Skeleton.
- **Domain:** SalonCard, ServiceRow, StaffChip, CategoryPill, TimeSlotGrid, BookingSummary,
  AppointmentCard, ReviewItem, KpiTile (analytics), DayCalendar, BottomTabBar.

> Note: `Input.tsx` and `FloatingTabBar.tsx` were unused and moved to `gunoi/`. A redesign
> should introduce a single canonical `Input`/`TabBar` and wire it everywhere.

## 4. Figma → code ingestion workflow (Figma MCP is connected)

When you share the Figma file/URL, the workflow is:
1. `get_metadata` / `get_design_context` on the frame → structure + tokens.
2. `get_variable_defs` → import color/spacing/type variables straight into the theme module.
3. `get_screenshot` per frame → visual reference while implementing each screen.
4. Code Connect (`add_code_connect_map`) → map Figma components to the code components in §3.
5. Re-skin screen-by-screen against the inventory in §2, pulling only token values + layout.

**To proceed, provide:** the Figma file URL (and node-ids for key frames), plus confirmation of
the NAVIRA palette/gradient values (or let me read them from Figma variables).

## 5. Pre-redesign checklist
- [ ] Theme module exposes all token groups in §1 (extend as needed).
- [ ] Screens reference tokens, not literal hex/spacing values.
- [ ] Canonical component library in §3 exists and is used everywhere.
- [ ] Figma file shared with variables + components named to match §1/§3.
- [ ] Code Connect mappings established for the domain components.
