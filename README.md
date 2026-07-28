# NAVIRA

**Marketplace de beauty & wellness pentru România** — clienții descoperă saloane și profesioniști, văd disponibilitatea reală și fac programări online; saloanele își administrează calendarul, serviciile, echipa, clienții, marketingul și recenziile din aceeași aplicație mobilă (role-based: Client / Owner / Staff).

> **Tot proiectul e într-un singur repo.** Backend + aplicație mobilă + documentație + fișierele `.env`. Faci `git clone`, `npm install` și pornești — nu trebuie să ceri nimic de la nimeni.

---

## Cuprins

- [Pornire rapidă (5 minute)](#pornire-rapidă-5-minute)
- [Structura monorepo](#structura-monorepo-npm-workspaces)
- [Ce îți trebuie instalat](#ce-îți-trebuie-instalat-o-singură-dată)
- [Pas 1 — Clonează și instalează](#pas-1--clonează-și-instalează)
- [Pas 2 — Pornește backend-ul](#pas-2--pornește-backend-ul-api)
- [Pas 3 — Rulează aplicația mobilă în Expo](#pas-3--rulează-aplicația-mobilă-în-expo)
  - [A. Expo Go pe telefon (Windows sau Mac)](#a-expo-go-pe-telefon--cel-mai-simplu-windows-sau-mac)
  - [B. Simulator iOS (doar Mac)](#b-simulator-ios--doar-pe-mac-xcode)
  - [C. Emulator Android (Windows sau Mac)](#c-emulator-android--windows-sau-mac-android-studio)
- [Probleme frecvente și rezolvări](#probleme-frecvente-și-rezolvări)
- [Comenzi utile](#comenzi-utile)
- [Teste](#teste)
- [Secrete și acces](#secrete-și-acces)
- [Documentație](#documentație)

---

## Pornire rapidă (5 minute)

Pentru cineva care vrea doar să vadă aplicația pe telefon:

```bash
git clone https://github.com/Iustinkt08/rivo.git
cd rivo
npm install
npm run mobile          # pornește Expo, afișează un QR code
```

Scanezi QR-ul cu **Expo Go** de pe telefon și aplicația pornește. Aplicația are fallback-uri offline (mock), deci merge și **fără backend** pentru un demo rapid.

Pentru date reale (saloane, programări din baza de date), pornește și backend-ul — vezi [Pasul 2](#pas-2--pornește-backend-ul-api).

---

## Structura monorepo (npm workspaces)

```
rivo/
├── apps/
│   ├── backend/          # NestJS 11 + Prisma 7 → Supabase Postgres; Redis (slot locking); Stripe
│   └── mobile/           # Expo SDK 54 / React Native 0.81 (expo-router)
├── packages/             # shared-types, ui-kit (rezervat)
├── docs/features/        # documentație per feature (Scop → Arhitectură → Flow → ...)
├── docs/ROADMAP-DASHBOARD-ADMIN.md   # plan CRM/back-office NAVIRA
├── docs/WEBSITE-STRUCTURE.md         # structură website + abonamente + hosting
├── docs/COLLABORARE.md               # cum lucrează mai mulți dev pe proiect
├── docker-compose.yml    # Redis local (navira-redis)
├── .env                  # config root (Expo Router + parola Redis)
└── package.json          # scripts monorepo
```

---

## Ce îți trebuie instalat (o singură dată)

Valabil pe **orice** sistem de operare:

| Tool | La ce e | Cum îl iei |
|---|---|---|
| **Node.js 20 LTS** + npm | rulează tot proiectul | https://nodejs.org (versiunea LTS) |
| **Git** | clonezi codul | https://git-scm.com |
| **Docker Desktop** | Redis local (slot locking la programări) | https://www.docker.com/products/docker-desktop |
| **Expo Go** (pe telefon) | vezi aplicația mobilă instant | App Store (iOS) / Google Play (Android) |

Extra, **doar dacă vrei simulator/emulator pe calculator** (nu pe telefon):

| Vrei să vezi... | Ai nevoie de... | Merge pe |
|---|---|---|
| **iOS** în simulator | **Xcode** (gratuit din Mac App Store) | 🍎 **doar macOS** |
| **Android** în emulator | **Android Studio** | 🍎 macOS **și** 🪟 Windows |

> ⚠️ **Simulatorul de iOS există DOAR pe Mac** — restricție Apple, nu a proiectului. Pe **Windows** vezi aplicația în două feluri: (1) **emulator Android** prin Android Studio, sau (2) **Expo Go** pe un telefon fizic — inclusiv pe iPhone. Vezi [Pasul 3](#pas-3--rulează-aplicația-mobilă-în-expo).

---

## Pas 1 — Clonează și instalează

```bash
git clone https://github.com/Iustinkt08/rivo.git
cd rivo
npm install
```

`npm install` din root instalează dependențele pentru **toate** workspace-urile (backend + mobile + packages) — nu trebuie să intri în fiecare folder.

### Configurarea (`.env`) vine deja în repo

Spre deosebire de majoritatea proiectelor, aici **fișierele `.env` sunt incluse în git**, deci după clone ai deja tot ce trebuie. Fișierele sunt:

| Fișier | Ce conține |
|---|---|
| `.env` (root) | `EXPO_ROUTER_APP_ROOT`, `REDIS_PASSWORD` |
| `apps/backend/.env` | `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `REDIS_*`, `STRIPE_*`, `STAFF_JWT_SECRET`, `GOOGLE_MAPS_API_KEY`, `PORT`, `NODE_ENV`, `APP_URL`, `FRONTEND_URL` |
| `apps/mobile/.env` | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`, `GOOGLE_MAPS_ANDROID_API_KEY` |
| `apps/mobile/.env.local` | aceleași chei ca mai sus (override local; are prioritate în Expo) |

> `REDIS_PASSWORD` din `.env` (root) trebuie să rămână **identic** cu cel din `apps/backend/.env` — root-ul îl dă containerului Docker, backend-ul îl folosește ca să se conecteze.

> ⚠️ Citește [Secrete și acces](#secrete-și-acces) înainte să faci repo-ul public sau să adaugi colaboratori.

---

## Pas 2 — Pornește backend-ul (API)

```bash
# 1. Pornește Docker Desktop
open -a Docker              # pe Windows: deschide-l manual din Start

# 2. Redis local pe 127.0.0.1:6379
docker compose up -d

# 3. Generează Prisma Client (prima dată, sau după schimbări de schemă)
npm run db:generate

# 4. Pornește API-ul
npm run backend             # NestJS, watch mode
```

- API: **http://localhost:3000/api/v1**
- Swagger (doar în dev): **http://localhost:3000/api/docs**

Baza de date (Supabase Postgres) e deja populată cu 5 saloane demo. Dacă vrei să o repopulezi de la zero:

```bash
npm run prisma:seed --workspace=apps/backend
```

---

## Pas 3 — Rulează aplicația mobilă în Expo

Aplicația e **Expo SDK 54 / React Native**. Pornirea se face mereu din root:

```bash
npm run mobile              # = expo start (deschide Metro + QR code în terminal)
```

Metro afișează un meniu în terminal: apeși **`i`** pentru iOS, **`a`** pentru Android, **`w`** pentru browser, sau scanezi QR-ul cu telefonul.

> 💡 **Nu trebuie să setezi niciun IP.** În dev, adresa backend-ului se deduce automat din host-ul Metro (vezi `apps/mobile/src/services/api/client.ts`), deci merge și din simulator, și de pe telefon fizic, chiar dacă IP-ul calculatorului se schimbă. Singura condiție: backend-ul să ruleze pe același calculator, pe portul 3000.

### A. Expo Go pe telefon — cel mai simplu (Windows sau Mac)

Nu instalezi nimic în plus pe calculator. Ideal ca să arăți aplicația repede.

1. Instalează **Expo Go** pe telefon (App Store / Google Play).
2. Asigură-te că **telefonul și calculatorul sunt pe aceeași rețea Wi-Fi**.
3. `npm run mobile`
4. **Scanează QR-ul** din terminal:
   - **Android** → deschizi Expo Go → „Scan QR code".
   - **iPhone** → deschizi aplicația **Camera** → apeși pe notificarea Expo.

✅ Așa poate cineva **pe Windows** să vadă chiar și versiunea de **iOS**, pe un iPhone fizic.

> Notă: harta Google Maps și notificările push nu funcționează complet în Expo Go (au nevoie de cod nativ). Restul aplicației merge integral. Pentru funcționalitate 100%, folosește varianta B sau C.

### B. Simulator iOS — doar pe Mac (Xcode)

1. Instalează **Xcode** din **Mac App Store** (gratuit, ~7 GB).
2. Deschide Xcode o dată → acceptă licența → lasă-l să instaleze componentele iOS.
3. În terminal:
   ```bash
   xcode-select --install                  # command line tools (dacă nu-s deja)
   npm run mobile                          # apoi apeși tasta  i
   ```
   sau build nativ complet:
   ```bash
   npm run ios --workspace=apps/mobile     # expo run:ios
   ```

Se deschide **iOS Simulator** cu aplicația NAVIRA.

### C. Emulator Android — Windows sau Mac (Android Studio)

1. Instalează **Android Studio** → în setup lasă-l să descarce **Android SDK** + **Platform Tools**.
2. **Device Manager** din Android Studio → **Create device** → alegi un telefon (ex. Pixel 7) → descarci o imagine de sistem → **Finish**.
3. **Pornește emulatorul** (▶️ din Device Manager).
4. În terminal:
   ```bash
   npm run mobile                              # apoi apeși tasta  a
   ```
   sau build nativ complet:
   ```bash
   npm run android --workspace=apps/mobile     # expo run:android
   ```

✅ Calea recomandată pe **Windows** pentru testare pe calculator.

---

## Probleme frecvente și rezolvări

| Simptom | Cauză | Rezolvare |
|---|---|---|
| QR-ul se scanează dar aplicația nu pornește | telefonul și laptopul pe rețele Wi-Fi diferite | pune-le pe aceeași rețea, sau pornește cu `npx expo start --tunnel` din `apps/mobile` |
| „Unable to resolve module ..." | cache Metro vechi | `npx expo start -c` (curăță cache-ul) |
| Aplicația arată date mock, nu saloane reale | backend-ul nu rulează | pornește `npm run backend` și verifică http://localhost:3000/api/v1 |
| Backend crapă la pornire cu eroare Redis | Docker nu rulează | `open -a Docker`, apoi `docker compose up -d` |
| Eroare Prisma „Client not generated" | lipsește Prisma Client | `npm run db:generate` |
| `expo run:ios` cere cont de developer | build nativ pe device fizic | folosește simulatorul, sau Expo Go pe telefon |
| Harta e goală pe Android | lipsește cheia Google Maps | verifică `GOOGLE_MAPS_ANDROID_API_KEY` în `apps/mobile/.env` |
| Portul 3000 e ocupat | alt proces pe 3000 | schimbă `PORT` în `apps/backend/.env` |

---

## Comenzi utile

```bash
# Backend
npm run backend                          # dev (nest start --watch)
npm run backend:build                    # build producție

# Baza de date (Prisma → Supabase Postgres)
npm run db:generate                      # generează Prisma Client
npm run db:migrate                       # migrate dev
npm run db:studio                        # Prisma Studio (GUI pentru DB)
npm run prisma:seed --workspace=apps/backend   # 5 saloane demo + taxonomie

# Mobile
npm run mobile                           # expo start
npm run web --workspace=apps/mobile      # preview în browser (react-native-web)
npx expo start -c                        # (din apps/mobile) pornire cu cache curat

# Redis
docker compose up -d                     # pornește
docker compose down                      # oprește
```

---

## Teste

```bash
npm run test --workspace=apps/backend       # Jest backend
npm run test --workspace=apps/mobile        # Jest mobile
npm run test:cov --workspace=apps/backend   # coverage backend
```

Stare curentă backend: **16 suite, 223 teste — toate trec**; typecheck TypeScript fără erori.

---

## Secrete și acces

⚠️ **Citește asta înainte să dai acces cuiva sau să schimbi vizibilitatea repo-ului.**

Prin decizie explicită a proprietarului proiectului, fișierele `.env` **sunt commit-uite în acest repo**, ca oricine clonează să poată rula proiectul fără schimb manual de credențiale. Consecințele, ca să fie clare:

- Cheile sunt vizibile **oricui are acces la repo**.
- Odată commit-uite, rămân **permanent în istoricul git** — ștergerea lor într-un commit ulterior **nu** le scoate din istoric.
- Dacă repo-ul e **public**, cheile sunt vizibile pe internet și sunt colectate automat de scannere în câteva minute.

Chei cu **valori reale** aflate în repo, în ordinea urgenței:

| Prioritate | Cheie | Fișier | Unde se rotește |
|---|---|---|---|
| 🔴 critic | `DATABASE_URL` / `DIRECT_URL` (parola Postgres) | `apps/backend/.env` | Supabase → Settings → Database → Reset password |
| 🔴 critic | `STAFF_JWT_SECRET` | `apps/backend/.env` | generezi un secret nou de 64 caractere (invalidează sesiunile staff active) |
| 🟠 ridicat | `GOOGLE_MAPS_ANDROID_API_KEY` | `apps/mobile/.env` | Google Cloud Console → Credentials → Regenerate (sau restricționează pe package name + SHA-1) |
| 🟡 scăzut | `REDIS_PASSWORD` / `REDIS_URL` | `.env` + `apps/backend/.env` | schimbi în ambele fișiere (trebuie să fie identice); Redis ascultă doar pe `127.0.0.1`, deci nu e expus în rețea |

Chei care **nu** sunt un risc:

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `GOOGLE_MAPS_API_KEY` — momentan **placeholder-e goale** în `apps/backend/.env`. Când le completezi cu valori reale, ele devin expuse ca restul.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — proiectată să fie publică (protejată de Row Level Security).
- `SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `APP_URL`, `FRONTEND_URL` — URL-uri, nu secrete.

Dacă vrei să revii la practica standard (secrete în afara git-ului): scoate comentariile din `.gitignore` pentru `.env`, rulează `git rm --cached` pe fișiere, **rotește toate cheile de mai sus** și distribuie `.env`-urile printr-un manager de parole.

### Cum dai acces unui coleg

Repo-ul e deținut de contul **`Iustinkt08`**. Doar acel cont poate:

1. **Adăuga colaboratori** — GitHub → repo → *Settings* → *Collaborators* → *Add people* → username-ul colegului.
2. **Schimba vizibilitatea** — GitHub → repo → *Settings* → *General* → *Danger Zone* → *Change visibility*.
3. **Invita în proiectul Supabase** (ca să poată administra DB și userii) — Supabase Dashboard → *Settings* → *Team* → *Invite*.

---

## Documentație

- [`docs/features/`](docs/features/README.md) — un doc per feature: autentificare, programări, notificări, coduri de reducere, card de fidelitate, profil staff, administrare salon, descoperire, design system, securitate
- [`docs/ROADMAP-DASHBOARD-ADMIN.md`](docs/ROADMAP-DASHBOARD-ADMIN.md) — plan pentru dashboard-ul web / CRM al echipei NAVIRA
- [`docs/WEBSITE-STRUCTURE.md`](docs/WEBSITE-STRUCTURE.md) — structura website-ului, planuri de abonament, promovări, hosting
- [`docs/COLLABORARE.md`](docs/COLLABORARE.md) — cum lucrează mai mulți dezvoltatori pe proiect
- [`PROJECT_KNOWLEDGE.md`](PROJECT_KNOWLEDGE.md) — context complet al proiectului (stack, arhitectură, flow-uri, convenții)
- [`apps/backend/README.md`](apps/backend/README.md) — rulare/teste/migrații backend + lista modulelor
