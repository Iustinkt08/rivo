# Descoperire (Discovery)

## Scop

Suprafața publică a platformei: clienții (chiar și nelogați) caută saloane după locație/text/categorie, explorează profesioniști top, văd disponibilitatea reală și navighează pe hartă cu bottom sheet stil Apple Maps.

## Arhitectură

**Modele Prisma:** `Salon` (latitude/longitude obligatorii, averageRating/reviewCount denormalizate), `Category` + `SalonCategory`, `Service`, `Staff`, `Review`.

**Endpoint-uri — toate `@Public()`:**
| Endpoint | Note |
|---|---|
| `GET /salons` | geo-search + text + filtre, paginat |
| `GET /salons/:slug` | detaliu pe slug |
| `GET /salons/:id/opening-hours`, `/services`, `/staff`, `/reviews` | sub-resurse publice |
| `GET /salons/:salonId/availability` | sloturi reale pre-login |
| `GET /categories` | taxonomia (tabel seeded, ordonat pe sortOrder) |
| `GET /professionals`, `/professionals/top`, `/professionals/:id` | descoperire profesioniști |

**Ecrane mobile (client):** `(client)/index.tsx` → `HomeScreen`, `(client)/search.tsx` → `SearchScreen` (hartă + sheet), `(client)/salon/[id].tsx` → `SalonDetailScreen`, `(client)/professional/[id].tsx` → `ProfessionalProfileScreen`.

## Flow

1. **Home:** rând de locație + city picker, search field (SearchOverlay), pills favorite/notificări, „Recomandate" (carusel orizontal, `salonsApi.listSmart` cu geo-retry), „Cei mai buni profesioniști" (`getTop(10)`, ascuns când e gol), „Categorii" (cercuri orizontale → `/search?category=`).
2. **Geo-search (server):** cu `lat`+`lng` → `findAllGeo` cu **Haversine raw SQL**: `6371 * acos(GREATEST(-1, LEAST(1, cos·cos·cos + sin·sin)))` (clamp anti-NaN), subquery cu `distance_km <= radiusKm`, `ORDER BY distance_km ASC`; `distanceKm` rotunjit la 0.1.
3. **Search screen:** `MapView` (react-native-maps) cu markere de rating; `NearbySalonsSheet` pe `DraggableSheet` cu snap points `[navbarHeight + header, '50%', '90%']` — selectarea unui marker sare la 50%; toggle hartă/listă; re-query la schimbarea regiunii cu debounce 400ms.
4. **Detaliu salon:** galerie cover, „deschis acum", favorite, servicii + staff, top 5 recenzii, CTA de booking. **Detaliu profesionist:** `ProfessionalProfileContent` partajat + share deep link + CTA sticky „Rezervă la {salon}".

## Reguli de business

- `radiusKm`: default **10**, min 0.5, max 100. Paginare: `limit` default **20**, max **50**; envelope `{data, total, page, limit, hasNextPage}`. Sort: `distance | rating | name`.
- Text search: `name ILIKE %q%` pe salon SAU pe numele serviciilor. Filtre: `categoryId`/`category` (nume, case-insensitive), `minRating` (1–5), `city`.
- **21 categorii canonice** — sursa de adevăr e constanta `CANONICAL_CATEGORIES` (`apps/backend/prisma/categories.ts`), seeded în tabelul `Category`; mirror-ul mobile (`constants/categories.tsx`) are 22 de intrări = 21 reale + „All treatments" (categorie goală, doar UI).
- **Top profesioniști:** `isActive: true`, ordonați după `_count` de appointments desc, limit default 10 (clamp 1–50); search după firstName/lastName/specialty (contains, insensitive), limit default 20; ratingurile agregate din recenzii prin appointments.
- Availability publică: aceleași reguli ca la booking (program staff − programări − time-off − lock-uri), interval 15 min, timezone Europe/Bucharest.

## Securitate

- Rutele publice expun doar date filtrate: `toPublicStaff` scoate username/userId/contact/passwordHash; câmpurile de profil ascunse prin `publicSettings` sunt omise server-side (vezi `profil-staff.md`).
- Rate limiting global 100/min acoperă și rutele publice.
- Datele scriibile rămân în spatele auth-ului — descoperirea e read-only.

## Fișiere cheie

- `apps/backend/src/modules/salons/salons.controller.ts`, `salons.service.ts` (findAllGeo), `categories.controller.ts`, `dto/salon-query.dto.ts`
- `apps/backend/src/modules/staff/professionals.controller.ts`, `staff.service.ts` (findTopProfessionals, searchProfessionals)
- `apps/backend/prisma/categories.ts`, `prisma/seed-categories.ts`
- `apps/mobile/src/screens/client/HomeScreen.tsx`, `SearchScreen.tsx`, `SalonDetailScreen.tsx`, `ProfessionalProfileScreen.tsx`
- `apps/mobile/src/components/client/NearbySalonsSheet.tsx`, `services/api/salons.ts`, `services/api/professionals.ts`, `constants/categories.tsx`
