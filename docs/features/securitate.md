# Securitate (postura v0.3)

## Scop

Postura de securitate a platformei după auditul v0.3: apărare în straturi — guards globale dual-issuer pe API, RLS deny-all pe Postgres cu backend privilegiat, storage cu scriere doar prin backend, rate limiting per-rută și fix-uri verificate pentru constatările auditului.

## Arhitectură

- **Guards globale (`APP_GUARD`, în ordine):** `SupabaseAuthGuard` (dual-issuer: peek nesemnat pe `iss` doar pentru routing — `navira-staff` → HS256 cu `STAFF_JWT_SECRET`; altfel JWKS Supabase ES256, issuer `{SUPABASE_URL}/auth/v1`, audience `authenticated`) → `RolesGuard` → `ThrottlerGuard`. Orice rută cere Bearer token, exceptând `@Public()`.
- **ValidationPipe global:** `whitelist + forbidNonWhitelisted + transform` — input necunoscut e respins la graniță.
- **RLS deny-all + backend privilegiat:** RLS activat pe toate tabelele publice cu **zero politici** = default-deny; cheia anon nu dă acces la tabele prin PostgREST. Întreaga autorizare stă în stratul NestJS; Prisma se conectează privilegiat.
- **Storage:** bucket `staff-gallery` public-read, **fără politici de scriere client-side** — toate scrierile trec prin proxy-ul backend cu `SUPABASE_SERVICE_ROLE_KEY`, cu ownership verificat în `staff-gallery.service.ts` (self sau owner) înainte de orice operație. Politicile owner-scoped pe bucket-urile mai vechi (`avatars`, `salon-assets`) folosesc funcția `navira_uid()` restricționată la rolul `authenticated` (configurată în Supabase, nu în migrațiile repo-ului).
- **CORS:** `origin: FRONTEND_URL ?? '*'`; `credentials` doar când `FRONTEND_URL` e setat (mobile folosește Bearer, fără Origin). Swagger doar în dev.

## Rate limits

| Scope | Limită |
|---|---|
| Global (`ThrottlerModule`) | **100 req / 60s** |
| Auth (`/auth/verify`, `/auth/complete-profile`, `/auth/staff/login`, `/auth/staff/change-password`) | **5 / 60s** |
| `POST /appointments` (creare booking) | **5 / 60s** |
| `POST /salons/:id/slots/lock` | **15 / 60s** |
| `POST /salons/:id/discount-codes/validate` | **10 / 60s** |

## Auditul v0.3 — 9 constatări, 6 fixed

| # | Sev. | Constatare | Status |
|---|---|---|---|
| 1 | HIGH | Race pe capul de utilizări al codurilor de reducere (redemption concurent putea depăși `maxRedemptions`/`maxPerClient`) | **FIXED** — row lock prin UPDATE pe rândul codului în tranzacție + re-check strict |
| 2 | HIGH | Galeria staff expusă public nefiltrată | **FIXED** — `@Roles` + assert pe management; expunerea publică filtrată prin `publicSettings` server-side |
| 3 | MED | Logica `apptCount` negată (vizibilitatea numărului de programări inversată) | **FIXED** |
| 4 | MED | `serviceIds` cross-tenant la asignarea staff-ului pe servicii | **FIXED** — `assertStaffBelongToSalon` |
| 5 | MED | Motivul de time-off (`reason`) scurs către clienți în availability | **FIXED** |
| 6 | MED | Double-redeem pe punch card la booking-uri paralele | **FIXED post-audit** — `SELECT ... FOR UPDATE` pe rândul de config |
| 7 | LOW | `trust proxy` nesetat (rate limiting după IP greșit în spatele unui reverse proxy) | **REPORTED** — de configurat la deploy |
| 8 | LOW | CORS fallback `'*'` când `FRONTEND_URL` lipsește | **REPORTED** |
| 9 | LOW | Verificarea politicilor de bucket | **REPORTED-VERIFIED** — bucket-ul `staff-gallery` creat fără politici de scriere client-side |

## Alte mecanisme active

- Staff auth: bcrypt **12 rounds**, mesaj generic „Invalid credentials" (anti-enumerare), TTL 7 zile, issuer separat `navira-staff`; `passwordHash` nu părăsește niciodată API-ul (test dedicat).
- Slot lock Redis: release doar de owner (script Lua atomic); **TOCTOU rezolvat** prin overlap check în tranzacție DB la creare/reschedule (garda autoritară — lock-ul e doar advisory, fail-open).
- Redis legat doar pe `127.0.0.1`, `requirepass`, `noeviction`.
- Scoping multi-tenant: `assertSalonAccess` / `assertSalonOwner` / `assertStaffInSalon` / `assertCanManageGallery` pe fiecare rută de business; staff-ul vede doar programările și analytics-ul propriu.
- Roluri self-assignable limitate la CLIENT/ADMIN_SALON; STAFF_MEMBER/SUPER_ADMIN nu pot fi obținute prin complete-profile.
- Sumele de discount/loyalty calculate exclusiv server-side; audit trail în `DiscountRedemption`/`PunchRedemption` cu `appointmentId @unique`.
- `.env`-urile gitignored; boot fail-fast la lipsa `SUPABASE_URL`/`STAFF_JWT_SECRET`.

## Recomandări rămase

1. **Leaked Password Protection** — de activat din Supabase Dashboard (Auth → protecție parole compromise).
2. **`SUPABASE_SERVICE_ROLE_KEY`** — de confirmat prezent doar în env-ul backend-ului (niciodată în mobile / repo).
3. **Token versioning la schimbarea parolei de staff** — JWT-urile vechi rămân valide până la expirare (7 zile); de adăugat un `tokenVersion` per staff verificat în guard.
4. `trust proxy` + `FRONTEND_URL` explicit la deploy (constatările #7, #8).

## Fișiere cheie

- `apps/backend/src/main.ts` (ValidationPipe, CORS, Swagger), `src/app.module.ts` (Throttler)
- `apps/backend/src/modules/auth/guards/supabase-auth.guard.ts`, `guards/roles.guard.ts`, `staff-auth.service.ts`
- `apps/backend/src/modules/discounts/discounts.service.ts` (#1), `modules/staff/staff-gallery.service.ts` (#2), `modules/services/services.service.ts` (#4), `modules/loyalty/loyalty.service.ts` (#6)
- `apps/backend/src/modules/appointments/slot-lock.service.ts`, `appointments.service.ts` (TOCTOU)
- `apps/backend/src/modules/storage/storage.service.ts`, `src/rate-limiting.spec.ts`
