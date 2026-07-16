# NAVIRA — Dashboard Web / CRM (back-office echipă NAVIRA)

> **Scop:** o aplicație web separată, folosită **doar de echipa NAVIRA** (super-admin), prin care avem acces la **toți utilizatorii** și **toate saloanele** de pe platformă. Nu e dashboard-ul unui salon (acela e deja în aplicația mobilă, rol Owner/Staff) — e consola internă de administrare, suport și business.

## De ce web și nu mobil

- Muncă operațională (tabele mari, filtre, export, moderare) → ergonomie de desktop.
- Reutilizează **exact același backend** (`apps/backend`, NestJS) — adăugăm doar un set de endpoint-uri `admin` protejate de un rol nou `PLATFORM_ADMIN`.
- Stack recomandat: **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui**, TanStack Query pentru date, TanStack Table pentru grile. Auth prin backend-ul propriu (JWT staff HS256 există deja — extindem cu rol admin).

---

## Faza 0 — Fundație (backend + auth admin)

- [ ] Rol nou `PLATFORM_ADMIN` în schema Prisma (`User.role` sau tabel `AdminUser` separat pentru izolare)
- [ ] Guard `PlatformAdminGuard` + decorator `@AdminOnly()` pe un `AdminModule` nou în backend
- [ ] Login dedicat admin (email + parolă + **2FA/OTP** obligatoriu — e cont cu acces total)
- [ ] **Audit log** transversal: cine, ce, când, asupra cui (imutabil, append-only) — pornit din prima zi
- [ ] Rate limiting + IP allowlist opțional pe rutele `/admin`
- [ ] Proiect nou `apps/web-admin` (Next.js) în monorepo + client API tipizat din `packages/shared-types`

## Faza 1 — Utilizatori (nucleul CRM)

- [ ] **Listă utilizatori** cu paginare server-side, căutare (nume/email/telefon), filtre pe rol (Client / Owner / Staff), status, dată înregistrare
- [ ] **Fișă utilizator**: profil, saloane asociate, istoric programări, recenzii, notificări, adrese
- [ ] Acțiuni: suspendare / reactivare / ștergere (GDPR — „dreptul de a fi uitat"), resetare parolă, resend verificare email
- [ ] **Impersonare (support login-as)** — strict logat în audit, cu banner vizibil și expirare scurtă
- [ ] Export CSV/Excel al segmentelor (cu respectarea GDPR)
- [ ] Note interne per user (pentru echipa de suport)

## Faza 2 — Saloane

- [ ] **Listă saloane**: nume, oraș, owner, nr. staff, nr. servicii, rating, status abonament, dată onboarding
- [ ] **Fișă salon**: date business, program, galerie, echipă, servicii, KPI (programări/lună, venit estimat, rată no-show)
- [ ] **Flux de aprobare / verificare (KYC salon)**: pending → verificat → respins; documente/CUI; badge „verificat"
- [ ] Acțiuni: suspendare salon, editare de urgență, marcare „featured / promovat" (vezi monetizare)
- [ ] Gestionare **taxonomie categorii** (există deja `CategoriesController`) — adăugare/editare categorii & servicii standard
- [ ] Moderare **galerie & conținut** salon (imagini raportate)

## Faza 3 — Programări & operațional

- [ ] Vizualizare **globală a programărilor** (toate saloanele): calendar + tabel, filtre pe salon/staff/status/interval
- [ ] Dashboard **dispute / anulări / no-show** — cazuri care necesită intervenție suport
- [ ] Instrumente de reconciliere (ex. programare blocată de un slot-lock expirat)

## Faza 4 — Monetizare (abonamente + comisioane)

- [ ] Integrare **Stripe Billing** (dependența `stripe` există deja în backend, modulul `payments` e schelet)
- [ ] Definire **planuri de abonament salon** (Free / Pro / Premium — detalii în [`WEBSITE-STRUCTURE.md`](WEBSITE-STRUCTURE.md#planuri-de-abonament-pentru-saloane))
- [ ] Ecran **Billing**: abonamentul fiecărui salon, status plată, facturi, upgrade/downgrade, cupoane
- [ ] **Promovări plătite („hot"/featured)**: gestionarea listărilor promovate, poziționare în căutare, perioadă, preț
- [ ] Rapoarte de venit: **MRR / ARR**, churn, LTV, venit din comisioane vs. abonamente
- [ ] Gestionare **coduri de reducere la nivel de platformă** (marketing NAVIRA, nu doar per salon)

## Faza 5 — Marketing & comunicare (leagă branch-ul v0.3)

- [ ] **Broadcast notificări** către segmente (toți clienții dintr-un oraș, toți ownerii etc.) — folosește modulul `notifications` + push (`expo-notifications` / `firebase-admin` există)
- [ ] Campanii email (integrare provider — vezi hosting)
- [ ] Bannere / anunțuri in-app configurabile din admin
- [ ] Gestionare **recenzii raportate** (modulul `reviews`) — moderare, ascundere, răspuns oficial

## Faza 6 — Analytics & sănătatea platformei

- [ ] Dashboard KPI principal: utilizatori activi (DAU/MAU), saloane active, programări/zi, GMV, MRR
- [ ] Grafice de creștere (înregistrări, retenție, cohorte)
- [ ] Top saloane / orașe / servicii
- [ ] Alerting operațional (căderi backend, cozi Redis, erori plăți)

## Faza 7 — Guvernanță & securitate

- [ ] RBAC fin în interiorul adminului (super-admin vs. suport vs. finance vs. read-only)
- [ ] Retenție & export date GDPR la cerere
- [ ] Pistă de audit completă + alertare pe acțiuni sensibile (impersonare, ștergeri, refund-uri)
- [ ] Pagină de „system status" internă

---

## Prioritizare sugerată (MVP → mai departe)

1. **MVP admin (2–3 săptămâni):** Faza 0 + Faza 1 (utilizatori) + listă saloane read-only din Faza 2.
2. **V1:** aprobare saloane (Faza 2), vizualizare programări (Faza 3), analytics de bază (Faza 6).
3. **V2:** monetizare Stripe (Faza 4) + marketing/broadcast (Faza 5).
4. **V3:** guvernanță fină, alerting, rapoarte financiare avansate (Faza 7).

## Model de date — ce lipsește azi

Backend-ul acoperă deja: users, salons, services, staff, appointments, discounts, loyalty, notifications, reviews, client-profiles, addresses. **De adăugat pentru admin/monetizare:**

- `AdminUser` / rol `PLATFORM_ADMIN` + `AuditLog`
- `Subscription` (salon → plan, status Stripe, perioadă) + `Invoice`
- `FeaturedListing` / `Promotion` (promovări „hot")
- `SalonVerification` (status KYC + documente)
