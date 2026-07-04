# Design System

## Scop

Sursă unică de adevăr vizual pentru aplicația mobilă NAVIRA: tokens (culori, tipografie, spacing, radius, umbre), componente comune reutilizabile și pattern-uri de UI, astfel încât un rebrand sau redesign să schimbe valori, nu call site-uri.

## Arhitectură

- **Tokens**: `apps/mobile/src/theme/index.ts` — exportă `Colors`, `Gradients`, `Spacing`, `Radius`, `FontSize`, `FontWeight`, `Shadow`. Brand gradient: `#6C0000 → #A22921 → #EF6351`.
- **Componente comune**: `apps/mobile/src/components/common/` (Button, GlassView, GradientText, DraggableSheet, GlassTabBar, SkeletonCard etc.) + `components/business/SettingsHeader.tsx`.
- **Doar light mode** (`userInterfaceStyle: "light"`), font de sistem (fără typeface custom).

### Tokens (valori exacte)

**Colors — brand:**
| Token | Valoare | Utilizare |
|---|---|---|
| `primary` | `#A22921` | roșu cărămiziu, culoarea solidă principală |
| `primaryDark` | `#6C0000` | start de gradient, stare pressed |
| `primaryLight` | `#FCEAE6` | tint pentru chips active / fundal deschis |
| `coral` | `#EF6351` | capăt de gradient, accente |
| `accent` / `accentLight` | `#EF6351` / `#FDEBE7` | accente secundare |

**Colors — semantice și neutre:** success `#22C55E`, warning `#F59E0B`, error `#E5484D`, star `#FBBF24`; black `#141414`, ink/gray900 `#1A1A1A`, gray700 `#3A3A3A`, gray500 `#8A8A8A`, gray400 `#A8A8A8`, gray300 `#CBCBCB`, gray100 `#F2F2F2`, gray50 `#F8F8F8`; suprafețe: background `#FAFAFA`, card `#FFFFFF`, border `#ECECEC`, overlay `rgba(20,20,20,0.55)`.

**Gradients** (direcție diagonală `{x:0,y:0} → {x:1,y:1}`):
- `brand: ['#6C0000', '#A22921', '#EF6351']` — CTA-uri principale
- `brandSoft: ['#A22921', '#EF6351']`
- `brandDeep: ['#5A0000', '#8A1F18']`
- `GradientText` default: `['#6C0000', '#EF6351']` orizontal

**Scale numerice:**
- FontSize: xs 11, sm 13, md 15, lg 17, xl 20, xxl 26, xxxl 34; FontWeight: 400/500/600/700/800 (regular→heavy)
- Spacing: xs 4, sm 8, md 16, lg 24, xl 32, xxl 48
- Radius: sm 8, md 12, lg 16, xl 24, pill 40, full 999
- Shadow: `sm` (#000, opacity 0.06, radius 4), `md` (#000, 0.10, 12), `lg` (**glow roșu** `#A22921`, 0.22, 20), `brand` (glow roșu intens `#A22921`, offset {0,10}, opacity 0.28, radius 18) — sub butoanele primare

## Componente cheie

### Button (`components/common/Button.tsx`)
- Props: `title`, `variant: 'primary' | 'outline' | 'ghost'` (default primary), `size: 'sm' | 'md' | 'lg'`, `loading`, `fullWidth` + `TouchableOpacityProps`.
- `primary` = pill (`Radius.pill` 40) cu `LinearGradient Gradients.brand` + `Shadow.brand`; `outline` = bordură 1.5px `Colors.primary`; `ghost` = text primary. Text bold; disabled → opacity 0.45.

### GlassView (`components/common/GlassView.tsx`)
- BlurView (`intensity` default 60, tint light) + overlay alb translucid (opacity 0.8 Android / 0.14 iOS) + bordură hairline `rgba(255,255,255,0.6)` + umbră; `radius` default 37.

### DraggableSheet (`components/common/DraggableSheet.tsx`)
Bottom-sheet modal peste `@gorhom/bottom-sheet` (`BottomSheetModal`); cere `BottomSheetModalProvider` în root layout (`src/app/_layout.tsx`).
- **Ref API** (`DraggableSheetRef`): `present()`, `dismiss()`.
- **Props**: `children`, `snapPoints` (default `['80%']`), `enableDynamicSizing` (default false), `onDismiss`, `scrollable` (default false — `BottomSheetScrollView` vs `BottomSheetView`), `glass` (default false — fundal frosted vs card solid).
- Backdrop opacity 0.45, `pressBehavior="close"`, `enablePanDownToClose`, keyboard interactive/restore. Fundal solid: `Colors.card`, radius `Radius.xl`, `Shadow.md`, handle gray300.
- Utilizat de: `components/business/AppointmentSheet.tsx` și `ClientSheet.tsx` (80%, scrollable — deschise din CalendarScreen/ClientsScreen), `screens/business/StaffProfileScreen.tsx` (preview 90%).

### SettingsHeader (`components/business/SettingsHeader.tsx`)
- Props: `title`, `right?` (default spacer 38px). Buton back cerc 38×38 `gray50` cu chevron + titlu centrat `FontSize.lg` bold; bordură jos hairline `Colors.border`. Export `backToSettings(router)` — back cu fallback `replace('/(business)/settings')`.

### GlassTabBar / FloatingTabBar
- `components/common/GlassTabBar.tsx` — bară generică: `GlassView radius 37, intensity 30`, lățime 92% (max 415), înălțime 69; primește `tabs: { name, label, renderIcon }`.
- **Glass pill animat** care alunecă între tab-uri: spring `{damping: 20, stiffness: 220, mass: 0.85}`, capsulă radius 28 cu BlurView 55 + tint brand `rgba(162,41,33,0.1)`; suportă drag (pan gesture cu snap la slot).
- `components/client/FloatingTabBar.tsx` = wrapper cu `CLIENT_TABS` (iconițe **SVG** din `assets/icons/home/`); business (`app/(business)/_layout.tsx`) folosește `GlassTabBar` direct cu **Ionicons**. Activ = `Colors.primary`, inactiv = negru.

### SkeletonCard (`components/common/SkeletonCard.tsx`)
- `SkeletonCardVertical` / `SkeletonCardHorizontal`: forme `gray100` cu puls de opacitate 0.5→1→0.5 (800ms, native driver).

## Pattern-uri recurente

- **Hairline card border**: `rgba(216,216,216,0.8)` — constanta locală `SUBTLE_BORDER`, repetată în 10+ fișiere (BookingScreen.styles, ReviewsScreen, ClientSheet, AppointmentSheet, RescheduleModal, PunchProgressSection etc.). Pentru separatoare fine se folosește `Colors.border` + `StyleSheet.hairlineWidth`.
- **Chips de filtrare/categorii**: pill `Radius.full`, inactiv `gray50` + bordură `Colors.border`, activ `primaryLight` + bordură `primary` (text primary semibold); variantă „solidă" cu fundal `primary` + text alb (CalendarScreen, ServicesScreen, AnalyticsScreen); chip „adaugă" cu bordură dashed primary.
- **Pill CTA gradient**: `Button variant="primary"` sau inline `<LinearGradient colors={Gradients.brand}>` (~30 fișiere: ecrane auth, DiscountCodeWizard, Booking etc.).
- **Empty states**: container centrat, titlu `gray700` semibold + corp `gray500`, texte în română („Nicio recenzie încă", „Nicio programare azi").

## Reguli de business / limite cunoscute

- Ecranele mai vechi (Home, Booking) au încă valori hardcodate (radius 37/46, `SUBTLE_BORDER` local) în loc de tokens — drift acceptat, de consolidat treptat.
- Onboarding-ul business permite 9 gradienți de brand per salon (nu doar roșul NAVIRA).
- Fără dark mode și fără i18n — tot UI-ul e hardcodat în română, light mode.

## Fișiere cheie

- `apps/mobile/src/theme/index.ts` — toate tokens
- `apps/mobile/src/components/common/Button.tsx`, `GlassView.tsx`, `GradientText.tsx`, `DraggableSheet.tsx`, `GlassTabBar.tsx`, `SkeletonCard.tsx`
- `apps/mobile/src/components/client/FloatingTabBar.tsx`
- `apps/mobile/src/components/business/SettingsHeader.tsx`
- `apps/mobile/src/app/_layout.tsx` (BottomSheetModalProvider), `app/(client)/_layout.tsx`, `app/(business)/_layout.tsx`
