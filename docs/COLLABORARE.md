# NAVIRA — Colaborare & strategia de repo-uri

Cum lucrează mai mulți dezvoltatori pe proiect, cum împărțim secretele și dacă merită un repo separat pentru website.

---

## 1. Situația actuală

Tot proiectul e într-un **singur repo git**:

| Repo | Conține | Remote |
|---|---|---|
| **rivo** (root) | backend NestJS + aplicația Expo + docs + infra + `.env` | `github.com/Iustinkt08/rivo` |

Un singur `git clone` aduce tot, iar comenzile `git` din root acoperă și backend-ul, și aplicația mobilă:

```bash
git add . && git commit -m "..." && git push
```

> **Istoric:** până în iulie 2026, `apps/mobile` a fost un repo git separat, nested (`github.com/Iustinkt08/mobile`), înregistrat în `rivo` ca pointer de submodul fără `.gitmodules` — ceea ce însemna că cine clona `rivo` primea un folder `apps/mobile` **gol**. A fost consolidat în monorepo. Repo-ul vechi `mobile` nu mai e folosit; istoricul lui rămâne pe GitHub, dar sursa de adevăr e `rivo`.

---

## 2. Cum adaugi pe altcineva la proiect

### Pas 1 — acces pe GitHub
Un singur repo, deci un singur acces de dat:

- GitHub → `Iustinkt08/rivo` → **Settings → Collaborators → Add people** → username-ul lor.
- Sau, recomandat pe termen lung: mută repo-ul într-o **Organizație GitHub** (`NAVIRA`) și gestionează accesul prin **Teams** (mai ușor când sunt mai mulți oameni).

> Doar contul proprietar (`Iustinkt08`) poate adăuga colaboratori sau schimba vizibilitatea repo-ului.

### Pas 2 — onboarding local
Colegul rulează:

```bash
git clone https://github.com/Iustinkt08/rivo.git
cd rivo
npm install
# + fișierele .env (vezi §3)
```

Restul pașilor sunt în [`README.md`](../README.md).

### Pas 3 — workflow pe branch-uri (obligatoriu când sunteți mai mulți)
- **Nu** comiteți direct pe `main`. Fiecare feature pe branch propriu:
  ```bash
  git checkout -b feat/nume-feature
  # lucrezi, comiți
  git push -u origin feat/nume-feature
  ```
- Deschideți **Pull Request** → review → merge în `main`.
- Activați **branch protection** pe `main` (Settings → Branches): PR obligatoriu, minim 1 review, CI verde.
- Convenție de commit: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:` (vezi `.claude/rules/common/git-workflow.md`).

---

## 3. Partajarea secretelor

**Starea curentă:** fișierele `.env` **SUNT în git**, prin decizie explicită a proprietarului proiectului. Un coleg nou primește toată configurația odată cu `git clone` — nu trebuie schimb manual de credențiale.

Ce înseamnă asta în practică:

- Cheile sunt vizibile **oricui are acces la repo** și rămân **permanent în istoricul git** (ștergerea lor într-un commit ulterior nu le scoate din istoric).
- Dacă repo-ul e **public**, cheile sunt expuse pe internet și colectate automat de scannere în câteva minute.
- Lista completă a cheilor sensibile și unde se rotește fiecare: [`README.md` → Secrete și acces](../README.md#secrete-și-acces).

**Când revii la practica standard** (recomandat înainte de producție sau de creșterea echipei):

- Scoate comentariile pentru `.env` din `.gitignore`, rulează `git rm --cached` pe fișiere și **rotește toate cheile** — altfel cele vechi rămân valide în istoric.
- Folosește un manager de secrete — **1Password**, **Doppler** sau **Infisical** — de unde fiecare dev trage `.env`-ul.
- Pentru CI/CD și producție: **GitHub Actions Secrets** + variabilele de mediu ale platformei de hosting (Vercel/Railway).
- Ține un `.env.example` (doar cheile, fără valori) ca documentație.

---

## 4. Repo separat pentru website? — Recomandare

**Întrebarea:** facem un repo/proiect nou pe GitHub pentru website, dacă vrem să integrăm și funcțiile de programare + aplicația în el?

### Recomandarea mea: **NU repo separat — adaugă website-ul în monorepo-ul `rivo`** ca `apps/web` (public) și `apps/web-admin` (dashboard).

**De ce în monorepo:**
- Website-ul + dashboard-ul **consumă același backend** (`apps/backend`). Într-un monorepo poți schimba un endpoint și clientul web **în același PR**, atomic — contractul nu se rupe niciodată între repo-uri.
- Reutilizezi **`packages/shared-types`** (tipurile API) și, eventual, `packages/ui-kit` — fără să publici pachete npm private ca să le partajezi.
- Un singur `npm install`, un singur CI, un singur loc de review.
- Backend-ul e deja aici; e locul natural pentru „funcțiile de programare" pe web (reutilizezi modulul `appointments`).

```
rivo/
├── apps/
│   ├── backend/      # există
│   ├── web/          # NOU — website public + booking web (Next.js)
│   └── web-admin/    # NOU — CRM/dashboard echipă NAVIRA (Next.js)
└── packages/
    ├── shared-types/ # tipuri API partajate între web, admin, backend
    └── ui-kit/
```

**Când AR avea sens un repo separat pentru website:**
- Îl construiește o **echipă/agenție complet separată**, căreia nu vrei să-i dai acces la backend.
- Vrei cicluri de release și permisiuni total independente.
- În acest caz, backend-ul rămâne „API public" și website-ul îl consumă doar prin HTTP (fără tipuri partajate) — mai multă libertate, dar mai multă muncă de sincronizare a contractului.

### Despre aplicația mobilă — consolidată în monorepo ✅
- `apps/mobile` era într-un repo separat, ceea ce fragmenta tipurile și îngreuna schimbările cross-cutting. A fost adus înapoi în monorepo ca workspace real.
- Efect: app-ul, website-ul (viitor) și backend-ul pot împărți `shared-types`, iar un endpoint și clienții lui se schimbă în același PR, atomic.

### Rezumat decizie

| Scenariu | Recomandare |
|---|---|
| Echipa ta (aceiași oameni) construiește tot | **Monorepo** `rivo` → `apps/web` + `apps/web-admin` ✅ |
| Website făcut de o echipă externă, izolată | Repo separat, consumă backend-ul prin API |
| Mobile | Consolidat în monorepo (`apps/mobile`) ✅ |

---

## 5. Checklist rapid „un coleg nou intră în proiect"

- [ ] Invită-l pe GitHub la repo-ul `Iustinkt08/rivo` (Settings → Collaborators)
- [ ] Secretele vin odată cu `git clone` (`.env` sunt în repo) — vezi §3 pentru implicații
- [ ] Verifică că poate rula backend + app (vezi README)
- [ ] Stabiliți convenția de branch-uri + PR
- [ ] Activați branch protection pe `main`
