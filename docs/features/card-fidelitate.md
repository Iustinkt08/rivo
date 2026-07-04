# Card de fidelitate (Loyalty / Punch Card)

## Scop

Program de fidelizare per salon: după **N vizite finalizate**, clientul primește automat o recompensă (procent sau sumă fixă) la următorul booking online. Progresul este **derivat server-side** — niciodată stocat sau scriibil de client.

## Arhitectură

**Modele Prisma:** `PunchCardConfig` (`salonId @unique` — o config per salon; `isActive` default false, `requiredVisits`, `rewardType: PERCENT | FIXED`, `rewardValue`) și `PunchRedemption` (salonId, clientId, `appointmentId @unique`, amountApplied, redeemedAt) — rândul de redemption e și audit, și reset de progres.

**Endpoint-uri:**
| Endpoint | Roluri |
|---|---|
| `PUT /salons/:salonId/punch-card` | `ADMIN_SALON` (owner) |
| `GET /salons/:salonId/punch-card` | `ADMIN_SALON`, `STAFF_MEMBER` |
| `GET /salons/:salonId/punch-card/clients/:clientId/progress` | `ADMIN_SALON`, `STAFF_MEMBER` |
| `GET /loyalty/punch-cards/me` | orice user autentificat |

**Ecrane mobile:** business — Marketing → „Card de fidelitate" (`app/(business)/punch-card.tsx` → `PunchCardScreen`) + progres per client în `ClientsScreen` (`PunchProgressSection` în ClientSheet); client — strip „Cardurile mele de fidelitate" (`PunchCardsStrip`) în capul ecranului Bookings.

## Flow

1. **Config (owner):** switch de activare, presets de vizite `[5, 8, 10]` + stepper custom clamped 2–50, tip recompensă PERCENT/FIXED + valoare, preview live → `PUT` upsert.
2. **Progres (derivat):** `countCompletedVisits` găsește ultimul `PunchRedemption` al clientului la salon, apoi numără programările `COMPLETED` cu `updatedAt > lastRedemption.redeemedAt` (se compară `updatedAt`, nu `startAt` — o programare devine COMPLETED printr-un update). `earned = completedVisits >= requiredVisits`.
3. **Auto-redeem la booking (în tranzacția de create):** dacă e eligibil, recompensa se aplică silențios — `discountAmount` pe programare + rând `PunchRedemption` (care resetează progresul). `getMyPunchCards` returnează progresul pentru fiecare salon cu config activă unde clientul are ≥1 programare.
4. **UI:** `PunchDots` vizualizează progresul; business vede „Recompensă disponibilă la următoarea programare" când e earned; clientul vede badge „Reducere activată".

## Reguli de business

- `requiredVisits` validat **2–50** (`@Min(2) @Max(50)` în DTO, clamp identic în UI); PERCENT ≤ 100; rewardValue > 0.
- Eligibil doar pentru **booking ONLINE de user înregistrat** (fără `guestName`/`guestPhone`) — walk-in/telefon nu „ștanțează" cardul.
- **No stacking:** dacă clientul aplică un cod de reducere, loyalty e sărit — **codul câștigă** (`if (!validatedDiscount && isRegisteredOnlineBooking)`).
- Config inactivă/absentă → progres `{active: false}`; strip-ul client și secțiunea din ClientSheet se ascund singure.
- Calculul sumei folosește același `computeDiscountAmounts` ca discounts (clamp `[0, price]`).

## Securitate

- Progresul nu e niciodată client-writable — derivat din date de pe server la fiecare citire.
- **Anti double-award (audit fix #6 MED, post-audit):** `resolveEligibleReward` ia un **row-lock raw** pe config (`SELECT id FROM punch_card_configs WHERE id = ... FOR UPDATE`) — două booking-uri paralele nu pot număra amândouă vizitele pre-redemption și acorda recompensa de două ori. `appointmentId @unique` pe redemption previne dublura la nivel de rând.
- Read-ul de eligibilitate e guarded (eșec = neeligibil, booking-ul continuă); `recordRedemption` e neguarded intenționat — eșecul face rollback la tot booking-ul.
- Config: doar ownerul scrie; owner + staff citesc progresul clienților salonului.

## Fișiere cheie

- `apps/backend/src/modules/loyalty/loyalty.controller.ts`, `loyalty.service.ts`, `dto/upsert-punch-card.dto.ts`
- `apps/backend/src/modules/appointments/appointments.service.ts` (auto-redeem în tranzacție)
- `apps/mobile/src/screens/business/PunchCardScreen.tsx`, `components/business/PunchProgressSection.tsx`
- `apps/mobile/src/components/client/PunchCardsStrip.tsx`, `components/common/PunchDots.tsx`, `services/api/loyalty.ts`
