# Administrare salon (Settings hub)

## Scop

Tot ce administrează ownerul din aplicația business: datele salonului (identitate, locație, galerie, program), serviciile cu asignare de staff, echipa cu credențiale de login, recenziile cu reply, mini-CRM-ul de clienți și hub-ul de Marketing — organizate ca hub de setări cu **salvări contextuale** (fiecare editor își salvează felia lui).

## Arhitectură

**Modele Prisma:** `Salon` (+ depositPercentage, cancellationHours), `OpeningHours`, `SalonPhoto`, `Service` + `StaffService`, `Staff` (username/passwordHash), `ClientSalonProfile` (internalNotes, isBlocked, totalVisits, noShowCount), `Review` (replyText/repliedAt).

**Endpoint-uri principale:**
| Endpoint | Roluri |
|---|---|
| `PATCH /salons/:id` | `ADMIN_SALON`, `SUPER_ADMIN` (owner asserted în service) |
| `POST /salons/:id/opening-hours` | idem — upsert per zi în `$transaction` |
| `POST /salons/:id/photos`, `DELETE .../photos/:photoId` | idem (body cu `url`) |
| `POST/PATCH/DELETE /salons/:salonId/services` (+ `PATCH :id/toggle`) | `ADMIN_SALON`; `GET` e `@Public()` |
| `POST /salons/:salonId/staff/:staffId/credentials` (create), `PATCH .../credentials` (reset) | `ADMIN_SALON` |
| `GET /salons/:salonId/clients`, `PATCH :clientId/notes`, `PATCH :clientId/block` | `ADMIN_SALON` |
| `GET /salons/:id/reviews/manage`, `PATCH /reviews/:id/reply` | autentificat, ownership în service (`salon.adminId`) |

**Ecrane mobile (business):** `SettingsScreen` (hub principal; sesiunile de staff văd `StaffSettingsView`) → **Datele salonului** (`SalonSettingsScreen`: Identitate / Locație & contact / Galerie foto / Program de lucru inline), **Marketing** (`MarketingScreen`), **Servicii & prețuri** (`ServicesScreen`), **Echipa** (`SalonStaffScreen`), **Recenzii** (`ReviewsScreen`), **Clienți** (`ClientsScreen`, tab separat), plus „Politica de rezervare" (deposit %, ore de anulare) cu salvare proprie.

## Flow

1. **Datele salonului:** hub `SalonSettingsScreen` cu rânduri → modalele root `salon-identity` (nume/logo/gradient), `salon-location` (hartă react-native-maps), `salon-media` (galerie); programul de lucru se editează inline și se salvează separat (`businessApi.setOpeningHours` → upsert per zi în tranzacție). Fără „save global".
2. **Servicii cu staff-assignment:** `ServicesScreen` trimite `staffIds` în payload; backend-ul sincronizează junction-ul exact (`deleteMany` + `createMany` la update), cu guard `assertStaffBelongToSalon` (cross-tenant, audit fix #4).
3. **Echipă + credențiale:** adaugi membru (opțional cu username); iconița cheie creează/resetează credențiale — parola e **generată pe server** (12 caractere, charset fără ambiguități, bcrypt 12) și afișată **o singură dată** în `StaffCredentialsModal` („Parola se generează automat și se afișează o singură dată"); se creează un `User` legat cu rol STAFF_MEMBER (email sintetic `@staff.navira.local`).
4. **Recenzii:** listare manage + reply (max 1000 caractere) → notificare `REVIEW` către client.
5. **Clienți (mini-CRM):** căutare, badge-uri VIP/no-show, `ClientSheet` (DraggableSheet 80%) cu note interne, blocare și progres de fidelitate (`PunchProgressSection`). Clientul blocat primește 403 la booking.
6. **Marketing hub:** două intrări — „Coduri de reducere" → `/(business)/discount-codes` și „Card de fidelitate" → `/(business)/punch-card` (vezi docurile dedicate).

## Reguli de business

- Salvări contextuale: fiecare ecran/secțiune își persistă propria felie — nu există un buton global de save.
- `staffIds` la servicii: lista trimisă devine sursa de adevăr (sync exact al junction-ului).
- Parola de staff nu poate fi recuperată — doar resetată (returnată din nou o singură dată).
- Note interne (`internalNotes`) invizibile clientului; blocarea e per (salon, client).
- Reply-ul de recenzie: doar ownerul salonului recenzat (asserted în service, nu prin `@Roles`).

## Securitate

- Toate operațiile de scriere verifică ownership-ul (`salon.adminId === user.id`) în service, dincolo de `@Roles`.
- Staff-ul nu vede tab-ul Clienți și nici setările salonului (StaffSettingsView restrâns).
- `passwordHash` nu părăsește API-ul; credențialele se emit doar de owner, salon-scoped.
- Cross-tenant guards: `assertStaffBelongToSalon` (servicii), `assertStaffInSalon` (programări).

## Fișiere cheie

- `apps/backend/src/modules/salons/salons.controller.ts`, `salons.service.ts`
- `apps/backend/src/modules/services/services.controller.ts`, `services.service.ts`
- `apps/backend/src/modules/staff/staff.controller.ts`, `staff.service.ts` (createCredentials/resetCredentials)
- `apps/backend/src/modules/client-profiles/client-profiles.controller.ts`, `client-profiles.service.ts`
- `apps/backend/src/modules/reviews/reviews.controller.ts`, `reviews.service.ts`
- `apps/mobile/src/screens/business/SettingsScreen.tsx`, `SalonSettingsScreen.tsx`, `SalonStaffScreen.tsx`, `ServicesScreen.tsx`, `ReviewsScreen.tsx`, `ClientsScreen.tsx`, `MarketingScreen.tsx`
- `apps/mobile/src/components/business/StaffCredentialsModal.tsx`, `ClientSheet.tsx`
