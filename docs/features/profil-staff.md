# Profil staff (public + editor)

## Scop

Fiecare membru al echipei are un profil public de profesionist (bio, socials, galerie foto pe categorii, număr de programări) pe care și-l editează singur sau prin owner; vizibilitatea fiecărei secțiuni e controlată prin 4 toggles, filtrate **server-side**.

## Arhitectură

**Modele Prisma:** `Staff` (specialty, bio, avatarEmoji/avatarUrl, `socials` Json, `publicSettings` Json, username/passwordHash pentru login), `StaffPhotoCategory` (name 1–40, sortOrder — categorii create de user, nu enum), `StaffPhoto` (url, caption ≤200, `categoryId` nullable — ON DELETE SET NULL).

**Endpoint-uri:**
| Endpoint | Roluri / Autorizare |
|---|---|
| `GET/PATCH /salons/:salonId/staff/:staffId/profile` | `ADMIN_SALON`, `STAFF_MEMBER` — self sau owner (`assertCanEditProfile`) |
| `POST /salons/:salonId/staff/:staffId/photos` (multipart) | idem (`assertCanManageGallery`) |
| `DELETE .../photos/:photoId` | idem |
| `GET/POST .../photo-categories`, `DELETE .../photo-categories/:categoryId` | idem |
| `GET /professionals`, `/professionals/top`, `/professionals/:id` | `@Public()` — filtrate după publicSettings |

**Ecrane mobile:** `app/(business)/staff-profile.tsx` → `StaffProfileScreen` („Profilul meu": editor + galerie + toggles + preview); client: `app/(client)/professional/[id].tsx` → `ProfessionalProfileScreen` (randează `ProfessionalProfileContent` — același component folosit și în preview-ul editorului).

## Flow

1. **Editare profil:** `PATCH .../profile` cu **whitelist strict de câmpuri**: firstName/lastName (1–60), specialty (≤60), bio (≤500), phone (≤30), email (≤120), avatarEmoji (≤16), `socials` (instagram/facebook/tiktok/website — normalizate la https), `publicSettings`. String gol curăță câmpurile opționale; publicSettings se merge peste cele stocate. **Nu atinge niciodată** username/passwordHash/isActive/salonId.
2. **Galerie:** upload prin **proxy backend** — multipart către NestJS, care scrie în bucket-ul Supabase `staff-gallery` cu `SUPABASE_SERVICE_ROLE_KEY` (bucket public-read, **fără politici de scriere client-side**); path `{staffId}/{uuid}.{ext}`; cleanup de orfani dacă insert-ul DB eșuează. Delete: DB e sursa de adevăr, ștergerea din storage e best-effort. Categoriile sunt slideshows pe profilul public; ștergerea unei categorii păstrează pozele (necategorisite).
3. **Vizibilitate publică:** profilul public omite **complet** câmpurile ascunse (nu le trimite goale): `socials` (showSocials), phone+email (showContact), `completedAppointmentsCount` (showApptCount), `galleryCategories` (showGallery). `toPublicStaff` scoate în plus username/userId/publicSettings/passwordHash din orice listare publică.
4. **Preview:** buton în editor → `DraggableSheet` 90% cu `ProfessionalProfileContent` hrănit din API-ul public (exact ce vede clientul).
5. **Share:** deep link `navira://professional/{id}` (`utils/professionalShare.ts`, schema `navira` din app.json) prin RN Share — „Descoperă profilul lui {name} pe NAVIRA: {url}".

## Reguli de business

- Toggles + defaults: `showSocials: true`, `showContact: false`, `showApptCount: false`, `showGallery: true` (`DEFAULT_PUBLIC_VISIBILITY`).
- Poze: max **5 MB**, doar JPEG/PNG/WebP validate prin **magic numbers** (FileTypeValidator), fără limită de număr.
- În listările publice apar doar staff `isActive: true`; ascunderea e per-câmp, nu per-profil; `appointmentCount` e null când e ascuns (inclusiv în /top și /search).

## Securitate

- **Audit fix #2 HIGH:** galeria publică era nefiltrată — acum endpoint-urile de management au `@Roles` + assert, iar expunerea publică trece prin filtrarea `publicSettings` server-side.
- `assertCanEditProfile` / `assertCanManageGallery`: staff-ul însuși (`staff.userId === user.id`; sub-ul JWT-ului de staff = `Staff.userId`) sau ownerul (`salon.adminId === user.id`); staff-ul trebuie să aparțină de `:salonId` (guard cross-tenant).
- **Scoping staff** (calendar + analytics): `assertSalonAccess` returnează `callerStaff`; `findForSalon` forțează `where.staffId = callerStaff.id`, `getAnalytics` la fel — staff-ul nu vede niciodată veniturile întregului salon; `findOne` restricționat la programarea proprie.
- StorageService nu face verificări de ownership — autorizarea stă în consumator (`staff-gallery.service.ts`), înainte de orice operație.

## Fișiere cheie

- `apps/backend/src/modules/staff/staff.controller.ts`, `staff.service.ts`, `staff-gallery.controller.ts`, `staff-gallery.service.ts`, `staff-profile.utils.ts`, `professionals.controller.ts`
- `apps/backend/src/modules/staff/dto/update-staff-profile.dto.ts`, `dto/staff-gallery.dto.ts`
- `apps/backend/src/modules/storage/storage.service.ts`
- `apps/mobile/src/screens/business/StaffProfileScreen.tsx`, `screens/client/ProfessionalProfileScreen.tsx`
- `apps/mobile/src/components/client/ProfessionalProfileContent.tsx`, `utils/professionalShare.ts`, `services/api/staffGallery.ts`
