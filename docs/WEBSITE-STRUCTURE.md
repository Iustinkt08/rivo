# NAVIRA — Structura Website + Abonamente + Hosting

> **Scop:** website-ul public NAVIRA (navira.ro) are trei roluri: (1) **marketing** — prezintă produsul și convertește saloane & clienți, (2) **SEO/descoperire** — pagini indexabile pe orașe/categorii/saloane care aduc trafic organic, (3) opțional **booking web** — clientul poate face programare direct din browser, nu doar din app.

Site-ul e **separat de aplicația mobilă**, dar **consumă același backend** (`apps/backend`). Recomandare stack: **Next.js (App Router) + TypeScript + Tailwind** — SSR/SSG pentru SEO, deploy pe Vercel.

---

## 1. Harta paginilor

### A. Marketing / produs (public)
- `/` — **Homepage**: propunere de valoare, căutare rapidă (oraș + serviciu), saloane recomandate, CTA „Descarcă aplicația" + „Ești salon? Începe gratuit"
- `/cum-functioneaza` — pentru clienți: descoperă → alege → programează
- `/pentru-saloane` — landing B2B: beneficii, calendar, marketing, **prețuri/abonamente**, testimoniale, CTA înregistrare
- `/preturi` — tabel comparativ planuri (vezi §3)
- `/descarca` — linkuri App Store / Google Play + QR
- `/blog` sau `/ghiduri` — conținut SEO (ex. „cele mai bune saloane din Cluj")
- `/despre`, `/contact`, `/cariere`

### B. Descoperire / SEO (public, indexabil — SSG/ISR)
- `/saloane` — listă/căutare generală
- `/saloane/[oras]` — ex. `/saloane/bucuresti` (pagini pe fiecare oraș)
- `/saloane/[oras]/[categorie]` — ex. `/saloane/bucuresti/frizerie`
- `/salon/[slug]` — **profil public salon**: galerie, servicii, echipă, program, recenzii, hartă + **buton „Programează"** (web booking)
- `/profesionist/[slug]` — profil public staff (există deja `ProfessionalsController` în backend)

### C. Booking web (opțional, dar recomandat — mărește conversia)
- Flux: alege serviciu → alege staff → vezi disponibilitate reală → alege slot (slot-lock Redis) → login/înregistrare → confirmare
- Reutilizează 100% endpoint-urile de `appointments` din backend (availability, lock, create)

### D. Cont client pe web (opțional)
- `/cont/programari`, `/cont/favorite`, `/cont/setari` — paritate parțială cu app-ul

### E. Legal & conformitate (obligatoriu pentru RO/UE)
- `/termeni` — Termeni și condiții
- `/confidentialitate` — Politica de confidențialitate (**GDPR**)
- `/cookies` — Politica de cookies + **banner de consimțământ**
- `/anpc` / SOL — linkuri obligatorii ANPC pentru comerț online în România
- Date firmă în footer (CUI, adresă) — cerință legală RO

---

## 2. Ce trebuie ANALIZAT / pregătit înainte de lansare

| Zonă | Necesar | Note |
|---|---|---|
| **Domeniu + SSL** | domeniu `.ro`, HTTPS | SSL automat pe Vercel |
| **SEO** | sitemap.xml, robots.txt, meta/OpenGraph, date structurate `LocalBusiness`/`Service` (schema.org), URL-uri clean cu slug | pagini pe oraș/categorie = motorul de trafic organic |
| **GDPR** | banner cookies, consimțământ, politici, DPA cu furnizorii | obligatoriu legal în UE |
| **Plăți** | **Stripe** (Billing pentru abonamente saloane; Checkout pentru booking cu avans) | dependența `stripe` există deja în backend |
| **Email tranzacțional** | confirmări programare, reset parolă, facturi | Resend / Postmark / SendGrid |
| **Analytics** | trafic + conversii | Vercel Analytics / Plausible (GDPR-friendly) / GA4 |
| **Push & notificări** | deja acoperit în app (`expo-notifications`, `firebase-admin`) | reutilizabil |
| **CDN imagini** | galerie saloane | Supabase Storage există deja (modulul `storage`) |
| **Monitorizare** | erori + uptime | Sentry + un uptime monitor |

---

## 3. Planuri de abonament pentru saloane

Modelul de business are **două pârghii de venit** care se pot combina:

### Model A — Abonament SaaS (recomandat ca bază, venit previzibil / MRR)

| Plan | Preț/lună (orientativ) | Ce include |
|---|---|---|
| **Free / Starter** | 0 lei | Listare în marketplace, profil de bază, calendar simplu, **limită de programări/lună**, 1 membru staff |
| **Pro** | ~99–149 lei | Programări nelimitate, echipă nelimitată, marketing (coduri reducere + card fidelitate — există deja), notificări, analytics de bază, galerie extinsă |
| **Premium** | ~249–349 lei | Tot din Pro + **poziționare prioritară în căutare**, badge „verificat/premium", multi-locație, analytics avansat, suport prioritar, comision redus/zero |

> Toate feature-urile de marketing (`discounts`, `loyalty`, `reviews`) există deja în backend — abonamentele **controlează accesul** la ele (feature gating), nu necesită cod nou de business, doar un layer de „entitlements".

### Model B — Comision pe tranzacție
- Un % din fiecare programare plătită online (ex. 5–10%). Se poate aplica peste planul Free ca alternativă la abonament.

### Model C — Promovări plătite („hot" / featured) — venit suplimentar
- **Listări promovate**: un salon plătește ca să apară sus în rezultate / pe homepage / „recomandat în [oraș]".
- Vândut ca add-on (ex. 199 lei/săptămână) sau inclus parțial în Premium.
- Gestionat din dashboard-ul admin (vezi [`ROADMAP-DASHBOARD-ADMIN.md`](ROADMAP-DASHBOARD-ADMIN.md#faza-4--monetizare-abonamente--comisioane)).

**Recomandare:** pornește cu **Free + Pro + Premium (Model A)** + **promovări „hot" (Model C)**. Comisionul (Model B) îl adaugi când ai volum de booking online.

---

## 4. Hosting & infrastructură — recomandare

| Componentă | Recomandare | De ce |
|---|---|---|
| **Website + admin (Next.js)** | **Vercel** | SSR/SSG/ISR pentru SEO, deploy din git, preview URLs, SSL automat, scalare zero-config |
| **Backend (NestJS)** | **Railway** / **Render** / **Fly.io** | container Node persistent (Vercel nu e ideal pentru NestJS long-running + WebSockets Socket.IO) |
| **Bază de date** | **Supabase Postgres** (deja folosit) | rămâne neschimbat |
| **Redis (slot locking)** | **Upstash Redis** | serverless, în producție înlocuiește docker-compose-ul local |
| **Storage imagini** | **Supabase Storage** (deja folosit) | modulul `storage` există |
| **Email** | Resend / Postmark | tranzacțional + campanii |
| **DNS + domeniu** | Cloudflare / registrar `.ro` | DNS + protecție de bază |
| **CI/CD** | GitHub Actions | teste + deploy automat la merge |
| **Erori/monitorizare** | Sentry + uptime monitor | vizibilitate în producție |

### Schiță de arhitectură în producție

```
                 ┌─────────────────┐
   Utilizatori → │ Vercel (Next.js)│  website public + /admin
                 │  SSR/SSG + SEO  │
                 └────────┬────────┘
                          │ HTTPS (REST)
                 ┌────────▼────────┐   ┌──────────────┐
   App mobilă  → │  NestJS backend │ → │ Supabase PG  │
   (Expo)        │ Railway/Render  │   └──────────────┘
                 │  + Socket.IO    │ → ┌──────────────┐
                 └────────┬────────┘   │ Upstash Redis│ (slot locks)
                          │            └──────────────┘
                 ┌────────▼────────┐   ┌──────────────┐
                 │ Supabase Storage│   │   Stripe     │ (abonamente)
                 └─────────────────┘   └──────────────┘
```

---

## 5. Ordine de implementare sugerată

1. **Marketing static** (`/`, `/pentru-saloane`, `/preturi`, legal) — lansabil rapid, aduce credibilitate.
2. **SEO/descoperire** (`/saloane/[oras]/[categorie]`, `/salon/[slug]`) — motorul de trafic organic.
3. **Booking web** — crește conversia; reutilizează backend-ul existent.
4. **Abonamente Stripe + promovări** — activează venitul (împreună cu dashboard-ul admin).
