# NAVIRA — Backend (NestJS)

API REST pentru platforma NAVIRA (marketplace beauty & wellness). NestJS 11 + Prisma 7 → PostgreSQL (Supabase), Redis pentru slot locking, auth dual-issuer (Supabase ES256 + JWT propriu HS256 pentru staff). Prefix global: `/api/v1`. Swagger la `/api/docs` (doar în dev).

## Rulare

```bash
# din root-ul monorepo-ului
docker compose up -d          # Redis local (navira-redis)
npm run backend               # nest start --watch, port 3000

# sau din apps/backend
npm run start:dev
npm run start:prod            # node dist/main (după npm run build)
```

Env necesare (`.env`, gitignored): `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STAFF_JWT_SECRET`, `REDIS_HOST/PORT/PASSWORD`, `FRONTEND_URL`, `PORT`, `NODE_ENV`.

## Teste

```bash
npm run test                  # Jest (unit + integrare pe servicii)
npm run test:cov              # coverage
npm run test:e2e              # config test/jest-e2e.json
```

## Prisma (schema în `src/prisma/schema.prisma`)

```bash
npm run prisma:generate
npm run prisma:migrate        # migrate dev
npm run prisma:migrate:prod   # migrate deploy
npm run prisma:studio
npm run prisma:seed           # 5 saloane demo + taxonomia de categorii
```

## Module (`src/modules/`)

| Modul | Rol |
|---|---|
| `auth` | Auth dual-issuer (Supabase JWKS + staff HS256), guards globale, verify/complete-profile |
| `salons` | CRUD salon, căutare publică + geo (Haversine), program, galerie; CategoriesController |
| `services` | CRUD servicii per salon + staff assignment (`staffIds`) |
| `staff` | CRUD staff, program, time-off, credențiale login, profil public + galerie; ProfessionalsController |
| `appointments` | Disponibilitate, slot lock (Redis), booking, reschedule, tranziții status, analytics |
| `discounts` | Coduri de reducere: CRUD owner, validare, redemption tranzacțional |
| `loyalty` | Card de fidelitate (punch card): config per salon, progres derivat, auto-redeem |
| `notifications` | Notificări in-app persistate + preferințe per user |
| `reviews` | Recenzii (doar COMPLETED), reply owner, rating denormalizat |
| `client-profiles` | Mini-CRM: clienții salonului, note interne, blocare |
| `addresses` | Adresele salvate ale userului |
| `storage` | Proxy upload Supabase Storage (service role) — galerie staff |
| `users` | Profil user |
| `payments`, `search` | Schelet, fără implementare |

Documentația per feature: [`docs/features/`](../../docs/features/) în root-ul repo-ului.
