# Rivo Mobile App - Component & Route Architecture

## 📂 Complete File Structure

```
apps/mobile/
├── src/
│   ├── app/
│   │   ├── _layout.tsx (Root layout with auth routing)
│   │   ├── index.tsx (Redirect)
│   │   ├── (auth)/
│   │   │   ├── _layout.tsx (Auth stack)
│   │   │   ├── index.tsx → LoginScreen
│   │   │   └── otp.tsx → OTPScreen
│   │   │
│   │   ├── (client)/
│   │   │   ├── _layout.tsx (Bottom tab navigator)
│   │   │   ├── index.tsx → HomeScreen
│   │   │   ├── bookings.tsx → BookingsScreen
│   │   │   ├── profile.tsx → ProfileScreen
│   │   │   ├── salon/
│   │   │   │   └── [id].tsx → SalonDetailScreen (DYNAMIC)
│   │   │   ├── booking-date-time.tsx → BookingDateTimeScreen (NEW)
│   │   │   └── booking-confirmed.tsx → BookingConfirmedScreen (NEW)
│   │   │
│   │   └── (business)/
│   │       └── _layout.tsx (Business stack - placeholder)
│   │
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   └── OTPScreen.tsx
│   │   │
│   │   └── client/
│   │       ├── HomeScreen.tsx
│   │       ├── BookingsScreen.tsx
│   │       ├── ProfileScreen.tsx
│   │       ├── SalonDetailScreen.tsx (NEW)
│   │       ├── BookingDateTimeScreen.tsx (NEW)
│   │       └── BookingConfirmedScreen.tsx (NEW)
│   │
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   └── SalonCard.tsx
│   │   ├── booking/
│   │   ├── calendar/
│   │   ├── review/
│   │   ├── salon/
│   │   └── staff/
│   │
│   ├── store/
│   │   ├── authStore.ts (Zustand - auth state)
│   │   ├── salonStore.ts (Zustand - salon data)
│   │   ├── hooks/
│   │   └── slices/
│   │
│   ├── services/
│   │   └── api/
│   │       ├── client.ts (API client)
│   │       ├── salons.ts (Mock salon data)
│   │       └── notifications/
│   │
│   ├── theme/
│   │   └── index.ts (Colors, spacing, typography)
│   │
│   ├── types/
│   │   └── index.ts
│   │
│   └── utils/
│
├── app.json (Expo config)
├── package.json
├── tsconfig.json
└── .env (EXPO_ROUTER_APP_ROOT=src/app)
```

---

## 🔄 Navigation Flow

### Authentication State → Route Rendering

```
App starts
    ↓
RootLayout (_layout.tsx)
    ↓
Check: isAuthenticated from authStore
    ├─ FALSE → Render (auth) group
    │   ├─ LoginScreen [default route]
    │   │   └─ "Login ca Client" button
    │   │       └─ devSignIn('CLIENT')
    │   │           └─ setIsAuthenticated(true)
    │   │               └─ Redirect to (client)
    │   └─ OTPScreen
    │
    └─ TRUE → Render (client) group
        └─ BottomTabNavigator (_layout.tsx)
            ├─ Tab 1: HomeScreen
            │   └─ Click salon card
            │       └─ router.push(`/salon/${id}`)
            │           └─ SalonDetailScreen [dynamic]
            │               └─ Click "Rezervă acum"
            │                   └─ router.push('/booking-date-time', params)
            │                       └─ BookingDateTimeScreen
            │                           └─ Click "Confirmă programarea"
            │                               └─ router.push('/booking-confirmed', params)
            │                                   └─ BookingConfirmedScreen
            │
            ├─ Tab 2: BookingsScreen
            │   └─ View user's bookings
            │
            └─ Tab 3: ProfileScreen
                └─ User info & logout
```

---

## 📱 Screen Hierarchy

### Screen Components (Detailed)

#### **1. LoginScreen**
```
LoginScreen
├── SafeAreaView
├── Logo/Title
├── Phone input field
├── Social login buttons (placeholders)
├── OTP info text
├── DEV MODE BUTTONS ⭐
│   ├── [Login ca Client] → devSignIn('CLIENT')
│   └─ [Login ca Salon] → devSignIn('ADMIN_SALON')
└── Forgot password link
```

#### **2. OTPScreen**
```
OTPScreen
├── SafeAreaView
├── Phone display
├── 6-digit OTP input boxes
├── Countdown timer
├── Verify button
└── Resend OTP
```

#### **3. HomeScreen** ⭐ MAIN SCREEN
```
HomeScreen
├── SafeAreaView
├── Header
│   ├── Greeting: "Bună, {firstName} 👋"
│   ├── Location: "București, Romania"
│   └─ Avatar button
├── SearchBar
├── PromoticBanner
│   ├── "-20% la prima programare!"
│   └─ "Rezervă acum" CTA
├── Categories (horizontal scroll)
│   ├─ ✨ Toate
│   ├─ 💇 Hair
│   ├─ 💅 Nails
│   ├─ 🤲 Masaj
│   ├─ 🧖 Facial
│   └─ ✂️ Barbershop
├── "Aproape de tine" Section (horizontal scroll)
│   └─ SalonCard × N [onPress → /salon/{id}]
└─ "Top recomandate" Section (vertical list)
    └─ SalonCard (horizontal variant) × N [onPress → /salon/{id}]
```

#### **4. SalonDetailScreen** ⭐ NEW
```
SalonDetailScreen
├── SafeAreaView
├── Header (overlay)
│   ├─ Back button
│   └─ Heart (favorite) button
├── Cover image (280px height)
├── Content (below image)
│   ├── Title card
│   │   ├─ Salon name
│   │   ├─ ⭐ Rating + review count
│   │   └─ Heart icon
│   │
│   ├── Contact card
│   │   ├─ 📍 Address
│   │   ├─ ☎️ Phone
│   │   └─ ✉️ Email
│   │
│   ├── About section
│   │   ├─ Title: "Despre salon"
│   │   └─ Description text
│   │
│   ├── Hours section
│   │   ├─ Mon-Fri: 09:00 - 20:00
│   │   ├─ Sat: 10:00 - 19:00
│   │   └─ Sun: Închis
│   │
│   ├── Services section
│   │   ├─ Title: "Servicii disponibile"
│   │   └─ ServiceCard × 6
│   │       ├─ Service name
│   │       ├─ Duration
│   │       ├─ Price
│   │       └─ [Tap to select - highlight in purple]
│   │
│   ├── Staff section
│   │   ├─ Title: "Echipa noastră"
│   │   └─ StaffCard × 3 (horizontal scroll)
│   │       ├─ Emoji avatar
│   │       ├─ Name
│   │       └─ Specialty
│   │
│   ├── Reviews section
│   │   ├─ Title: "Recenzii"
│   │   └─ ReviewCard × 2 (preview)
│   │       ├─ Name
│   │       ├─ ⭐ Rating
│   │       └─ Comment text
│   │
│   └── "Rezervă acum - {price} RON" button [primary]
│       └─ [onPress → /booking-date-time with params]
```

#### **5. BookingDateTimeScreen** ⭐ NEW
```
BookingDateTimeScreen
├── SafeAreaView
├── Header
│   ├─ Back button
│   ├─ "Programează" title
│   └─ (spacer)
│
├── Service summary card
│   ├─ Salon name
│   ├─ Service name
│   └─ Price
│
├── Date selection section
│   ├─ Title: "Alege data"
│   └─ DateChip × 7 (horizontal scroll)
│       ├─ Weekday abbr (MON, TUE, etc)
│       ├─ Day number
│       └─ [Tap to select - purple highlight]
│
├── Time selection section
│   ├─ Title: "Alege ora"
│   └─ TimeSlot × 8 (2-column grid)
│       ├─ Time (09:00, 10:00, etc)
│       └─ [Tap to select - purple highlight]
│
└── "Confirmă programarea" button [primary, full-width]
    └─ [onPress → /booking-confirmed with params]
        (date, time, service, salon name)
```

#### **6. BookingConfirmedScreen** ⭐ NEW
```
BookingConfirmedScreen
├── SafeAreaView
├── Success icon (green checkmark)
│
├── Titles
│   ├─ "Programare confirmată!"
│   └─ "Rezervarea ta a fost salvată cu succes"
│
├── Details card
│   ├─ Salon: {salonName}
│   ├─ Serviciu: {service}
│   ├─ Data: {date formatted}
│   ├─ Ora: {time}
│   └─ Cod rezervare: {bookingId}
│
├── Code box (highlighted)
│   ├─ "Codul tău de confirmare"
│   ├─ Confirmation code (monospace, large)
│   └─ "Salvează-l pentru check-in"
│
├── Reminder box (info alert)
│   ├─ ℹ️ Icon
│   └─ "Îți vom trimite o notificare cu 1 oră..."
│
└── Action buttons
    ├─ [Mergi la programări] → router.push('/(client)/bookings')
    └─ [Înapoi la acasă] → router.push('/(client)/index')
```

#### **7. BookingsScreen**
```
BookingsScreen
├── SafeAreaView
├── Tabs
│   ├─ "Upcoming" (Viitoare)
│   ├─ "Past" (Trecute)
│   └─ [Tap to switch]
│
└─ BookingCard × N
    ├─ Salon name & image
    ├─ Service name
    ├─ Date & time
    ├─ Status badge (Confirmed, Pending, Completed)
    ├─ Action buttons
    │   ├─ Reschedule
    │   ├─ Cancel
    │   └─ Complete
    └─ [Optional: Tap to view details]
```

#### **8. ProfileScreen**
```
ProfileScreen
├── SafeAreaView
├── User info card
│   ├─ Avatar (initials or icon)
│   ├─ Name: {firstName} {lastName}
│   ├─ Email
│   └─ Phone
│
├── Stats
│   ├─ Appointments: {count}
│   └─ Average rating: {rating}
│
├── Menu items
│   ├─ 📖 My Bookings
│   ├─ ❤️ Favorites
│   ├─ ⚙️ Settings
│   ├─ ℹ️ Help & Support
│   └─ [Tap to navigate]
│
└─ Logout button [outline, red text]
    └─ [onPress → signOut(), redirect to login]
```

---

## 🎨 Component Props

### SalonCard Props
```typescript
interface Props {
  salon: {
    id: string;
    name: string;
    coverImageUrl: string;
    city: string;
    addressLine1: string;
    averageRating: number;
    reviewCount: number;
    distanceKm?: number;
  };
  onPress: () => void;
  horizontal?: boolean;
}
```

### Button Props
```typescript
interface Props {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'danger';
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  loading?: boolean;
}
```

### Input Props
```typescript
interface Props {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  type?: 'text' | 'email' | 'phone' | 'password';
  error?: string;
  multiline?: boolean;
}
```

---

## 🔌 State Management (Zustand)

### authStore
```typescript
interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  setUser: (user: User) => void;
  devSignIn: (role: 'CLIENT' | 'ADMIN_SALON') => void;
  signOut: () => void;
}
```

### salonStore
```typescript
interface SalonState {
  salons: SalonCard[];
  setSalons: (salons: SalonCard[]) => void;
}
```

---

## 🎨 Theme System

```typescript
Colors = {
  primary: '#6C47FF',      // Purple (brand)
  primaryLight: '#EDE9FF',
  primaryDark: '#4A2FD4',
  accent: '#FF6584',       // Pink
  success: '#22C55E',      // Green
  warning: '#F59E0B',      // Orange
  error: '#EF4444',        // Red
  black: '#0F0F0F',
  gray900: '#1A1A2E',
  gray700: '#374151',
  gray500: '#6B7280',
  gray300: '#D1D5DB',
  gray100: '#F3F4F6',
  white: '#FFFFFF',
  background: '#F8F8FC',
  border: '#EBEBF0',
}

Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 }
Radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 }
FontSize = { xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24 }
FontWeight = { light: 300, medium: 500, semibold: 600, bold: 700 }
```

---

## 🔗 Route Parameters

### Salon Detail Route
```
Path: /salon/[id]
Params: { id: string }
Usage: router.push(`/salon/${salon.id}`)
```

### Booking Date/Time Route
```
Path: /booking-date-time
Params: {
  salonName: string;
  service: string;
  price: number;
  staffId?: string;
}
Usage: router.push('/booking-date-time', { salonName, service, price })
```

### Booking Confirmed Route
```
Path: /booking-confirmed
Params: {
  salonName: string;
  service: string;
  date: string (ISO);
  time: string (HH:mm);
}
Usage: router.push('/booking-confirmed', { salonName, service, date, time })
```

---

## ✅ Implementation Checklist

- [x] Root layout with conditional auth routing
- [x] Auth screens (login, OTP) with dev shortcuts
- [x] Home screen with salon browsing
- [x] Salon detail screen with services and staff
- [x] Date picker with 7-day calendar
- [x] Time slot selection with 8 available times
- [x] Booking confirmation with unique code
- [x] Navigation between all screens
- [x] Responsive UI design
- [x] Theme system applied
- [x] Mock data populated
- [x] No TypeScript errors
- [x] All imports resolved

---

## 🚀 Ready to Ship!

All components are properly structured, typed, and connected. The booking flow is complete and ready for:
1. Backend API integration
2. Real payment processing
3. Push notifications
4. Advanced business features
