# NAVIRA

**Marketplace de beauty & wellness pentru România** — clienții descoperă saloane și profesioniști, văd disponibilitatea reală și fac programări online; saloanele își administrează calendarul, serviciile, echipa, clienții, marketingul și recenziile din aceeași aplicație mobilă (role-based: Client / Owner / Staff).

---

## Cuprins

- [Structura monorepo](#structura-monorepo-npm-workspaces)
- [Ce îți trebuie instalat (o singură dată)](#ce-îți-trebuie-instalat-o-singură-dată)
- [Pas 1 — Clonează și instalează](#pas-1--clonează-și-instalează)
- [Pas 2 — Pornește backend-ul](#pas-2--pornește-backend-ul-api)
- [Pas 3 — Rulează aplicația mobilă](#pas-3--rulează-aplicația-mobilă)
  - [A. Expo Go pe telefon — cel mai simplu (iOS sau Android)](#a-expo-go-pe-telefon--cel-mai-simplu-funcționează-de-pe-windows-și-mac)
  - [B. Simulator iOS — doar pe MacBook (Xcode)](#b-simulator-ios--doar-pe-macbook-necesită-xcode)
  - [C. Emulator Android — pe Windows sau Mac](#c-emulator-android--pe-windows-sau-mac-android-studio)
- [Comenzi utile](#comenzi-utile)
- [Teste](#teste)
- [Documentație](#documentație)

---

## Structura monorepo (npm workspaces)

```
rivo/
├── apps/
│   ├── backend/          # NestJS 11 + Prisma 7 → Supabase Postgres; Redis pentru slot locking; Stripe
│   └── mobile/           # ⚠️ REPO GIT SEPARAT — Expo SDK 54 / React Native (expo-router)
├── packages/             # shared-types, ui-kit (rezervat)
├── docs/features/        # documentație per feature (Scop → Arhitectură → Flow → ...)
├── docs/ROADMAP-DASHBOARD-ADMIN.md   # plan CRM/back-office NAVIRA
├── docs/WEBSITE-STRUCTURE.md         # structură website + abonamente + hosting
├── docs/COLLABORARE.md               # cum lucrează mai mulți dev pe proiect
├── docker-compose.yml    # Redis local (navira-redis)
└── package.json          # scripts monorepo
```

> **Notă importantă:** `apps/mobile` are **remote git propriu** (`github.com/Iustinkt08/mobile`). Comenzile `git` din root **NU** acoperă mobile-ul — vezi [`docs/COLLABORARE.md`](docs/COLLABORARE.md) pentru workflow-ul cu două repo-uri.

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

> ⚠️ **Simulatorul de iOS există DOAR pe Mac** — e o restricție Apple, nu a proiectului. Dacă ești pe **Windows**, poți vedea aplicația în două feluri: (1) **emulator Android** prin Android Studio, sau (2) **Expo Go** pe un telefon fizic (iPhone sau Android). Vezi [Pasul 3](#pas-3--rulează-aplicația-mobilă).

---

## Pas 1 — Clonează și instalează

```bash
git clone https://github.com/Iustinkt08/rivo.git
cd rivo
npm install
```

Creează fișierele `.env` (sunt gitignored, nu ajung pe GitHub):

- `apps/backend/.env` — `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STAFF_JWT_SECRET`, `REDIS_HOST/PORT/PASSWORD`, `FRONTEND_URL`, `PORT`, `NODE_ENV`
- `.env` (root) — `REDIS_PASSWORD` (trebuie să fie **identic** cu cel din backend) + `EXPO_ROUTER_APP_ROOT=apps/mobile/src/app`

> Cere credențialele Supabase/Redis de la administratorul proiectului — nu le ține niciodată în cod. Vezi [`docs/COLLABORARE.md`](docs/COLLABORARE.md#partajarea-secretelor).

---

## Pas 2 — Pornește backend-ul (API)

```bash
open -a Docker              # pornește Docker Desktop (pe Windows: deschide-l manual)
docker compose up -d        # Redis local pe 127.0.0.1:6379
npm run backend             # NestJS pe http://localhost:3000/api/v1
```

- API: **http://localhost:3000/api/v1**
- Swagger (doar în dev): **http://localhost:3000/api/docs**

> Aplicația mobilă are **fallback-uri offline (mock)**, deci pornește și fără backend pentru un demo rapid. Ca să vezi date reale (saloane, programări), backend-ul trebuie să ruleze.

---

## Pas 3 — Rulează aplicația mobilă

Aplicația e **Expo (React Native)**. Alege una din cele 3 variante de mai jos.

În toate cazurile, pornirea se face din root cu:

```bash
npm run mobile              # = expo start (deschide Metro + un QR code în terminal)
```

Metro pornește un meniu în terminal: apeși **`i`** pentru iOS, **`a`** pentru Android, sau scanezi QR-ul cu telefonul.

> 💡 Adresa backend-ului se rezolvă **automat** din host-ul Metro în dev — nu trebuie să setezi manual niciun IP; merge deopotrivă din simulator și de pe telefon fizic, atâta timp cât backend-ul rulează pe același calculator (portul 3000).

### A. Expo Go pe telefon — cel mai simplu (funcționează de pe Windows ȘI Mac)

Nu instalezi nimic pe calculator în plus. Ideal ca să arăți aplicația repede.

1. Instalează **Expo Go** pe telefon (App Store / Google Play).
2. Asigură-te că **telefonul și calculatorul sunt pe aceeași rețea Wi‑Fi**.
3. `npm run mobile`
4. **Scanează QR-ul** din terminal:
   - **Android** → deschide Expo Go → „Scan QR code".
   - **iPhone** → deschide aplicația **Camera** → apasă pe notificarea Expo.

✅ Așa poate un utilizator **pe Windows** să vadă chiar și versiunea de **iOS** — pe un iPhone fizic, prin Expo Go.

### B. Simulator iOS — doar pe MacBook (necesită Xcode)

1. Instalează **Xcode** din **Mac App Store** (gratuit, ~7 GB).
2. Deschide Xcode o dată → acceptă licența → lasă-l să instaleze componentele iOS.
3. În terminal:
   ```bash
   xcode-select --install        # command line tools (dacă nu-s deja)
   npm run mobile                # apoi apasă tasta  i
   ```
   sau direct:
   ```bash
   npm run ios --workspace=apps/mobile   # expo run:ios
   ```

Se deschide **iOS Simulator** cu aplicația NAVIRA.

### C. Emulator Android — pe Windows sau Mac (Android Studio)

1. Instalează **Android Studio** → în timpul setup-ului lasă-l să descarce **Android SDK** + **Platform Tools**.
2. Deschide **Device Manager** din Android Studio → **Create device** → alege un telefon (ex. Pixel 7) → descarcă o imagine de sistem → **Finish**.
3. **Pornește emulatorul** (butonul ▶️ din Device Manager).
4. În terminal:
   ```bash
   npm run mobile                # apoi apasă tasta  a
   ```
   sau direct:
   ```bash
   npm run android --workspace=apps/mobile   # expo run:android
   ```

✅ Aceasta e calea recomandată pentru un utilizator **pe Windows** care vrea să testeze pe calculator.

---

## Comenzi utile

```bash
# Backend
npm run backend                          # dev (nest start --watch)
npm run backend:build                    # build producție

# Baza de date (Prisma → Supabase Postgres)
npm run db:generate                      # generează Prisma Client
npm run db:migrate                       # migrate dev
npm run db:studio                        # Prisma Studio (GUI DB)
npm run prisma:seed --workspace=apps/backend   # 5 saloane demo + taxonomie

# Mobile
npm run mobile                           # expo start
npm run web --workspace=apps/mobile      # preview în browser (react-native-web)
```

---

## Teste

```bash
npm run test --workspace=apps/backend    # Jest backend
npm run test --workspace=apps/mobile     # Jest mobile
npm run test:cov --workspace=apps/backend  # coverage backend
```

---

## Documentație

- [`docs/features/`](docs/features/README.md) — un doc per feature: autentificare, programări, notificări, coduri de reducere, card de fidelitate, profil staff, administrare salon, descoperire, design system, securitate
- [`docs/ROADMAP-DASHBOARD-ADMIN.md`](docs/ROADMAP-DASHBOARD-ADMIN.md) — plan pentru dashboard-ul web / CRM al echipei NAVIRA
- [`docs/WEBSITE-STRUCTURE.md`](docs/WEBSITE-STRUCTURE.md) — structura website-ului, planuri de abonament, promovări, hosting
- [`docs/COLLABORARE.md`](docs/COLLABORARE.md) — cum lucrează mai mulți dezvoltatori pe proiect + strategia de repo-uri
- [`PROJECT_KNOWLEDGE.md`](PROJECT_KNOWLEDGE.md) — context complet al proiectului (stack, arhitectură, flow-uri, convenții)
- [`apps/backend/README.md`](apps/backend/README.md) — rulare/teste/migrații backend + lista modulelor
