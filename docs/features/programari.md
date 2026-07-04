# Programări (Booking)

## Scop

Fluxul central al platformei: clientul rezervă un slot real (calculat din programul staff-ului), slotul e ținut temporar prin lock Redis, iar programarea trece printr-un ciclu de viață complet (PENDING → ... → COMPLETED), administrat din calendarul business cu drag&drop și walk-in.

## Arhitectură

**Modele Prisma:** `Appointment` (startAt/endAt, status, source, priceSnapshot + discountAmount, guestName/guestPhone, clientNotes/internalNotes, cancelledAt/By), `SlotLock` (model istoric — runtime-ul folosește Redis), `StaffSchedule`, `TimeOffBlock`, `DiscountRedemption`, `PunchRedemption`.

**Endpoint-uri:**
| Endpoint | Auth | Note |
|---|---|---|
| `GET /salons/:salonId/availability` | `@Public()` | serviceId, staffId?, date |
| `POST /salons/:salonId/slots/lock` | autentificat, **15/min** | `LockSlotDto` |
| `POST /salons/:salonId/slots/release` | autentificat | fără throttle |
| `POST /appointments` | autentificat, **5/min** | client sau business (walk-in) |
| `GET /appointments/me` | client | |
| `GET /salons/:salonId/appointments` | `@Roles(ADMIN_SALON, STAFF_MEMBER)` | staff → doar ale lui |
| `GET /salons/:salonId/analytics` | `@Roles(ADMIN_SALON, STAFF_MEMBER)` | staff → doar ale lui |
| `GET /appointments/:id` | client / admin / staff-ul asignat | |
| `PATCH /appointments/:id/reschedule` | admin / staff-ul asignat | |
| `PATCH /appointments/:id/status` | client / admin / staff-ul asignat | |

**Ecrane mobile:** `app/(client)/booking.tsx` → `BookingScreen` (4 pași), `booking-confirmed.tsx`, `bookings.tsx` (listă + PunchCardsStrip), `app/appointment-detail.tsx`; business: `app/(business)/index.tsx` → `CalendarScreen` (Timeline + WalkInModal), `AppointmentSheet` (DraggableSheet), `RescheduleModal`.

## Flow

### Booking client — `BookingScreen`, 4 pași (`['Serviciu','Specialist','Data & Ora','Confirmare']`)
1. **Serviciu** — serviciile salonului cu filtru pe categorii.
2. **Specialist** — „Orice specialist disponibil" (null) sau unul anume.
3. **Data & Ora** — bandă de 14 zile; sloturile vin din availability. **La atingerea unui slot** → `POST /slots/lock` cu `sessionId` (`bk-<ts>-<rand>`, per sesiune de app); pornește countdown-ul (banner „confirmă în MM:SS", roșu sub 60s). Guard `lockGenerationRef` contra răspunsurilor sosite dezordonat; la expirare → alertă + înapoi la pasul de sloturi; la unmount → release best-effort.
4. **Confirmare** — sumar + note + **cod de reducere** (validare live, sume calculate doar pe server); guard de reconciliere (lock-ul ținut trebuie să corespundă slotului afișat); `POST /appointments` → `booking-confirmed` (programează și un reminder local cu 1h înainte, expo-notifications).

### Availability (server)
Serviciu activ → staff-ul care îl prestează (`staffServices`) → per staff: `workSchedules` pe ziua cerută (skip dacă `isOff`), sloturi la **15 min** (`SLOT_INTERVAL_MIN`), candidat valid dacă `cursor + durationMin ≤ workEnd` și nu se suprapune cu time-off sau programări PENDING/CONFIRMED; apoi flag `isLocked` din Redis per slot. Timezone `Europe/Bucharest` (DST-aware); fereastră rezervabilă: grace 5 min în trecut, orizont 365 zile.

### Slot lock (Redis, advisory)
- Cheie `slotlock:{salonId}:{staffId}:{unixSeconds}`, valoare = sessionId; **`SET NX EX`** atomic, TTL = `salon.slotLockDurationMin * 60` (default 300s).
- Re-lock idempotent pentru aceeași sesiune; alt sessionId → **409**. Release prin script Lua atomic (doar ownerul șterge).
- **FAIL-OPEN**: dacă Redis e picat → warning + continuă fără lock. **Garda autoritară** e verificarea de suprapunere în DB, în tranzacție.

### Tranzacția de creare (ordine)
1. Overlap check autoritar (`startAt < endAt AND endAt > startAt`, status PENDING/CONFIRMED) → 409 „The selected slot is no longer available".
2. Dacă există `discountCode` → re-validare completă `assertRedeemable(tx, ...)` (invalid → respinge tot booking-ul).
3. Dacă NU e cod și e booking ONLINE de user înregistrat (fără guest fields) → eligibilitate loyalty `resolveEligibleReward(tx, ...)` (**codul câștigă**, fără stacking; read-ul e non-fatal).
4. Create cu `priceSnapshot = service.price`, `discountAmount` (cod sau punch), status PENDING.
5/6. Rânduri `DiscountRedemption` / `PunchRedemption` (audit + re-check cap sub row-lock).
După commit (non-fatal): upsert `ClientSalonProfile`, notificare `NEW_BOOKING` către owner, release lock.

### Reschedule
- Backend: doar PENDING/CONFIRMED; admin sau staff-ul asignat (staff nu poate reasigna altui staff); overlap re-check în tranzacție → 409; notificare `RESCHEDULED` către client.
- Mobile: **long-press + drag** în Timeline (snap la `SLOT_SNAP_MIN = 15`, timeline 08:00–20:00, 64px/oră), Alert de confirmare, update optimist cu revert la eroare (409 → „Slotul este ocupat. Alege altă oră."); plus `RescheduleModal` manual (bandă 14 zile + grilă de ore) din AppointmentSheet.

### Walk-in
`POST /appointments` cu `source: WALK_IN`, `guestName` (max 100), `guestPhone?` (max 30) — din `WalkInModal` (buton „+" sau tap pe slot gol, care preumple ora). Fără discount/loyalty (loyalty e doar pentru ONLINE înregistrat). Sesiunile de staff văd doar serviciile proprii.

## Reguli de business

**Tranziții de status** (backend `validateTransition` + mobile `utils/appointmentActions.ts`):
- `PENDING → CONFIRMED | REJECTED | CANCELLED`
- `CONFIRMED → COMPLETED | NO_SHOW | CANCELLED`
- `REJECTED / CANCELLED / COMPLETED / NO_SHOW` — terminale.

**Cine poate ce:** clientul → **doar CANCELLED** („Clients can only cancel appointments"); ownerul → orice tranziție validă; staff-ul → orice tranziție validă, dar **doar pe programările lui**. `COMPLETED`/`NO_SHOW` doar după `startAt` („Appointment has not started yet"). Clientul nu poate seta `internalNotes`. CANCELLED setează `cancelledAt`/`cancelledBy`.

**Flow REJECTED (nou în v0.3):** ownerul/staff-ul respinge o programare PENDING → notificare `BOOKING_REJECTED` („Programare respinsă") către client; în app: label „Respinsă" (roșu), în tab-ul trecut, cu buton „Rezervă din nou" în detaliu.

**Alte reguli:** client blocat în `ClientSalonProfile.isBlocked` → 403 la booking; `assertStaffInSalon` (guard cross-tenant); UI business: PENDING → Acceptă/Respinge/Anulează; CONFIRMED neînceput → doar Anulează; erori client mapate specific (400 discount inline, 401 auth, 403, 409 slot ocupat).

## Securitate

- Rate limits: create 5/min, lock 15/min (globalul 100/min pe restul).
- Autorizare pe fiecare rută: `assertSalonAccess` (owner sau staff activ al salonului), scoping staff pe listă + analytics, acces la detaliu doar pentru părțile implicate.
- TOCTOU rezolvat prin overlap check în tranzacție; sumele de discount nu vin niciodată de la client.
- Redis legat pe `127.0.0.1` + `requirepass`; lock-ul e doar UX, DB-ul e sursa de adevăr.

## Fișiere cheie

- `apps/backend/src/modules/appointments/appointments.controller.ts`, `appointments.service.ts`, `slot-lock.service.ts`
- `apps/mobile/src/screens/client/BookingScreen.tsx` (+ `.styles.ts`), `BookingConfirmedScreen.tsx`, `BookingsScreen.tsx`, `AppointmentDetailScreen.tsx`
- `apps/mobile/src/screens/business/CalendarScreen.tsx`, `components/business/calendar/Timeline.tsx`, `RescheduleModal.tsx`, `components/business/AppointmentSheet.tsx`
- `apps/mobile/src/utils/appointmentActions.ts`, `utils/bookingSlots.ts`, `services/api/bookings.ts`, `services/api/business.ts`
