# Autentificare

## Scop

Autentificare dual-issuer: clienții și ownerii se loghează cu email/parolă prin **Supabase Auth** (JWT ES256 verificat prin JWKS), iar staff-ul de salon are conturi separate emise de backend (**JWT HS256 propriu**, issuer `navira-staff`), toate validate de aceleași guards globale.

## Arhitectură

**Modele Prisma:** `User` (firebaseUid = UID Supabase, role: CLIENT / ADMIN_SALON / STAFF_MEMBER / SUPER_ADMIN), `Staff` (username unique + passwordHash bcrypt — niciodată expus în API).

**Endpoint-uri (prefix `/api/v1`):**
| Endpoint | Auth | Rate limit |
|---|---|---|
| `POST /auth/verify` | Bearer (orice user) | 5/min |
| `POST /auth/complete-profile` | Bearer | 5/min |
| `GET / PATCH / DELETE /auth/me` | Bearer | global |
| `POST /auth/staff/login` | `@Public()` | 5/min |
| `POST /auth/staff/change-password` | Bearer (staff) | 5/min |

**Ecrane mobile:** grupul `(auth)` — `index` (Splash) → `welcome` → `role-selection` → `client-onboarding` / `salon-onboarding` (SignUpWizard) → `login`, `register`, `otp`. Change-password: `app/(business)/staff-change-password.tsx` (staff) și `app/(client)/change-password.tsx` (Supabase).

**Componente cheie:** `SupabaseAuthGuard` + `RolesGuard` (globale, `APP_GUARD`), decoratorii `@Public()` / `@Roles()` / `@CurrentUser()`, `authStore` (Zustand) pe mobile.

## Flow

### Client / Owner (Supabase)
1. SignUpWizard → `supabase.auth.signUp` (confirmarea pe email trebuie OFF în Supabase).
2. La fiecare request, `SupabaseAuthGuard` verifică JWT-ul prin **JWKS** (`{SUPABASE_URL}/auth/v1/.well-known/jwks.json`, issuer `{SUPABASE_URL}/auth/v1`, audience `authenticated`, ES256) și face **upsert** (`getOrCreateUser`): caută după `firebaseUid` → re-link după email (cont Supabase recreat) → creează stub CLIENT; race pe `P2002` rezolvat prin re-fetch.
3. `POST /auth/verify` → `{ user, isNewUser, hasSalon }`; mobile decide fluxul (onboarding salon pentru ADMIN_SALON fără salon).
4. `POST /auth/complete-profile` — nume, email, telefon, avatar + rolul ales.

### Staff (backend-issued)
1. `LoginScreen` detectează identificatorul (`utils/loginIdentifier.ts`): conține `@` → email Supabase; fără `@` și ≥3 caractere → username staff (normalizat `trim().toLowerCase()`).
2. `POST /auth/staff/login` → verifică `isActive`, `passwordHash` (bcrypt compare), `userId` legat; emite JWT **HS256** semnat cu `STAFF_JWT_SECRET`: claims `{ role: 'STAFF_MEMBER', staffId, salonId, sub: staff.userId }`, issuer `navira-staff`, **TTL 7 zile**.
3. Mobile (`authStore.signInStaff`): face `supabase.auth.signOut()` pe orice sesiune reziduală (siguranță pe tablete partajate), salvează sesiunea în AsyncStorage (`navira-staff-session`), activează modul business restrâns.
4. `restoreSession()`: sesiunea de staff are **prioritate** — validată printr-un ping la `GET /notifications/me`; 401/403 → purge, eroare tranzientă → păstrată. Altfel restore Supabase + `POST /auth/verify`.
5. Schimbare parolă staff: `POST /auth/staff/change-password` — cere `currentPassword` corectă (bcrypt compare), `newPassword` 8–72 caractere, re-hash bcrypt 12.

### Guard chain (fiecare request)
`SupabaseAuthGuard` → peek **nesemnat** pe `iss` (doar routing); `navira-staff` → verificare HS256 + `getActiveUserById`; altfel → JWKS Supabase. Apoi `RolesGuard`: fără `@Roles()` → orice user autentificat; mismatch → 403.

## Reguli de business

- **Roluri self-assignable:** doar `CLIENT` și `ADMIN_SALON` (`SELF_ASSIGNABLE_ROLES` în `register.dto.ts`); `STAFF_MEMBER` / `SUPER_ADMIN` nu pot fi nici cerute, nici suprascrise (`resolveSelfAssignedRole`).
- Email/telefon unice — `409 Conflict` cu mesaj explicit la complete-profile / PATCH me.
- `DELETE /auth/me` = **soft delete** (`isActive: false`).
- Username staff: 3–30 caractere, regex `^[a-zA-Z0-9._-]+$`; parolă 8–72 (limita bcrypt).
- Login staff eșuat → mesaj generic „Invalid credentials" pe orice ramură (anti-enumerare).
- `sanitize()` scoate câmpurile interne (firebaseUid) din orice răspuns.

## Securitate

- Guards **globale** — orice rută cere Bearer token, exceptând `@Public()`. Nu re-aplica guards pe controllere (a doua rulare suprascrie `request.user` și pierde `isNewUser`).
- Boot fail-fast: lipsa `SUPABASE_URL` sau `STAFF_JWT_SECRET` oprește pornirea.
- bcrypt **12 rounds**; `passwordHash` nu părăsește niciodată API-ul (test dedicat).
- Rate limit 5/min pe toate rutele de auth.
- Limitare cunoscută (REPORTED): nu există token versioning — JWT-urile de staff rămân valide până la expirare după schimbarea parolei.

## Fișiere cheie

- `apps/backend/src/modules/auth/guards/supabase-auth.guard.ts`, `guards/roles.guard.ts`
- `apps/backend/src/modules/auth/auth.controller.ts`, `auth.service.ts`, `staff-auth.service.ts`
- `apps/backend/src/modules/auth/decorators/` (`public`, `roles`, `current-user`)
- `apps/backend/src/modules/auth/dto/register.dto.ts`, `dto/staff-login.dto.ts`
- `apps/mobile/src/store/authStore.ts`, `apps/mobile/src/utils/loginIdentifier.ts`, `utils/staffSession.ts`
- `apps/mobile/src/screens/auth/LoginScreen.tsx`, `apps/mobile/src/screens/business/StaffChangePasswordScreen.tsx`
