# NAVIRA — Feature-Integrity & Security Audit

**Date:** 2026-07-02
**Scope:** Two-sided salon marketplace — Expo/React Native client + business app (one codebase, role-based) and a **NestJS + Prisma** backend on Supabase Postgres.
**Method:** White-box code + schema review, Supabase advisors, targeted fixes with `tsc` + Jest verification.

---

## Executive Summary

| Posture | Before today | After |
|---|---|---|
| **Feature integrity** | Booking flow crashed; client bookings never reached the backend; no notifications; no calendar reschedule; no staff profiles/search; no staff accounts | Booking wired end-to-end; in-app notifications both sides; drag + manual reschedule; public professional profiles + search; salon reviews with staff attribution; salon-scoped staff accounts |
| **Security** | Self-serve `SUPER_ADMIN` escalation; public leak of staff login usernames; no rate limiting; unbounded inputs; no cross-tenant checks on several endpoints; unvalidated review rating | All fixed; RLS confirmed default-deny; dual-issuer auth verified sound; rate limiting; input caps; per-tenant + per-staff scoping |

**Headline architecture finding:** the audit brief assumes a **Supabase-direct** app (RLS is the only guard, anon key = table access, Edge Functions, triggers, Realtime). **NAVIRA is not that.** The mobile app talks to a **NestJS REST API**; Supabase is used only for **Auth (JWT)**. Confirmed via `get_advisors`: **RLS is enabled on all 21 public tables with zero policies = default-deny** — the anon key grants **no** table access through PostgREST. Therefore the entire "RLS coverage / anon-key exposure / PostgREST surface / SECURITY DEFINER / Realtime RLS" section of the brief is **already satisfied by construction**; the real attack surface is the **NestJS authorization layer**, which is where all of today's security work landed.

---

## Architecture Map

- **One Expo codebase, role-based** via Expo Router groups: `(auth)`, `(client)`, `(business)`, `(onboarding)`. Staff accounts reuse `(business)` in a restricted "staff mode".
- **Backend:** NestJS modules — `auth`, `appointments`, `staff`, `salons`, `services`, `reviews`, `notifications`, `client-profiles`, `payments`, `addresses`. Prisma → Supabase Postgres. Global `SupabaseAuthGuard` + `RolesGuard` + `ValidationPipe(whitelist, forbidNonWhitelisted)` + `ThrottlerGuard`.
- **Auth:** dual-issuer. Clients/owners → Supabase JWT (JWKS/ES256). Staff → backend-issued HS256 JWT (`iss: navira-staff`), bcrypt passwords. Both verified by the same guard; routing keys off the unverified `iss` peek, real verification after.
- **Cross-side plumbing:** the `notifications` table, written by the NestJS `NotificationsService` and **polled** by both apps (`GET /notifications/me`) with unread badges. **Not** Supabase Realtime/triggers.
- **Data model (21 tables):** users, salons, staff, services, appointments, reviews, notifications, payments, slot_locks, client_salon_profiles, opening_hours, staff_schedules, time_off_blocks, user_addresses, categories, salon/staff junctions, push_tokens. PII in users/staff; money in payments/appointments.priceSnapshot; ownership via `adminId`/`salonId`/`clientId`/`staffId`.

---

## PART A — Cross-App Interaction Matrix

Legend: ✅ fully wired · ⚠️ partial · ❌ ghost (UI, no effect) · 🚫 missing

### Client → Salon
| Action | Chain | Status |
|---|---|---|
| Create booking | DB insert → salon calendar fetch → `NEW_BOOKING` notification to owner | ✅ |
| Cancel booking | status→CANCELLED → excluded from overlap (slot freed) → `CANCELLATION` to owner | ✅ |
| Reschedule (client) | — clients cannot reschedule; they cancel + rebook (platform default) | 🚫 by design |
| Leave review | verified booking (own + COMPLETED, no dup) → published in salon reviews → **rating recomputed** → **owner notified** | ✅ *(notify + rating-bounds fixed this pass)* |
| Booking note | `clientNotes` stored → shown on salon calendar detail | ✅ |
| Profile update | salon reads client live via appointment join | ✅ |

### Salon → Client
| Action | Chain | Status |
|---|---|---|
| Drag/move appointment | reschedule endpoint → `startAt/endAt/staffId` update → **client notified** → client upcoming reflects new time | ✅ |
| Confirm pending | status→CONFIRMED → client notified | ✅ |
| Cancel / no-show | status update → client notified; gated so NO_SHOW/COMPLETED only after start time | ✅ |
| Mark completed | → client app prompts "leave a review" on next open | ✅ |
| Reply to a review | `replyText` column + client UI renders it, **but no endpoint to write a reply** | 🚫 missing (write side) |
| Change hours / block slot / close day | new bookings respect schedule + time-off; **existing bookings in a newly-blocked window are not auto-handled or the customer notified** | ⚠️ partial |
| Change service price/duration | future bookings use current price; **existing bookings keep `priceSnapshot`** (integrity preserved) | ✅ |
| Change staff availability | client booking screen reflects schedule/time-off | ✅ |
| Update salon profile/photos | client reads salon live | ✅ |

### State-consistency invariants
- **Single source of truth:** both sides read the `appointments` table via API. ✅
- **No double-booking:** overlap check on create/lock/reschedule. ⚠️ **TOCTOU** — check-then-write without a transaction/advisory lock; narrow race on the exact same slot (pre-existing, mirrors `create()`). Low severity.
- **Rating integrity:** recomputed from `isVisible` reviews; review requires an own, COMPLETED, not-yet-reviewed appointment; **rating now bounded 1–5 int** (was unvalidated). ✅
- **Notification correctness:** per-action inserts; `markRead` ownership-checked; idempotent per action. ✅
- **Timezone:** salon-local day windows (Europe/Bucharest, DST-aware) on the server; local day-keys on the client. ✅ *(fixed today)*
- **Optimistic UI:** drag-reschedule reverts on failure with the server message. ✅

---

## PART A — Fixes applied this pass
1. **Review rating validation** (`reviews.service.ts`): `CreateReviewDto` had **no validators** — `rating` accepted any number, corrupting the salon's cached average. Added `@IsUUID/@IsInt/@Min(1)/@Max(5)`, `@MaxLength(1000)` on comment.
2. **Salon notified on new review** (`reviews.service.ts` + `reviews.module.ts`): the "review → salon notified" cell was a ⚠️ (rating recomputed + published, but no notification). Wired a non-fatal `REVIEW` notification to the salon owner.

(The rest of Part A was wired earlier today across the booking/notification/reschedule/profiles work — see the FEATURES changelist.)

---

## PART B — Security

### Fixed earlier today (from the two review agents)
| Severity | Finding | Fix |
|---|---|---|
| **CRITICAL** | Any authenticated user could self-assign `SUPER_ADMIN`/`STAFF_MEMBER` via `complete-profile` → full cross-salon control | DTO limited to CLIENT/ADMIN_SALON + service keeps elevated/existing roles (defense in depth) |
| **CRITICAL** | Public `GET /salons/:id/staff` leaked staff **login usernames** (+ phone, userId) → login identifiers for password-guessing | Public endpoints strip `username/phone/userId/passwordHash`; owner-only `GET /staff/manage` returns usernames |
| **HIGH** | Cross-tenant IDOR on analytics / salon-appointments (any owner could read another salon by URL id) | `assertSalonAccess`/ownership checks on all salon-scoped reads |
| **HIGH** | `GET /appointments/:id` had no authorization (any user could read PII + payment data) | Restricted to booking client, salon admin, or assigned staff |
| **HIGH** | Cross-tenant `staffId` on lock/create (staff from another salon) | `assertStaffInSalon` on lock/create/reschedule |
| **HIGH** | No rate limiting anywhere | `@nestjs/throttler`: global 100/min; booking 5/min; lock 15/min; auth 5/min |
| **MEDIUM** | Terminated staff kept a working 7-day token | `remove()` deactivates the linked `User` (guard checks `isActive`) |
| **MEDIUM** | Input fields unbounded (notes, guest, sessionId) | `@MaxLength` caps |
| **LOW** | Client could set `internalNotes`; `cancelledBy` client-settable; bcrypt cost 10 | Client `internalNotes` blocked; `cancelledBy` removed from DTO; bcrypt cost 12 |

### Fixed this pass
| Severity | Finding | Fix |
|---|---|---|
| **MEDIUM** | Review `rating` unvalidated → rating-abuse / aggregate corruption | Bounded 1–5 integer in DTO |

### Verified sound (explicitly checked)
- **Dual-issuer JWT** — no algorithm-confusion / issuer-spoofing (jose rejects HS alg against the JWKS public key; staff tokens never route to the JWKS path; forged staff tokens fail HS256 without the secret).
- **Staff role scoping** — `STAFF_MEMBER` reaches only `findForSalon`/`getAnalytics`, both server-scoped to the caller's own staff row; no other controller grants the role.
- **Slot-lock release** — atomic Lua compare-and-delete; cannot steal another session's lock.
- **Notification ownership** — `markRead` checks `userId`.
- **RLS** — enabled + default-deny on every table; anon key gives no table access.
- **No secrets in client bundle** — `.env` removed from tracking; only the Supabase **publishable** (anon) key ships, which is safe by design.

### Real Supabase findings — documented, NOT applied (need branch verification)
1. **WARN — public buckets `avatars`, `salon-assets` allow listing.** A broad `SELECT` on `storage.objects` lets clients enumerate every filename. Public **object** reads via direct URL do **not** need this policy, so it can be tightened without breaking image display — but this must be verified on a Supabase **dev branch** (confirm images still load) before touching prod. Remediation: drop the broad listing `SELECT` policy on each bucket.
2. **WARN — leaked-password protection disabled** (Supabase Auth). One-click dashboard toggle (Auth → Password security → enable HaveIBeenPwned). Affects Supabase-authenticated users (clients/owners); staff use backend bcrypt.

---

## Assumptions & Decisions Log
- **Client-initiated reschedule** is intentionally not offered; clients cancel + rebook (Fresha-style default). Reschedule is a salon/staff action.
- **Moving an appointment auto-notifies** the client (no re-confirmation required) — platform default.
- **Staff mode** hides the salon-wide client database, service/staff management, salon profile, and total revenue; staff see only their own calendar + analytics. This is the privacy intent behind the feature.
- **No pricing/payout/commission logic was changed.** `priceSnapshot` integrity (existing bookings keep their agreed price) was verified, not modified.

## Not Fixed / Needs a Decision
- 🚫 **Reply-to-review** — net-new: backend endpoint (owner writes `replyText`) + business UI. The schema and client display already exist. Recommend implementing next.
- ⚠️ **Existing bookings when a salon blocks a slot / closes a day** — currently not auto-cancelled or the customer notified. Needs a product decision (auto-cancel + notify vs. flag for manual handling) before implementing.
- ⚠️ **TOCTOU** on create/reschedule overlap — wrap the overlap-check + write in a transaction or advisory lock if concurrent same-slot writes become a concern.
- **2 Supabase config findings** above — apply on a dev branch first.

---

## FEATURES CHANGED
- Client booking wired end-to-end to the backend (real availability / slot-lock / create); fixed the confirm-screen native crash (invalid-date notification).
- Redesigned booking + confirmation screens (NAVIRA theme); removed the mock date-time screen.
- In-app notifications for both apps (new-booking, confirm, cancel, no-show, reschedule, **review**) with unread badges.
- Business calendar: long-press drag-to-reschedule (15-min snap) + manual "change date/time"; status actions gated by appointment start time.
- Public professional profiles (`GET /professionals/:id`) + professional search + salon reviews with **staff attribution**; search shows Salons + Specialists sections; professional cards tappable from home.
- Salon-scoped staff accounts: owner-managed username/password, staff login, staff-only calendar/analytics/settings.
- Staff added from the business app now get a default weekly schedule + all active services auto-linked (so they're immediately bookable).
- Fixed the floating tab bar navigating to the wrong screen when a tab is hidden (staff mode); local-timezone day keys throughout the calendar.
- Review → salon-owner notification wired (this pass).

## SECURITY CHANGED
- Blocked `SUPER_ADMIN`/`STAFF_MEMBER` self-assignment via `complete-profile` (DTO + service).
- Public staff endpoints strip `username`/`phone`/`userId`; owner-only `/staff/manage` for usernames.
- Ownership checks on `getAnalytics`, `findForSalon`, `findOne(appointment)`; `assertStaffInSalon` on lock/create/reschedule.
- Rate limiting (`@nestjs/throttler`) global + per-endpoint.
- `@MaxLength` caps on notes/guest/sessionId/comment; review `rating` bounded 1–5 (this pass).
- Client cannot set `internalNotes`; removed client-settable `cancelledBy`; bcrypt cost 10 → 12.
- Terminating staff deactivates their login; Redis slot locks fail open (no lockout, DB overlap remains the real guard).
- Staff-mode UI hides salon-wide data; staff/Supabase sessions cleared correctly on login/logout (shared-device safety).

---

## Overall Assessment
**Feature integrity:** strong — the core two-sided chains (book, confirm, cancel, reschedule, review, notify) are wired end-to-end and verified. Two genuine gaps remain (reply-to-review write side; existing-bookings-on-slot-block), both needing a product call.

**Security:** strong for the actual architecture. The data layer is closed (RLS default-deny), and the NestJS authorization layer — where the real surface is — has been hardened across auth, tenancy, role scoping, rate limiting, and input validation, with the two critical escalation/leak bugs closed. Residual items are low-severity or config-level.

**Highest-value next step:** implement **reply-to-review** end-to-end (small, closes the last obvious ghost feature), then apply the two Supabase config fixes on a dev branch and enable leaked-password protection.
