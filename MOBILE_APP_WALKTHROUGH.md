# Rivo Mobile App - UI Walkthrough

## Getting Started

### 1. **Login Screen**
When you first open the app, you'll see the login screen with:
- Phone input field
- OTP verification flow
- Two DEV buttons for quick testing:
  - 🔘 **Login ca Client** - Use this to explore salons and book
  - 🔘 **Login ca Salon** - For business dashboard (coming soon)

After clicking "Login ca Client", you're automatically logged in and redirected to the **Home Screen**.

---

## Main Features (Client View)

### 2. **Home Screen** - Browse Salons
The main dashboard shows:

**Header Section:**
- Greeting: "Bună, Andrei 👋"
- Location: "București, Romania"
- Profile icon

**Search & Promo:**
- Search bar: "Caută salon, serviciu..."
- Banner: "-20% la prima programare!" (20% off first booking)

**Categories:**
Six quick filter chips:
- ✨ Toate (All)
- 💇 Hair
- 💅 Nails
- 🤲 Masaj
- 🧖 Facial
- ✂️ Barbershop

**Salon Lists:**
- **"Aproape de tine"** (Near You) - Horizontal scroll with salon cards
- **"Top recomandate"** (Top Rated) - Vertical list of best salons

Each salon card shows:
- Cover image
- ⭐ Rating (e.g., 4.8)
- Salon name
- Location
- Review count
- Distance in km

**→ Click any salon to view details**

---

### 3. **Salon Detail Screen** - View Services & Staff

After clicking a salon, you see:

**Top Section:**
- Large salon cover image
- Back button & heart (favorite) icon
- ⭐ Rating badge with review count
- "Studio Bella" (or salon name)

**Contact Section:**
- 📍 Location: Address
- ☎️ Phone: +40 722 123 456
- ✉️ Email: contact@studiobella.ro

**About Section:**
- Salon description
- Operating hours (Mon-Sun)

**Services Section:**
Browse 6 available services:
```
[✓ Selected]          [Not Selected]
Manicure              Pedicure
30 min                45 min
120 RON              150 RON
```

Services include:
- Manicure (120 RON)
- Pedicure (150 RON)
- Gel Manicure (180 RON)
- Gel Pedicure (200 RON)
- Nail Art (250 RON)
- Massage (120 RON)

**Staff Section:**
Scroll to see team members:
```
👩‍🦱          👩‍🦳          👩
Maria       Elena       Ioana
Manicure &  Gel &       Massage
Pedicure    Nail Art
```

**Reviews Preview:**
- Customer testimonials with ⭐ ratings
- "See all" link for full reviews

**Action Button:**
```
[Rezervă acum - 120 RON]  ← Shows selected service price
```

**→ Click "Rezervă acum" to proceed to booking**

---

### 4. **Booking Date/Time Screen** - Select Appointment

**Service Summary:**
```
Studio Bella
Manicure
120 RON
```

**Date Selection:**
7-day calendar picker (horizontal scroll):
```
[MON]  [TUE]  [WED*] [THU]  [FRI]  [SAT]  [SUN]
  15     16     17     18     19     20     21
        (Selected date highlighted in purple)
```

**Time Slots:**
8 available times in a 2-column grid:
```
[09:00]  [10:00]
[11:00]  [12:00]
[14:00]  [15:00]
[16:00]  [17:00]

(Selected time highlighted in purple)
```

**Action Button:**
```
[Confirmă programarea]
```

**→ Click "Confirmă programarea" to confirm**

---

### 5. **Booking Confirmed Screen** - Confirmation

Success page showing:

**Success Icon:**
✅ Large green checkmark

**Title:**
"Programare confirmată!"
"Rezervarea ta a fost salvată cu succes"

**Booking Details Card:**
```
┌─────────────────────┐
│ Salon:   Studio Bella
│ Serviciu: Manicure
│ Data:    Joi, 17 ianuarie
│ Ora:     14:00
│ Cod:     BK8F2K9XQ
└─────────────────────┘
```

**Confirmation Code Box:**
```
┌─────────────────────┐
│ Codul tău de confirmare
│ BK8F2K9XQ
│ Salvează-l pentru check-in
└─────────────────────┘
```

**Reminder:**
📢 "Îți vom trimite o notificare cu 1 oră înainte de programare"

**Action Buttons:**
```
[Mergi la programări]  ← View your bookings
[Înapoi la acasă]      ← Return to home
```

---

## Navigation Summary

```
Home Screen
    ↓ (Click salon card)
Salon Detail Screen
    ↓ (Select service + Click "Rezervă acum")
Booking Date/Time Screen
    ↓ (Select date & time + Click "Confirmă")
Booking Confirmed Screen
    ↓ (Click buttons to navigate)
    ├─→ Bookings Screen (view all reservations)
    └─→ Home Screen (browse more salons)
```

---

## Key UI Elements

### Buttons & States

**Active/Selected State:**
- Button or chip turns purple (primary color #6C47FF)
- Text color changes to white or purple
- Elevation/shadow effect

**Inactive State:**
- White background with gray border
- Gray or black text
- Subtle shadow

### Colors Used

| Element | Color | Hex |
|---------|-------|-----|
| Primary (Brand) | Purple | #6C47FF |
| Success | Green | #22C55E |
| Warning | Amber | #F59E0B |
| Error | Red | #EF4444 |
| Text | Black | #0F0F0F |
| Secondary Text | Gray | #6B7280 |
| Background | Light Gray | #F8F8FC |

### Spacing & Layout

- Header padding: 24px
- Card padding: 16px
- Gap between items: 8-24px
- Border radius: 12-16px for cards

---

## Testing the App

### Prerequisites
1. Have Expo Go installed on your phone (iOS/Android)
2. Mobile and computer on same WiFi network

### Steps

1. **Start the server:**
```bash
cd /Users/iustinciobotariu/rivo/apps/mobile
npm start
```

2. **Open on phone:**
   - iOS: Use Camera app to scan QR code → Opens in Expo Go
   - Android: Open Expo Go app → Scan QR code

3. **Test the flow:**
   - Tap "Login ca Client" → Instantly logged in
   - Tap any salon → View details
   - Select service → Tap "Rezervă acum"
   - Select date & time → Tap "Confirmă programarea"
   - View confirmation → Done! ✅

---

## Current Port

The app runs on **port 8082** after startup.

If you see "Port 8081 in use", it automatically switches to 8082.
