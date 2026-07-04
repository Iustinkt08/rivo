# Documentație per feature — NAVIRA v0.3

Fiecare doc urmează același framework: **Scop → Arhitectură → Flow → Reguli de business → Securitate → Fișiere cheie**. Toate afirmațiile sunt verificate pe codul din `apps/backend` (NestJS 11 + Prisma 7) și `apps/mobile` (Expo 54).

| Doc | Într-o frază |
|---|---|
| [autentificare.md](autentificare.md) | Auth dual-issuer: Supabase email/parolă (ES256/JWKS) pentru client+owner și conturi de staff cu JWT propriu HS256 `navira-staff`. |
| [programari.md](programari.md) | Booking în 4 pași cu slot-lock Redis (advisory, fail-open) și overlap guard autoritar în DB, plus ciclul complet de statusuri, reschedule drag&drop și walk-in. |
| [notificari.md](notificari.md) | 10 tipuri de notificări in-app persistate în DB, cu matrice de triggere și preferințe per user (8 toggles, NEW_BOOKING always-on). |
| [coduri-reducere.md](coduri-reducere.md) | Coduri promoționale per salon (PERCENT/FIXED) cu validare exclusiv server-side și redemption tranzacțional cu row-lock anti-race. |
| [card-fidelitate.md](card-fidelitate.md) | Punch card per salon: progres derivat server-side din vizite COMPLETED și auto-redeem la booking, fără stacking cu codurile. |
| [profil-staff.md](profil-staff.md) | Profil public de profesionist cu galerie pe categorii (upload prin proxy backend), 4 toggles de vizibilitate filtrate server-side și share deep link. |
| [administrare-salon.md](administrare-salon.md) | Settings hub-ul business: datele salonului, servicii cu staff-assignment, echipă + credențiale one-time, recenzii, mini-CRM clienți și Marketing. |
| [descoperire.md](descoperire.md) | Suprafața publică: geo-search Haversine, 21 categorii, profesioniști top, availability publică și hartă cu bottom sheet. |
| [design-system.md](design-system.md) | Tokens (gradient brand `#6C0000→#A22921→#EF6351`), componente comune (Button, GlassView, DraggableSheet, tab bars glass) și pattern-urile de UI. |
| [securitate.md](securitate.md) | Postura v0.3: guards globale, RLS deny-all, storage hardening, rate limits și tabelul auditului (9 constatări / 6 fixed) cu recomandările rămase. |
