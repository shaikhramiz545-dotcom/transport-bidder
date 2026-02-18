# 🚀 TBIDDER (PERU)

**A Super App for Transport & Tourism in Peru**

---

## 📋 Overview

Tbidder is a premium transport and tourism platform connecting passengers with drivers through a **bidding engine**, pre-paid **wallet system**, and **tourism modules**. Built for the Peruvian market with support for Taxi, Moto, Freight, Ambulance, and Tours.

| Component | Stack |
|-----------|--------|
| **Mobile (Passenger)** | Flutter — User App |
| **Mobile (Partner)** | Flutter — Driver App |
| **Backend** | Node.js, Express, Socket.io |
| **Web Panels** | React.js |
| **Database** | PostgreSQL |

---

## 🎨 Visual Identity (Strict UI Rules)

| Element | Value |
|--------|--------|
| **Theme** | Premium High-Energy |
| **Primary Background** | Cream / Off-White `#F5F5DC` or `#FDFBF7` |
| **Accent / Action** | Neon Orange `#FF5F00` or `#FF4500` |
| **Driver App (Dark)** | BG `#1A1A1A`, Text/Buttons `#FF5F00` |
| **Typography** | **Poppins** (Clean & Modern) |

---

## 🏛️ Monorepo Structure

```
Tbidder_Project/
├── backend/           # Node.js + Express + Socket.io API
├── user_app/          # Flutter — Passenger app
├── driver_app/        # Flutter — Partner (driver) app
├── admin_panel/       # React — Super Admin
├── agency_portal/     # React — Fleet owners
├── corporate_portal/  # React — B2B clients
└── README.md          # This file
```

---

## 📌 Rules (Versioning + Update Log)

1. **Version bump is mandatory on any change**
   - **Flutter apps** (`user_app/`, `driver_app/`): update `pubspec.yaml` `version:`.
     - Bug fix: increment build number (`2.0.0+2` → `2.0.0+3`).
     - New feature: bump version (and build number) as needed.
   - **Web panels** (`admin_panel/`, `agency_portal/`, `corporate_portal/`): update `package.json` `version` when changes are made.

2. **Every fix/new feature must be logged**
   - Add a short entry file in `docs/updates/` so all updates can be checked in one place.
   - Naming: `docs/updates/YYYY-MM-DD-short-title.md`
   - Format/template: see `docs/updates/README.md`

---

## 🧠 Core Business Logic

1. **Bidding Engine**  
   User sets A→B + offered price → broadcast to drivers → driver Accepts or Counters.

2. **Wallet (Pre-paid)**  
   - Driver pays 100 Soles (cash) → Admin approves.  
   - System credits **92.5 Credits** (7.5% commission deducted upfront).  
   - **Ride deduction:** 1 Credit = 1 Sol of ride value.

3. **Tourism**  
   Tours booked via **dLocal Go** payment gateway.

---

## 📱 User App (Passenger)

- **Home Grid:** Taxi, Moto, Freight, Ambulance, Tours.
- **Booking:** Pickup/Drop (Google Maps), suggested price range.
- **Negotiation UI:** Tinder-style cards for driver bids (price, car, rating).
- **Live Ride:** OTP start, SOS (WhatsApp share), auto-translate chat (ES ↔ EN).
- **Special:** Freight “Helper” toggle, Tours “Travel Reels” + PEN/USD converter, Horoscope & Spin Wheel during wait.

---

## 🚘 Driver App (Partner)

- **Verification:** DNI, License, SOAT + 360° car video (30s compressed).
- **Wallet:** Balance, top-up (screenshot upload).
- **Job Feed:** High-contrast neon orange, custom siren for requests.
- **Tools:** Go Home filter, floating widget, in-app radio, walkie-talkie (Socket.io), daily scratch card (1–5 credits).

---

## 💻 Web Portals

- **Super Admin:** Dispatcher, Verification Hub, Finance (wallet approvals), Compliance (RUC, SOAT auto-block).
- **Agency Portal:** Fleet tracking, master wallet, credit transfer to drivers.
- **Corporate Portal:** Post-paid credit limit, guest booking, monthly invoices.

---

## 🛡️ Security & Anti-Fraud

- **Mock location blocker:** App blocks launch if Fake GPS is on.
- **Proximity check:** Block bid if user–driver distance &lt; 2 m (anti–self-booking).
- **Random selfie:** Identity check after random rides.
- **Device ban:** Auto-ban after 3 rapid cancellations.
- **Legal:** Libro de Reclamaciones, Privacy Policy (GDPR / Peru law).

---

## 💾 Database (PostgreSQL)

- **Users:** `phone`, `role`, `rating`, `device_id`
- **Drivers:** `wallet_balance`, `vehicle_video_url`, `agency_id`, `is_verified`
- **Agencies:** `master_wallet`, `commission_rate`
- **Companies:** `credit_limit`, `ruc_tax_id`
- **Rides:** `offered_price`, `final_price`, `status`, `otp`
- **Transactions:** `proof_image`, `type`, `amount`

---

## 🚦 Execution Plan

| Step | Task |
|------|------|
| **1** | ✅ Folder structure & README |
| **2** | Initialize Backend (Node.js) & PostgreSQL connection |
| **3** | ✅ Create database tables from schema |
| **4** | ✅ Flutter projects (User & Driver) with Cream/Orange theme |
| **5** | ✅ Auth module — Phone + OTP login (User & Driver), JWT verify |
| **6** | ✅ Maps & location — Google Maps, geolocator, User map + search + recenter, Driver map + Go Online |

---

## 🛠️ Getting Started

1. **Backend:** `cd backend` → `npm install` → `npm run migrate` → `npm run dev`  
2. **User App:** `cd user_app` → `flutter pub get` → `flutter run` (requires [Flutter SDK](https://docs.flutter.dev/get-started/install))  
3. **Driver App:** `cd driver_app` → `flutter pub get` → `flutter run` (requires Flutter SDK)  
4. **Admin Panel:** `cd admin_panel && npm install && npm start`  
5. **Agency Portal:** `cd agency_portal && npm install && npm start`  
6. **Corporate Portal:** `cd corporate_portal && npm install && npm start`  

**Auth (dev):** Mock OTP is `1234`. Android emulator uses `10.0.2.2` for host backend; ensure the API runs on the host and apps target the emulator.

*(Exact scripts may vary once each project is initialized.)*

---

## 📄 License & Compliance

- **Libro de Reclamaciones** and **Privacy Policy** (GDPR / Peru) will be integrated as per legal requirements.

---

**Tbidder** — *Transport & Tourism Super App for Peru* 🇵🇪
