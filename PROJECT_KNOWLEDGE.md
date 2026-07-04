# NAVIRA — Project Knowledge (pentru Claude Projects)

> Document de context complet pentru platforma NAVIRA. Scop: orice prompt legat de proiect să poată fi înțeles fără acces la fișiere. Actualizat: 2026-07-04 (v0.3 — marketing, loyalty, profil staff public, preferințe notificări). Documentație detaliată per feature: `docs/features/`.

---

## 1. Ce este NAVIRA

**NAVIRA** (fost "Rivo" — rebrand încheiat în cod) este un **marketplace de beauty & wellness pentru piața din România**: clienții descoperă saloane și profesioniști, văd disponibilitatea reală și își fac programări online; saloanele își administrează calendarul, serviciile, echipa, clienții și recenziile dintr-o aplicație de business. **Tot UI-ul este în limba română** (hardcodat, fără i18n încă).

O singură aplicație mobilă servește **trei experiențe** în funcție de rol:
- **Client** (CLIENT) — descoperire, booking, favorite, recenzii
- **Business owner** (ADMIN_SALON) — calendar, servicii, staff, clienți, analytics, setări salon
- **Staff** (STAFF_MEMBER) — variantă restrânsă a aplicației de business (fără tab-ul Clienți), login separat cu username/parolă

Există și rolul SUPER_ADMIN (rezervat, fără UI dedicat).

---

## 2. Structura repo (monorepo npm workspaces)

```
rivo/                          # repo root (git: Iustinkt08/rivo)
├── apps/
│   ├── mobile/                # ⚠️ SUBMODUL GIT SEPARAT (Iustinkt08/mobile, privat)
│   │   └── Expo / React Native — aplicația (client + business + staff)
│   └── backend/               # NestJS 11 — API REST
├── packages/                  # gol / rezervat
├── docker-compose.yml         # Redis local (slot locking)
├── docs/features/             # documentație per feature (framework Scop→Arhitectură→Flow→...)
└── package.json               # scripts: npm run backend / npm run mobile / db:*
```

**Important:** `apps/mobile` este un submodul git cu propriul remote — comenzile git din root NU acoperă mobile-ul.

Comenzi de dezvoltare (din root):
- `npm run backend` → `nest start --watch` pe portul **3000**
- `npm run mobile` → `expo start` (apoi `i` pentru iOS simulator)
- `npm run db:generate` / `db:migrate` / `db:studio` → Prisma
- `open -a Docker && docker compose up -d` → Redis local

---

## 3. Stack tehnologic

### Backend (`apps/backend`)
| Componentă | Tehnologie |
|---|---|
| Framework | **NestJS 11** (TypeScript), prefix global `/api/v1` |
| ORM / DB | **Prisma 7** + `@prisma/adapter-pg` → **PostgreSQL găzduit pe Supabase** |
| Auth | **Supabase Auth** (JWT ES256 verificat prin JWKS cu `jose`) + JWT propriu HS256 pentru staff |
| Cache/locks | **Redis** (ioredis) — doar pentru slot locking, rulează local în Docker |
| Validare | `class-validator` + `class-transformer`, ValidationPipe global (whitelist + forbidNonWhitelisted + transform) |
| Rate limiting | `@nestjs/throttler` — global 100 req/60s; auth 5/60s; creare booking 5/60s; slot lock 15/60s; validare discount 10/60s |
| Docs | Swagger la `/api/docs` (doar în dev) |
| Teste | Jest + ts-jest — **221 teste / 16 suite** (appointments, auth, staff-auth, discounts, loyalty, staff-gallery, reviews, notifications, slot-lock, rate-limiting) |

### Mobile (`apps/mobile`)
| Componentă | Tehnologie |
|---|---|
| Framework | **Expo SDK 54** / **React Native 0.81** / React 19, TypeScript, `newArchEnabled: true` |
| Routing | **expo-router 6** (file-based, route groups) |
| State | **Zustand 5** (5 store-uri; favorites persistat în AsyncStorage) |
| HTTP | **axios** — în dev base URL-ul urmează automat host-ul Metro (`http://<host-metro>:3000/api/v1`); în producție `EXPO_PUBLIC_API_URL` |
| Auth client | `@supabase/supabase-js` (sesiune persistată în AsyncStorage, auto-refresh) |
| Hărți | `react-native-maps` + `expo-location` |
| UI/efecte | `expo-blur` (glassmorphism), `expo-linear-gradient`, `react-native-reanimated` 4, `@gorhom/bottom-sheet`, `react-native-svg` (+ svg-transformer) |
| Notificări | `expo-notifications` (handler foreground, canal Android `navira-client`) |
| Config | `app.json` + `app.config.js` dinamic (injectează cheia Google Maps din env) |

### Infrastructură
- **Supabase**: Postgres + Auth (email/password activ, chei asimetrice ES256, JWKS live) + Storage (bucket-uri `avatars`, `salon-assets`, `staff-gallery` — ultimul public-read, scriere DOAR prin proxy-ul backend cu service role)
- **Redis 8 (alpine)** în Docker: legat DOAR pe `127.0.0.1:6379`, protejat cu `requirepass`, politică `noeviction`, healthcheck; containerul se numește `navira-redis`
- Env vars backend (nume, fără valori): `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STAFF_JWT_SECRET`, `REDIS_HOST/PORT/PASSWORD`, `FRONTEND_URL`, `PORT`, `NODE_ENV`
- Env vars mobile: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`, `GOOGLE_MAPS_ANDROID_API_KEY`

---

## 4. Arhitectura backend

### 4.1 Module NestJS (`src/modules/`)
| Modul | Rol |
|---|---|
| `auth` | Auth dual-issuer (Supabase + staff JWT), upsert user, guards/decoratori globali |
| `salons` | CRUD salon, căutare publică + geo (Haversine), program, galerie foto; include și CategoriesController |
| `services` | CRUD servicii per salon (rută imbricată `salons/:salonId/services`) |
| `staff` | CRUD staff, programe săptămânale, time-off, credențiale de login, **profil public + galerie foto pe categorii**; include ProfessionalsController (descoperire publică) |
| `appointments` | Disponibilitate, slot lock (Redis), booking (cu discount/loyalty în tranzacție), reschedule, tranziții de status, analytics; furnizează `REDIS_CLIENT` |
| `discounts` | Coduri de reducere: CRUD owner, generare `XXXX-XXXX`, validare server-side, redemption cu row-lock |
| `loyalty` | Card de fidelitate (punch card): config per salon, progres derivat server-side, auto-redeem la booking |
| `storage` | Proxy upload Supabase Storage cu service role (bucket `staff-gallery`) |
| `client-profiles` | Mini-CRM: lista clienților salonului, note interne, blocare |
| `reviews` | Trimitere recenzie (doar programări COMPLETED), listare publică/owner, răspuns owner |
| `addresses` | Adresele salvate ale userului |
| `notifications` | Notificări in-app persistate + stare citit + **preferințe per user (8 toggles)** (FĂRĂ push real) |
| `payments`, `search` | **FOLDERE GOALE** — doar schelet |

### 4.2 Autentificare și autorizare
- **Guards globale** (APP_GUARD): `SupabaseAuthGuard` → `RolesGuard`. Orice rută cere Bearer token, cu excepția celor `@Public()`. `@Roles(...)` restrânge pe roluri.
- **Dual-issuer**: guard-ul face un peek nesemnat pe `iss` — dacă e `navira-staff` validează JWT-ul HS256 propriu (secret `STAFF_JWT_SECRET`, TTL 7 zile, claims: `role=STAFF_MEMBER`, `staffId`, `salonId`, `sub=userId`); altfel validează prin **JWKS Supabase** (`{SUPABASE_URL}/auth/v1/.well-known/jwks.json`, issuer `{SUPABASE_URL}/auth/v1`, audience `authenticated`, ES256).
- La fiecare request validat, `getOrCreateUser` face upsert în tabela `users` (găsește după `firebaseUid`=UID Supabase → re-link după email → creează stub CLIENT).
- **Staff login**: username+parolă (bcrypt 12 rounds), mesaj generic „Invalid credentials" (anti-enumerare), username normalizat lowercase. Parola nou-creată e returnată O SINGURĂ DATĂ ownerului. Staff-ul își poate schimba parola din app (`POST /auth/staff/change-password`, cere parola curentă).
- Roluri self-assignable la completarea profilului: doar CLIENT și ADMIN_SALON (niciodată STAFF_MEMBER/SUPER_ADMIN).

### 4.3 Endpoint-uri principale (prefix `/api/v1`)
**Publice (fără token):** `GET /salons` (căutare + geo), `GET /salons/:slug`, `GET /salons/:id/opening-hours`, `GET /salons/:id/services`, `GET /salons/:id/staff`, `GET /salons/:id/staff/:staffId`, `GET /salons/:id/availability`, `GET /salons/:id/reviews`, `GET /categories`, `GET /professionals` + `/top` + `/:id`, `POST /auth/staff/login`, `GET /` (health).

**Client autentificat:** `POST /salons/:id/slots/lock` și `/slots/release`, `POST /appointments` (cu `discountCode` opțional), `GET /appointments/me`, `GET/PATCH /appointments/:id` (+ `/reschedule`, `/status`), `POST /reviews`, CRUD `/addresses`, `GET /notifications/me` + mark-read, `GET/PATCH /notifications/preferences`, `POST /salons/:id/discount-codes/validate`, `GET /loyalty/punch-cards/me`, `POST /auth/verify`, `POST /auth/complete-profile`, `GET/PATCH/DELETE /auth/me`, `POST /auth/staff/change-password` (staff).

**Business (ADMIN_SALON):** `POST /salons`, `GET /salons/my/salon`, `PATCH/DELETE /salons/:id`, opening-hours, photos, CRUD services (+ toggle, cu `staffIds`), CRUD staff (+ manage, credentials create/reset, schedule, time-off), `GET /salons/:id/appointments` și `/analytics` (și STAFF_MEMBER, scoped pe propriile programări), CRUD `/salons/:id/discount-codes`, `PUT/GET /salons/:id/punch-card` (+ `/clients/:clientId/progress`, și STAFF_MEMBER la citire), `GET/PATCH /salons/:id/staff/:staffId/profile` + galerie (`/photos`, `/photo-categories`) — self sau owner, `GET /salons/:id/clients` + notes/block, `GET /salons/:id/reviews/manage`, `PATCH /reviews/:id/reply`.

### 4.4 Modelul de date (Prisma → PostgreSQL, tabele snake_case)
**Enums:** `UserRole` (CLIENT, ADMIN_SALON, STAFF_MEMBER, SUPER_ADMIN); `AppointmentStatus` (PENDING, CONFIRMED, **REJECTED**, CANCELLED, COMPLETED, NO_SHOW); `DiscountType` (PERCENT, FIXED); `PaymentStatus` (NOT_REQUIRED, PENDING, PAID, REFUNDED); `BookingSource` (ONLINE, WALK_IN, PHONE); `DayOfWeek`; `SlotLockStatus`.

**Modele:**
- **User** — id, firebaseUid (=UID Supabase, unique), email, phone, firstName/lastName, avatarUrl, dateOfBirth, gender, role (default CLIENT), isActive. Relații: appointments (ca client), reviews, staffProfile, salonAdminOf, notifications, pushTokens, addresses.
- **Salon** — name, slug unique, descriere/contact, adresă + **latitude/longitude obligatorii** (geo-search), isActive, isVerified, stripeAccountId, requiresDeposit + depositPercentage, cancellationHours (default 24), slotLockDurationMin (default 5), averageRating + reviewCount (denormalizate), adminId → User.
- **OpeningHours** — per salon + dayOfWeek, openTime/closeTime ca stringuri "HH:MM", isClosed; unique (salonId, dayOfWeek).
- **SalonPhoto** — galerie (url, caption, sortOrder).
- **Category** — taxonomie globală (21 categorii canonice: Hair, Nails, Brows, HairRemoval, Massage, Facials, Spa, Barbering, Body, Aesthetics, Makeup, Tattoos, Medical, Dental, Chiropractic, PhysicalTherapy, Fitness, Nutrition, MentalHealth, Holistic, Pets); join `SalonCategory`.
- **Service** — per salon: name, durationMin, price Decimal(10,2), currency RON, categoryId, isActive; join `StaffService` (ce staff prestează ce serviciu).
- **Staff** — per salon: nume, specialty, avatarEmoji, avatarUrl, bio; **profil public**: `socials` Json + `publicSettings` Json (4 toggles: showSocials/showContact/showApptCount/showGallery — filtrate server-side); opțional login: userId, username unique, passwordHash (bcrypt, NICIODATĂ expus în API). `StaffSchedule` (program săptămânal per zi, startTime/endTime "HH:MM", isOff), `TimeOffBlock` (concedii/blocaje punctuale), `StaffPhotoCategory` + `StaffPhoto` (galerie publică pe categorii, bucket `staff-gallery`).
- **Appointment** — clientId, salonId, staffId, serviceId, startAt/endAt, status (default PENDING), source (default ONLINE), paymentStatus (default NOT_REQUIRED — plata la salon), guestName/guestPhone (walk-in), **priceSnapshot** (prețul înghețat la momentul rezervării) + **discountAmount** (cod sau punch reward, denormalizat), clientNotes, internalNotes, cancelledAt/By. Indexuri pe (salonId,startAt), (staffId,startAt), (clientId).
- **SlotLock** — model DB există, dar runtime-ul folosește **Redis** (modelul e istoric/backup).
- **Review** — 1:1 cu Appointment (appointmentId unique), rating 1–5, comment, replyText/repliedAt (răspuns owner), isVisible.
- **Payment**, **PushToken** — DOAR modele în schemă, fără cod care le folosească.
- **ClientSalonProfile** — CRM per (salon, client): totalVisits, noShowCount, internalNotes, isBlocked, lastVisitAt.
- **Notification** — userId, title, body, data JSON ({type, appointmentId?}), isRead. **NotificationPreference** — 1:1 cu User, 8 booleeni default true (onAccepted, onRejected, onCancelled, onRescheduled, onPriceChange, onDurationChange, onReview, onReminder).
- **DiscountCode** — per salon: code (unique per salon, normalizat uppercase), type PERCENT/FIXED, value, validFrom/validUntil?, maxRedemptions? (null=nelimitat), maxPerClient (default 1), isActive. **DiscountRedemption** — audit: codeId, appointmentId unique, clientId, amountApplied.
- **PunchCardConfig** — 1:1 cu Salon: isActive (default false), requiredVisits (2–50), rewardType/rewardValue. **PunchRedemption** — audit + reset de progres: salonId, clientId, appointmentId unique, amountApplied.

### 4.5 Slot locking (Redis)
- Cheie: `slotlock:{salonId}:{staffId}:{unixSeconds}`; valoare = sessionId-ul clientului; **SET NX EX** atomic, TTL = `salon.slotLockDurationMin * 60` (default 300s).
- Re-lock idempotent pentru aceeași sesiune; alt sessionId → `409 Conflict`.
- Release prin script Lua atomic — doar ownerul poate șterge.
- **FAIL-OPEN**: dacă Redis e picat, serviciul loghează warning și continuă FĂRĂ lock (lock-ul e doar UX advisory). **Garda autoritară anti-double-booking este verificarea de suprapunere în DB, în tranzacție, la crearea/mutarea programării** (`startAt < endAt AND endAt > startAt` → 409).
- Client Redis: ioredis cu `lazyConnect`, `maxRetriesPerRequest: 1`, `enableOfflineQueue: false` (fail-fast).

### 4.6 Notificări
- **Doar in-app** (rânduri în DB, listate de aplicație; max 50, cele mai noi; vizibile cross-device). NU există trimitere push reală (PushToken e model nefolosit).
- **10 tipuri**: `NEW_BOOKING | BOOKING_ACCEPTED | BOOKING_REJECTED | CANCELLATION | RESCHEDULED | PRICE_CHANGE | DURATION_CHANGE | NO_SHOW | REVIEW | REMINDER` (REMINDER e doar local, expo-notifications — fără emitter pe server).
- **Preferințe per user**: 8 toggles gating în `notify()` (fail-open la erori); `NEW_BOOKING` și `NO_SHOW` sunt always-on. Ecran de setări în app-ul de client.
- Declanșatoare: booking nou → admin salon; confirmare/respingere/anulare de salon/no-show/reschedule → client; anulare de către client → admin; recenzie nouă → admin; răspuns owner → client; **schimbare preț/durată serviciu → toți clienții înregistrați cu programări viitoare pe serviciu**. Toate în try/catch — eșecul notificării nu strică operația principală. Matricea completă: `docs/features/notificari.md`.

### 4.7 Ce NU e implementat în backend (dar pare, după dependențe/schemă)
- **Plăți Stripe** — pachetul instalat, schema pregătită (Payment, stripeAccountId, PaymentIntentId), dar zero cod. Totul e „plata la salon".
- **Push notifications** — modelul `PushToken` există în schemă dar e nefolosit; serverul nu trimite nimic (doar notificări in-app + remindere locale expo-notifications).
- **WebSockets/chat** — `socket.io` instalat în ambele aplicații, **zero utilizare**; nu există feature de chat.
- **Modulul `search`** — folder gol (căutarea se face în salons/professionals controllers).

---

## 5. Arhitectura mobile

### 5.1 Rutare (expo-router, `src/app/`)
**Root `_layout.tsx`** decide fluxul la pornire (după `restoreSession()`):
- neautentificat → grup `(auth)`
- ADMIN_SALON fără onboarding terminat → `(onboarding)` (wizard creare salon)
- rol business (ADMIN_SALON / STAFF_MEMBER / SUPER_ADMIN) → `(business)`
- altfel → `(client)`

**Grupul `(auth)`** (Stack, animație fade): `index` (SplashScreen animat, 2.2s) → `welcome` (carusel 3 sliduri) → `role-selection` (Client vs Salon) → `client-onboarding`/`salon-onboarding` (SignUpWizard comun, 4 pași: email→parolă→telefon→nume) → `login` (email/parolă SAU username de staff, cu butoane DEV în `__DEV__`) → `register`, `otp`.

**Grupul `(client)`** — Tabs cu `FloatingTabBar` (custom, iconuri SVG): tab-uri vizibile **Home / Search / Bookings / Profile**; rute ascunse (navigare programatică): `favorites`, `notifications`, `notification-settings`, `review`, `salon/[id]`, `professional/[id]`, `booking` (tab bar ascuns), `booking-confirmed`, `settings`, `change-password`.

**Grupul `(business)`** — Tabs cu `GlassTabBar` (custom, Ionicons): tab-uri **Calendar (index) / Clients / Analytics / Settings**; staff-ul NU vede Clients. Rute ascunse: `services`, `salon-profile`, `salon-settings`, `reviews`, `marketing`, `discount-codes`, `discount-code-new`, `punch-card`, `staff-profile`, `staff-change-password`.

**Modale la nivel root**: `edit-profile`, `appointment-detail`, `payment-history`, `notifications` (business), `salon-identity`, `salon-location`, `salon-media`, `salon-staff`.

### 5.2 State (Zustand, `src/store/`)
| Store | Conținut |
|---|---|
| `authStore` | user (id, nume, email, phone, avatar, **role**, dob, gender), isAuthenticated, hasCompletedOnboarding, **staffSession**; acțiuni: signInWithEmail/signUpWithEmail (Supabase), signInStaff, completeProfile, restoreSession, signOut, devSignIn; cheie AsyncStorage `navira-staff-session` |
| `businessStore` | appointments, clients, services, staff, salonProfile, selectedDate; update optimist de status; replaceAppointment (temp→real la walk-in) |
| `salonStore` | lista de saloane (SalonCard[]) + salonul selectat pentru ecranul de detaliu |
| `favoritesStore` | favorite persistate (AsyncStorage `navira-favorites`) |
| `notificationStore` | notificări in-app + pushToken; unreadCount |

### 5.3 Stratul API (`src/services/`)
- `api/client.ts` — instanța axios (timeout 10s). **În dev, base URL-ul urmează host-ul Metro** (merge pe simulator ȘI pe telefon real fără IP hardcodat). `setAuthToken` / `setStaffAuthToken` — cât timp există un token de staff, evenimentele Supabase (`onAuthStateChange`) sunt IGNORATE ca să nu suprascrie header-ul.
- `supabase.ts` — client Supabase cu sesiune persistată.
- `storage.ts` — upload direct în Supabase Storage: avatar (bucket `avatars`), logo salon (bucket `salon-assets`), URL public cache-busted.
- Fișiere API pe domenii: `bookings.ts` (servicii/staff/disponibilitate/lock/release/creare/anulare/recenzie + bookingSessionId), `salons.ts` (listare + geo-retry `listSmart`, detaliu pe slug), `business.ts` (tot ce ține de dashboard: programări, walk-in, clienți, servicii, staff+credentiale, analytics, profil salon, poze, reply recenzii, push-tokens), `staffAuth.ts`, `notifications.ts`, `professionals.ts`, `addresses.ts` (cu stub-uri locale DOAR în `__DEV__`), `categories.ts`.
- **Zero mock data** în producție — starea „mock-uri" a fost eliminată deliberat; ecranele au empty-state-uri reale. Excepții minore: sliduri Unsplash în WelcomeScreen, `devSignIn` în `__DEV__`.

### 5.4 Utilitare pure, testate (`src/utils/` + `__tests__/`, **11 suite Jest / 90 teste**)
`appointmentActions` (reguli de tranziție status), `bookingErrors` (NoStaffAvailableError), `bookingSlots` (mapare sloturi, conversii oră locală), `calendarLayout` (layout coloane pentru suprapuneri, drag-snap), `loginIdentifier` (email vs username), `notificationMapping`, `professionalMapping`, `professionalShare` (deep link `navira://professional/{id}`), `reviewMapping` (mapări DTO server→app), `staffSession` (validare sesiune stocată).

---

## 6. Flow-uri cheie (cum funcționează concret)

### 6.1 Booking (clientul face o programare) — `BookingScreen`, 4 pași
1. **Serviciu** — lista serviciilor salonului cu filtru pe categorii (chips)
2. **Specialist** — „Orice specialist disponibil" sau unul anume
3. **Data & Ora** — bandă de 14 zile; sloturile vin din `GET /availability` (calculate din programul staff-ului − programări existente − time-off − lock-uri active). **La atingerea unui slot se face `POST /slots/lock`** → serverul ține slotul 5 minute (Redis SET NX); în UI pornește un countdown. Guard de generație (`lockGenerationRef`) contra răspunsurilor sosite dezordonat; la expirare → alertă + înapoi la pasul 2; la unmount → release.
4. **Confirmare** — sumar + note (max 300 caractere) + **cod de reducere** (validare live `POST /validate`, sume calculate doar pe server); guard de reconciliere (lock-ul ținut trebuie să corespundă slotului afișat); `POST /appointments` → backend re-verifică suprapunerea ÎN TRANZACȚIE (garda reală), re-validează codul de discount / aplică auto-redeem loyalty (codul câștigă, fără stacking), creează cu status PENDING, `priceSnapshot` + `discountAmount`, eliberează lock-ul, notifică salonul → ecranul `booking-confirmed`.
- Erori tratate specific: 401 (auth), 403, 409 („slot ocupat"). Mesajul generic „Nu am putut rezerva ora selectată" apare la orice eșec de lock.

### 6.2 Ciclul de viață al programării
`PENDING` → `CONFIRMED` / **`REJECTED`** (salonul acceptă sau respinge) / `CANCELLED`; `CONFIRMED` → `COMPLETED` / `NO_SHOW` / `CANCELLED`; toate celelalte sunt terminale. Regulile de tranziție sunt în `appointmentActions.ts` (mobile) + `validateTransition` pe server. Clientul poate DOAR anula; ownerul orice tranziție; staff-ul orice tranziție dar doar pe programările lui; COMPLETED/NO_SHOW doar după `startAt`. Reschedule mută startAt/staff cu aceeași verificare de suprapunere. La REJECTED clientul vede „Respinsă" + buton „Rezervă din nou". Fiecare tranziție generează notificare in-app (cu excepția →COMPLETED).

### 6.3 Auth & onboarding
- **Client**: Splash → Welcome → RoleSelection → SignUpWizard → Supabase signUp (confirmarea pe email trebuie să fie OFF în Supabase) → `POST /auth/complete-profile` (telefon normalizat `+40`) → `(client)`.
- **Salon**: același wizard cu rol ADMIN_SALON → wizard-ul `(onboarding)` în 7 pași: identitate (nume/logo/gradient de brand din 9 presets), descriere+contact, servicii, staff (avatare emoji), program, depozit, gata → `POST /salons` etc.
- **Login**: `LoginScreen` detectează automat identificatorul — cu `@` = email (Supabase), fără `@` și ≥3 caractere = username de staff → `POST /auth/staff/login`.
- **Staff mode**: la login staff se face signOut pe orice sesiune Supabase reziduală (siguranță pe tablete partajate), JWT-ul de staff se salvează în AsyncStorage, tab-ul Clients e ascuns, iar `restoreSession` validează token-ul printr-un apel la `GET /notifications/me`.

### 6.4 Recenzii
Doar pentru programări COMPLETED, 1:1 (o recenzie per programare). La deschiderea aplicației, clientului i se propune automat recenzia primei programări finalizate ne-recenzate (de-dup în AsyncStorage `navira-prompted-reviews`, delay 1.2s). Ownerul vede toate recenziile în `ReviewsScreen` și poate răspunde (replyText). Ratingul mediu + numărul de recenzii sunt denormalizate pe salon.

### 6.5 Calendar business (ecranul principal al salonului)
Timeline pe zi (08:00–20:00, 64px/oră), blocuri de programare colorate după sursă (ONLINE=roșu brand, WALK_IN=albastru, PHONE=violet) și status; **long-press + drag pentru reschedule** (snap la 15 min, modal de confirmare); bandă de 14 zile (WeekStrip); indicator „acum"; creare walk-in cu time-picker la 15 min (guestName/guestPhone); chips cu emoji-urile staff-ului pentru filtrare. Staff-ul vede doar propriul calendar. Detaliul programării și fișa clientului se deschid în **modale `DraggableSheet`** (`AppointmentSheet` / `ClientSheet`, bottom-sheet 80% scrollable pe `@gorhom/bottom-sheet`).

### 6.6 Marketing & profil public (v0.3)
- **Settings hub**: Settings → „Datele salonului" (`SalonSettingsScreen`: Identitate / Locație & contact / Galerie / Program — fiecare cu salvare contextuală) și → „Marketing" (`MarketingScreen`) cu două intrări: **Coduri de reducere** (listă + wizard în 2 ecrane, cod generat `XXXX-XXXX` sau custom) și **Card de fidelitate** (config N vizite 2–50 + recompensă PERCENT/FIXED, progres per client în ClientSheet; clientul vede strip-ul `PunchCardsStrip` în Bookings).
- **Profil staff public**: staff-ul (sau ownerul) editează bio/socials/galerie foto pe categorii (upload prin proxy backend → bucket `staff-gallery`), controlează 4 toggles de vizibilitate (filtrate server-side), vede preview-ul exact al clientului (DraggableSheet 90%) și partajează deep link `navira://professional/{id}`.
- Detalii complete: `docs/features/`.

### 6.7 Descoperire (client)
Home: rând de locație (oraș), search pill, carusele orizontale cu snap (saloane recomandate/apropiate, top profesioniști cu avatare gradient-inițiale, categorii circulare). Search: hartă full-screen (react-native-maps) cu markere de rating + bottom sheet stil Apple Maps (snap points ~140px / 50% / 90%) cu listă sortabilă. Geo-search pe server prin Haversine când sunt lat/lng.

---

## 7. Design system (mobile)

Sursă unică de tokens: **`src/theme/index.ts`** — „NAVIRA — Design System / Brand gradient: #6C0000 → #A22921 → #EF6351".

### 7.1 Culori
- **Brand**: `primary #A22921` (roșu cărămiziu), `primaryDark #6C0000` (roșu sânge — start de gradient, pressed), `primaryLight #FCEAE6` (tint pentru chips/fundal activ), `coral #EF6351` (capăt de gradient, accente), `accent #EF6351`, `accentLight #FDEBE7`
- **Gradienți**: `brand ['#6C0000','#A22921','#EF6351']` (CTA-uri principale), `brandSoft ['#A22921','#EF6351']`, `brandDeep ['#5A0000','#8A1F18']`; direcție diagonală (0,0)→(1,1). GradientText pentru titluri brand: `['#6C0000','#EF6351']`
- **Semantice**: success `#22C55E`, warning `#F59E0B`, error `#E5484D`, star `#FBBF24`
- **Neutre calde**: black `#141414`, ink/gray900 `#1A1A1A`, gray700 `#3A3A3A`, gray500 `#8A8A8A`, gray400 `#A8A8A8`, gray300 `#CBCBCB`, gray100 `#F2F2F2`, gray50 `#F8F8F8`
- **Suprafețe**: background `#FAFAFA`, card `#FFFFFF`, border `#ECECEC`, overlay `rgba(20,20,20,0.55)`

### 7.2 Tipografie
- **Font de sistem** (nu există typeface custom încărcat); monospace ad-hoc (Courier/Menlo) pentru coduri de rezervare
- Scala FontSize (px): xs 11, sm 13, md 15, lg 17, xl 20, xxl 26, xxxl 34
- FontWeight: regular 400, medium 500, semibold 600, bold 700, heavy 800
- Titluri de ecran: frecvent 34px heavy cu letterSpacing −0.5; titluri de secțiune: 20px semibold în `primary`

### 7.3 Spacing / Radius / Shadow
- Spacing: xs 4, sm 8, md 16, lg 24, xl 32, xxl 48
- Radius: sm 8, md 12, lg 16, xl 24, pill 40, full 999 (pe Home apar și radii mari hardcodate 37/46)
- Shadow: `sm` (subtilă), `md`, `lg` (glow roșu — shadowColor `#A22921`), `brand` (glow roșu intens sub butoanele primare)

### 7.4 Limbaj vizual
- **Stil: iOS „liquid glass" pe fundal cald, luminos.** DOAR light mode (`userInterfaceStyle: "light"`, fără dark mode nicăieri).
- **Glassmorphism**: `GlassView` (BlurView + bordură hairline albă `rgba(255,255,255,0.6)` + umbră; intensitate ~60) — folosit în tab bars și pe SalonDetail.
- **Tab bar-uri plutitoare**: capsulă glass (92% lățime, h 69, radius 37) cu un „glass pill" animat care alunecă între tab-uri (reanimated spring `{damping:20, stiffness:220, mass:0.85}`, suportă drag). Activ = `primary`, inactiv = negru.
- **Butoane**: `primary` = pill cu gradient brand + Shadow.brand; `outline` = bordură 1.5px primary; `ghost`. Text bold.
- **Inputuri**: rânduri cu Ionicon în față, radius 16, bordură 1.5px **coral**.
- **Carduri**: albe, radius 16–24 (Home: 37–46), bordură hairline `rgba(216,216,216,0.8)`, umbre soft. SalonCard în variante verticală/orizontală cu badge de rating pe imagine.
- **Empty states**: Ionicon outline gray300 + titlu gray700 + corp gray500, adesea în cutie gray50 rotunjită.
- **Skeletons**: puls de opacitate pe forme gray100.
- **Iconografie**: Ionicons dominant + câteva MaterialCommunityIcons (categorii) + SVG-uri locale pentru tab-urile client și header Home; avatare staff = emoji (`avatarEmoji`, default 👤); avatare persoane = imagine sau inițiale pe gradient brand.
- **Branding**: logo PNG `navira-logo.png` (+ wordmark „NAVIRA" cu punct coral), splash `#FCEAE6→alb` cu logo animat și tagline **„Frumusețea, la un tap distanță."**; schema `navira`, bundle `com.navira.mobile`.

### 7.5 Inconsecvențe cunoscute (utile la task-uri de design)
- Iconițele de app (`icon.png`, `adaptive-icon.png`, `favicon.png`) sunt încă placeholder-e Expo generice — doar splash-ul și logo-ul sunt brănduite.
- Resturi de violet pre-rebrand: `lightColor '#7C3AED'` la canalul de notificări Android și culoarea sursei PHONE în calendar.
- Onboarding-ul business permite alegerea a 9 gradienți de brand (inclusiv violet/emerald/sky) — suprafețele business nu sunt garantat roșii.
- Multe ecrane (Home, Booking) folosesc valori hardcodate (`'#222'`, `rgba(216,216,216,0.8)`, radius 37/46, `MUTED`/`SUBTLE_BORDER` locale) în loc de tokens → drift față de `theme/index.ts`.
- Tab bar client (`FloatingTabBar`, SVG) vs business (`GlassTabBar`, Ionicons) — același component de bază, două sisteme de iconuri.

---

## 8. Securitate (starea actuală)

- Guards globale + whitelist validation + rate limiting per-rută (auth/booking/lock/validate-discount mai stricte).
- RLS deny-all pe toate tabelele publice (zero politici, backend privilegiat prin Prisma); bucket `staff-gallery` public-read cu scriere doar prin backend (service role).
- `passwordHash` nu părăsește niciodată API-ul (există test dedicat).
- Staff auth: bcrypt 12, mesaje generice anti-enumerare, TTL 7 zile, issuer separat.
- Slot lock: release doar de owner (Lua atomic); TOCTOU rezolvat prin tranzacție DB la creare.
- Row-locks anti-race: redemption discount (UPDATE pe rândul codului) și punch card (`SELECT ... FOR UPDATE` pe config).
- Redis: doar `127.0.0.1`, `requirepass`, verificat inaccesibil din LAN.
- `.env`-urile sunt gitignored în ambele repo-uri; cheile publice (Supabase anon) sunt by-design publice.
- CORS: `FRONTEND_URL` sau `*` în dev. Swagger doar în dev.
- Greșeli cunoscute de evitat: nu re-aplica guards pe controllere (suprascrie `request.user`).
- Audit v0.3: 9 constatări / 6 fixed — tabelul complet și recomandările rămase (Leaked Password Protection, token versioning staff, trust proxy) în `docs/features/securitate.md`.

---

## 9. Convenții de cod (din regulile proiectului)

- **Imutabilitate obligatorie** (fără mutații in-place), KISS/DRY/YAGNI.
- Fișiere mici (200–400 linii tipic, max 800), funcții <50 linii, fără nesting >4 niveluri.
- Naming: camelCase (funcții/variabile), PascalCase (tipuri/componente), UPPER_SNAKE_CASE (constante), booleeni cu prefix is/has/should/can, hooks cu use.
- Validare la toate granițele (class-validator pe DTO-uri backend; mapări DTO explicite pe mobile în `utils/*Mapping.ts`).
- Erori: gestionate explicit la fiecare nivel, mesaje user-friendly în UI (română), context detaliat în log server; niciodată înghițite silențios.
- Teste: Jest în ambele aplicații; țintă 80% coverage; pattern AAA; TDD încurajat.
- Commits: conventional commits (`feat:`, `fix:`, `chore:` etc.).
- API: răspunsuri paginate cu envelope `{data, total, page, limit, hasNextPage}` la listări.

---

## 10. Stare curentă & gap-uri (ca să nu presupui greșit)

**Funcțional end-to-end azi:** discovery + geo-search, booking cu slot lock real (Redis în Docker), ciclu complet de programări (walk-in inclus, **REJECTED** cu flow de re-rezervare), reschedule drag&drop, staff mode cu credențiale + change-password, **coduri de reducere** (CRUD owner + validare + redemption tranzacțional), **card de fidelitate** (config + progres derivat + auto-redeem), **hub Marketing**, **preferințe de notificări per user** (8 toggles), **profil public de staff cu galerie foto și toggles de vizibilitate + share deep link**, **settings hub „Datele salonului"** cu salvări contextuale, mini-CRM clienți (note, block, progres fidelitate), recenzii cu reply, analytics (săptămână/lună/an/custom, staff-scoped), notificări in-app (10 tipuri), onboarding salon în 7 pași, upload imagini în Supabase Storage (inclusiv proxy backend pentru galeria de staff), modale DraggableSheet (AppointmentSheet/ClientSheet/preview profil).

**Ce NU e implementat (nu presupune că merge):** push notifications reale (doar notificări in-app + remindere locale), chat/WebSockets (socket.io instalat, zero utilizare), i18n (switch-ul de limbă din Settings e doar UI — totul e hardcodat în română), dark mode, plăți/abonamente (Stripe instalat, schema pregătită, zero cod — totul e „plata la salon"), universal links (doar schema `navira://`, fără App Links/Universal Links), modul `search` dedicat (căutarea trăiește în salons/professionals), OTP pe telefon (ecranul există, fluxul principal e email/parolă).

**Particularități de mediu:** DB-ul live conține date de test; seed-ul (`prisma/seed.ts`) poate recrea 5 saloane demo din București + taxonomia de categorii; confirmarea pe email în Supabase trebuie să fie OFF pentru signup-ul din aplicație; `nest --watch` nu repornește la modificări de `.env`.
