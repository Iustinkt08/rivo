# Notificări

## Scop

Notificări **in-app** persistate în DB (fără push real încă): fiecare eveniment relevant din ciclul de viață al programărilor, recenziilor și serviciilor generează un rând `Notification`, vizibil cross-device, cu preferințe per user (8 toggles).

## Arhitectură

**Modele Prisma:** `Notification` (userId, title, body, `data` Json `{type, appointmentId?}`, isRead, sentAt; index `[userId, isRead]`) și `NotificationPreference` (userId unique + 8 booleeni, toți `@default(true)`). Tipurile NU sunt enum Prisma — string-union `NotificationType` în serviciu, oglindit în `store/notificationStore.ts` pe mobile.

**Cele 10 tipuri:** `NEW_BOOKING`, `BOOKING_ACCEPTED`, `BOOKING_REJECTED`, `CANCELLATION`, `RESCHEDULED`, `PRICE_CHANGE`, `DURATION_CHANGE`, `NO_SHOW`, `REVIEW`, `REMINDER`.

**Endpoint-uri:** `GET /notifications/me` (max 50, cele mai noi), `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`, `GET /notifications/preferences`, `PATCH /notifications/preferences` (partial, 8 booleeni opționali) — toate autentificate.

**Ecrane mobile:** client — `app/(client)/notifications.tsx` → `ClientNotificationsScreen` și `app/(client)/notification-settings.tsx` → `NotificationSettingsScreen` (din Settings); business — `app/notifications.tsx` → `NotificationsScreen` (din header-ul CalendarScreen).

## Flow

1. Un eveniment de business apelează `notify()` (mereu în try/catch — eșecul nu strică operația principală).
2. `notify()` mapează tipul la câmpul de preferință (`PREFERENCE_FIELD_BY_TYPE`); dacă userul a dezactivat toggle-ul → returnează `null`, nu scrie nimic. Tip fără câmp mapat sau user fără rând de preferințe → se trimite. Erori la citirea preferințelor → **fail-open** (se trimite).
3. Aplicațiile fac poll pe `GET /notifications/me`; badge de necitite din store (`unreadCount()`).
4. **Tap → appointment-detail live**: `handleNotifPress` marchează read (optimist + API), apoi dacă există `appointmentId` → `router.push('/appointment-detail', { id })` care refetch-uiește programarea.

### Matricea eveniment → tip → destinatar

| Eveniment | Tip | Destinatar | Emis din |
|---|---|---|---|
| Booking nou | `NEW_BOOKING` | owner (salon.adminId) | `appointments.service.create()` |
| Confirmare (→CONFIRMED) | `BOOKING_ACCEPTED` | client | `notifyStatusChange()` |
| Respingere (→REJECTED) | `BOOKING_REJECTED` | client | `notifyStatusChange()` |
| Anulare de salon | `CANCELLATION` | client | `notifyStatusChange()` |
| Anulare de client | `CANCELLATION` | owner | `updateStatus()` (ramura client) |
| No-show | `NO_SHOW` | client | `notifyStatusChange()` |
| Reschedule | `RESCHEDULED` | client | `reschedule()` |
| Recenzie nouă | `REVIEW` | owner | `reviews.service` create |
| Răspuns la recenzie | `REVIEW` | client | `reviews.service.reply()` |
| Schimbare preț serviciu | `PRICE_CHANGE` | fiecare client înregistrat cu programare viitoare PENDING/CONFIRMED pe serviciu | `services.service.notifyServiceChanges()` |
| Schimbare durată serviciu | `DURATION_CHANGE` | aceeași audiență | idem |

Fără notificare: tranziția →COMPLETED, redemption-urile de discount/loyalty. `REMINDER` **nu are emitter pe server** — există doar pentru reminderele locale programate de client (expo-notifications, 1h înainte de programare).

## Reguli de business

- **Preferințe (8 toggles, toate default true):** `onAccepted`, `onRejected`, `onCancelled`, `onRescheduled`, `onPriceChange`, `onDurationChange`, `onReview`, `onReminder`. `getPreferences` returnează defaults fără să creeze rând; `updatePreferences` face upsert.
- **Always-on (fără toggle):** `NEW_BOOKING` și `NO_SHOW` — critice pentru business, nu pot fi dezactivate.
- Ecranul de setări client face PATCH optimist per toggle, cu revert la eșec.
- `PRICE_CHANGE`/`DURATION_CHANGE` exclud guests (doar clienți cu cont).
- Mapping mobile (`utils/notificationMapping.ts`): tipuri necunoscute → coerce la `REMINDER`.

## Securitate

- Toate rutele cer Bearer token; fiecare user își vede doar propriile notificări (filtrare pe `userId` din token).
- **In-app only, confirmat**: zero cod de trimitere push (Expo/FCM) pe backend; modelul `PushToken` există în schemă dar e nefolosit. Notificările fiind rânduri DB, sunt vizibile cross-device la login.

## Fișiere cheie

- `apps/backend/src/modules/notifications/notifications.service.ts`, `notifications.controller.ts`, `dto/update-notification-preferences.dto.ts`
- Emitere: `apps/backend/src/modules/appointments/appointments.service.ts`, `modules/reviews/reviews.service.ts`, `modules/services/services.service.ts`
- `apps/mobile/src/screens/client/ClientNotificationsScreen.tsx`, `NotificationSettingsScreen.tsx`; `screens/business/NotificationsScreen.tsx`
- `apps/mobile/src/store/notificationStore.ts`, `services/api/notifications.ts`, `utils/notificationMapping.ts`
