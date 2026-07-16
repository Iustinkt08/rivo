# NAVIRA — Colaborare & strategia de repo-uri

Cum lucrează mai mulți dezvoltatori pe proiect, cum împărțim secretele și dacă merită un repo separat pentru website.

---

## 1. Situația actuală (important)

Proiectul e deja împărțit în **două repo-uri git**:

| Repo | Conține | Remote |
|---|---|---|
| **rivo** (root) | backend NestJS + docs + infra | `github.com/Iustinkt08/rivo` |
| **mobile** | aplicația Expo (`apps/mobile`) | `github.com/Iustinkt08/mobile` |

> `apps/mobile` este un **repo git separat, nested** (nu e înregistrat ca submodul — nu există `.gitmodules`). Practic: comenzile `git` rulate din root **nu văd** modificările din `apps/mobile`. Ca să comiți codul mobil intri în `apps/mobile` și faci commit/push acolo, către remote-ul lui.

```bash
# modificări în backend/docs → repo rivo
git add . && git commit -m "..." && git push

# modificări în app → repo mobile (SEPARAT)
cd apps/mobile
git add . && git commit -m "..." && git push
```

---

## 2. Cum adaugi pe altcineva la proiect

### Pas 1 — acces pe GitHub
Pentru **fiecare** repo la care trebuie să contribuie:

- GitHub → repo → **Settings → Collaborators → Add people** → username-ul lor.
- Sau, recomandat pe termen lung: mută repo-urile într-o **Organizație GitHub** (`NAVIRA`) și gestionează accesul prin **Teams** (mai ușor când sunt mai mulți oameni și mai multe repo-uri).

> Dacă lucrează doar pe app, are nevoie doar de repo-ul `mobile`. Dacă lucrează pe backend/website, are nevoie de `rivo` (și viitorul repo/folder de web).

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

Fișierele `.env` **NU sunt în git** (sunt în `.gitignore`) — și e corect așa. Deci un coleg nou **nu** primește secretele odată cu `git clone`. Opțiuni de partajare:

- **Recomandat:** un manager de secrete — **1Password**, **Doppler** sau **Infisical** — de unde fiecare dev trage `.env`-ul.
- Minim: trimite `.env`-ul printr-un canal **securizat** (nu pe email/chat public).
- Pentru CI/CD și producție: **GitHub Actions Secrets** + variabilele de mediu ale platformei de hosting (Vercel/Railway).
- **Niciodată** nu comite un `.env` real. Adaugă în schimb un `.env.example` (doar cheile, fără valori) ca documentație.

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

### Despre aplicația mobilă (`mobile`), care e deja repo separat
- Faptul că `mobile` e într-un repo separat **fragmentează** deja tipurile și face schimbările cross-cutting mai grele.
- **Opțional, pe viitor:** ia în calcul readucerea lui `apps/mobile` în monorepo (ca workspace real), ca app-ul, website-ul și backend-ul să împartă `shared-types`. Nu e urgent, dar simplifică mult pe termen lung.

### Rezumat decizie

| Scenariu | Recomandare |
|---|---|
| Echipa ta (aceiași oameni) construiește tot | **Monorepo** `rivo` → `apps/web` + `apps/web-admin` ✅ |
| Website făcut de o echipă externă, izolată | Repo separat, consumă backend-ul prin API |
| Mobile | E deja separat; ia în calcul consolidarea în monorepo pe termen lung |

---

## 5. Checklist rapid „un coleg nou intră în proiect"

- [ ] Invită-l pe GitHub la repo-urile necesare (`rivo` și/sau `mobile`)
- [ ] Trimite-i secretele prin canal securizat / manager de secrete
- [ ] Verifică că poate rula backend + app (vezi README)
- [ ] Stabiliți convenția de branch-uri + PR
- [ ] Activați branch protection pe `main`
