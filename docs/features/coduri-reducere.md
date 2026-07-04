# Coduri de reducere (Discounts)

## Scop

Ownerul emite coduri promoționale per salon (procent sau sumă fixă), clientul le aplică la checkout; validarea și calculul sumelor se fac **exclusiv server-side**, iar redemption-ul se înregistrează în tranzacția de booking cu row-lock anti-race.

## Arhitectură

**Modele Prisma:** `DiscountCode` (code normalizat uppercase/trim, `type: PERCENT | FIXED`, value Decimal, validFrom/validUntil?, `maxRedemptions?` — null = nelimitat, `maxPerClient` default 1, isActive; **`@@unique([salonId, code])`**) și `DiscountRedemption` (codeId, `appointmentId @unique`, clientId, amountApplied).

**Endpoint-uri (bază `salons/:salonId/discount-codes`):**
| Endpoint | Roluri | Note |
|---|---|---|
| `POST /` | `ADMIN_SALON` | create (cod custom sau generat) |
| `GET /` | `ADMIN_SALON` | listă + `redemptionCount` |
| `PATCH /:id` | `ADMIN_SALON` | doar `isActive`, `validUntil`, `maxRedemptions`, `maxPerClient` |
| `DELETE /:id` | `ADMIN_SALON` | hard-delete dacă 0 redemptions, altfel soft-retire (`isActive=false`) |
| `POST /validate` | orice user autentificat, **10/min** | `{ code, serviceId }` → `{ discountAmount, finalPrice }` |

**Ecrane mobile:** Marketing hub → „Coduri de reducere" (`app/(business)/discount-codes.tsx` → `DiscountCodesScreen`), wizard `app/(business)/discount-code-new.tsx` → `DiscountCodeWizardScreen` (**2 pași**: „Detalii reducere" → „Verifică și generează", cu view de succes + copy); client: input de cod în pasul 4 (Confirmare) din `BookingScreen`.

## Flow

1. **Creare (owner):** wizard 2 pași; cod custom (regex `^[A-Z0-9-]{3,24}$`) sau generat automat: format `XXXX-XXXX` din alfabetul `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (fără caractere ambigue I/O/0/1), `crypto.randomInt`, până la 5 încercări pe unicitatea `(salonId, code)`.
2. **Checkout (client):** în SummaryStep clientul introduce codul → `POST /validate` → chip „−{amount} RON" cu `finalPrice` calculat pe server; schimbarea serviciului anulează codul aplicat.
3. **Booking:** `discountCode` merge în `POST /appointments`; în tranzacție se **re-rulează validarea completă** (`assertRedeemable(tx, ...)`) — preview-ul nu garantează nimic; apoi `recordRedemption(tx, ...)` scrie rândul de audit.
4. La 400 pe confirm, clientul vede inline „Codul de reducere nu mai este valabil." (lock-ul de slot supraviețuiește).

## Reguli de business (matricea de validare, mesaje verbatim)

1. Serviciul trebuie să existe în salon și să fie activ → „Serviciul nu a fost găsit pentru acest salon."
2. Cod inexistent sau **cross-salon** → „Codul de reducere nu există."
3. Inactiv → „Codul de reducere nu mai este activ."
4. `now < validFrom` → „Codul de reducere nu este încă valabil."
5. `now > validUntil` → „Codul de reducere a expirat."
6. Cap total atins (`count ≥ maxRedemptions`) → „Codul de reducere a atins numărul maxim de utilizări."
7. Limita per client (`count(codeId, clientId) ≥ maxPerClient`) → „Ai folosit deja acest cod de numărul maxim de ori."

Calcul sume (`computeDiscountAmounts`): PERCENT = `price * value / 100`, FIXED = `value`; ambele clamped `[0, price]`, rotunjite la 2 zecimale. PERCENT ≤ 100 la creare; fereastra `validUntil > validFrom`. **Nu există** minPrice sau restricții per serviciu. Fără stacking cu loyalty — codul câștigă (vezi `card-fidelitate.md`).

## Securitate

- Sumele nu vin **niciodată** de la client — se derivă din `service.price` pe server, atât la preview cât și la booking.
- **Anti-race (audit fix #1 HIGH):** `recordRedemption` face `tx.discountCode.update({ updatedAt })` — un UPDATE care ia **row-lock** pe rândul codului și serializează redemption-urile concurente; apoi re-verifică capurile cu `>` strict și face rollback dacă sunt depășite. `appointmentId @unique` previne rânduri duble.
- CRUD doar pentru ownerul salonului (`assertSalonOwner`); validate throttled 10/min.

## Fișiere cheie

- `apps/backend/src/modules/discounts/discounts.controller.ts`, `discounts.service.ts`
- `apps/backend/src/modules/appointments/appointments.service.ts` (redemption în tranzacția de create)
- `apps/mobile/src/screens/business/DiscountCodesScreen.tsx`, `DiscountCodeWizardScreen.tsx`, `MarketingScreen.tsx`
- `apps/mobile/src/screens/client/BookingScreen.tsx` (SummaryStep), `services/api/discounts.ts`
