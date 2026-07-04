# NAVIRA

**Marketplace de beauty & wellness pentru România** — clienții descoperă saloane și profesioniști, văd disponibilitatea reală și fac programări online; saloanele își administrează calendarul, serviciile, echipa, clienții, marketingul și recenziile din aceeași aplicație mobilă (role-based: Client / Owner / Staff).

## Structura monorepo (npm workspaces)

```
rivo/
├── apps/
│   ├── backend/          # NestJS 11 + Prisma 7 → Supabase Postgres; Redis pentru slot locking
│   └── mobile/           # ⚠️ SUBMODUL GIT SEPARAT — Expo SDK 54 / React Native (expo-router)
├── packages/             # gol / rezervat
├── docs/features/        # documentație per feature (framework: Scop → Arhitectură → Flow → ...)
├── docker-compose.yml    # Redis local (navira-redis)
└── package.json          # scripts monorepo
```

> **Notă:** `apps/mobile` este submodul git cu remote propriu — comenzile git din root NU acoperă mobile-ul; commit/push separat în submodul.

## Quick start

```bash
npm install
open -a Docker && docker compose up -d   # Redis (slot locking)
npm run backend                          # API pe http://localhost:3000/api/v1 (Swagger: /api/docs în dev)
npm run mobile                           # expo start (apoi `i` pentru iOS simulator)
```

Baza de date: Postgres găzduit pe Supabase — `npm run db:generate` / `db:migrate` / `db:studio`. Seed demo: `npm run prisma:seed` din `apps/backend`.

## Teste

```bash
npm run test --workspace=apps/backend    # Jest backend (221 teste)
npm run test --workspace=apps/mobile     # Jest mobile (90 teste)
```

## Documentație

- [`docs/features/`](docs/features/README.md) — un doc per feature: autentificare, programări, notificări, coduri de reducere, card de fidelitate, profil staff, administrare salon, descoperire, design system, securitate
- [`PROJECT_KNOWLEDGE.md`](PROJECT_KNOWLEDGE.md) — context complet al proiectului (stack, arhitectură, flow-uri, convenții)
- [`apps/backend/README.md`](apps/backend/README.md) — rulare/teste/migrații backend + lista modulelor
