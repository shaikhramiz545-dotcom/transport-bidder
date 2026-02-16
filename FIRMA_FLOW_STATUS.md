# TBidder (Firma) – Flow ke hisaab se status

**Firma:** TBidder  
**Last update:** Flow check – kya ho gaya, kya reh gaya, next step kya le.  
**UI/UX:** Pura complete ho gaya (User app, Driver app, Control panel – screens, drawer, forms, tables, placeholders).

---

## 1. Kya ho gaya hai (Done)

### Backend (ek hi API sab ke liye)

| Item | Status |
|------|--------|
| **Auth** | `/api/auth/login`, `/api/auth/verify` – phone + OTP (mock 1234); users table (raw pg) |
| **Places** | `/api/places/autocomplete`, `/api/places/details` – Google proxy (CORS fix) |
| **Directions** | `/api/directions` – Google proxy (user/driver maps) |
| **Drivers** | `/api/drivers/location`, `/api/drivers/offline`, `/api/drivers/nearby`, `/api/drivers/requests` (pending rides DB se) |
| **Rides** | `POST /api/rides` (create), `GET /api/rides/:id`, chat, accept/counter/decline, driver-arrived, start-ride, complete, driver-location |
| **Admin** | `POST /api/admin/login`, `GET /api/admin/stats` (DB + online + pendingVerifications), `GET /api/admin/rides`, `GET /api/admin/rides/:id`, `POST /api/admin/dispatcher/ride`, `GET /api/admin/drivers`, `POST /api/admin/drivers/:id/verify`, `GET /api/admin/recharge-requests`, `GET /api/admin/agencies`, `GET/POST /api/admin/settings` |
| **Drivers** | `GET /api/drivers/verification-status?driverId=`, `POST /api/drivers/verification-register` (driver app verification) |
| **Health** | `/health`, `/api/health` |
| **DB** | User, Ride, Message, **DriverVerification** models; sync on start; server start even if DB fail (listen first) |
| **Dependencies** | axios, express, cors, pg, sequelize, socket.io, etc.; `npm install` fix |

### Control Panel (Admin – Firma)

| Item | Status |
|------|--------|
| **Config** | `admin_panel/src/config/firm.js` – FIRM_NAME, FIRM_ADMIN_TITLE, FIRM_FEATURES (sidebar + descriptions) |
| **Login** | admin@tbidder.com / admin123 → token |
| **Dashboard** | Stats cards – online drivers, today’s rides, pending, total (DB se) |
| **Bookings** | Rides list DB se; row click → ride detail + chat history |
| **Sidebar** | Dashboard, Bookings, Dispatcher, Verification Hub, Finance, Agencies, Settings (sab accessible) |
| **Dispatcher** | Form: pickup/drop address, lat/lng, distance, vehicle, price, user phone → **Create ride** (drivers ko requests mein dikhega) |
| **Verification Hub** | Table: drivers (DriverVerification); **Approve / Reject** buttons |
| **Finance** | Table: recharge requests (stub – empty); API ready |
| **Agencies** | Table: agencies (stub – empty); API ready |
| **Settings** | Form: commission %, notifications → **Save** (stub API) |

### User App

| Item | Status |
|------|--------|
| **Login** | Phone + OTP; “Skip for testing (Demo)” → Home |
| **Location** | Auto request, banner “Allow location”, pickup = current location, map tap = destination |
| **Map** | Peru (Lima), user emoji (👨/👩), driver 🚗, zoom/compass/toolbar off |
| **Drawer** | Profile, Wallet, History, Support, Logout – **sab open screens** (Profile, Wallet, History, Support pages) |
| **Booking flow** | Pickup/drop → Buscar Vehículo → vehicle → Reservar → bidding → Accept/Counter → thank-you, ETA, chat/call, OTP, start, complete |
| **Backend** | kApiBaseUrl (localhost / 10.0.2.2 / BACKEND_URL); places, directions, rides, drivers/nearby |

### Driver App

| Item | Status |
|------|--------|
| **Login** | Phone + OTP; “Skip for testing (Demo)” → Home |
| **Online/Offline** | Slider → driver on duty, location ping, map par 🚗 |
| **Drawer** | Earnings (in-drawer stats + PDF/Excel), Documents → Verification, Verification → Verification, Go Home → screen, Settings → screen, Logout |
| **Verification page** | Status **backend se** (GET verification-status); register on open (admin list mein dikhega); documents, vehicle, 360° placeholder; Driver/User features list |
| **Settings / Go Home** | Dedicated screens (accessible) |
| **Ride flow** | New request → Accept/Counter/Decline → pickup/drop, route, chat/call, OTP, start, slide to complete |
| **Firma config** | `lib/core/firm_config.dart` – kFirmName, kDriverAppTitle, kDriverFeatures, kUserAppFeatures |
| **Backend** | Same API; BACKEND_URL for physical device |

### Connection (Control panel ↔ Apps)

| Item | Status |
|------|--------|
| **Ek backend** | User app, Driver app, Control panel sab port 4000 use karte hain |
| **Rides in DB** | User app se create → Driver app se accept/complete → Control panel Bookings mein dikhte hain |
| **Stats** | Online drivers (driver app location), today’s/pending/total rides (DB) |

---

## 2. Kya reh gaya hai (Remaining / Optional polish)

### Control Panel (Firma)

| Page | Ab kya hai | Baad mein (optional) |
|------|------------|--------------------------|
| Dispatcher | **Complete** – form se ride create, drivers ko dikhega | Map picker for lat/lng |
| Verification Hub | **Complete** – drivers table, Approve/Reject | Document/360° view & upload |
| Finance | Table + API (stub empty) | Real recharge requests, approve → credit |
| Agencies | Table + API (stub empty) | Real agencies CRUD |
| Settings | Form + API (stub save) | Persist commission/notifications in DB |

### Driver App

| Item | Ab kya hai | Baad mein |
|------|------------|-----------|
| Verification | **Complete** – status from API, register on open | Real document/360° upload |
| Documents / Settings / Go Home | Screens accessible | Real data, home location save, notifications |

### User App

| Item | Ab kya hai | Baad mein |
|------|------------|-----------|
| Profile / Wallet / History / Support | Screens accessible, “Coming soon” on actions | Real profile edit, balance/recharge, past rides, help/contact |

### Backend

| Item | Ab kya hai | Baad mein |
|------|------------|-----------|
| Auth | Mock OTP 1234, raw `users` table | Real SMS OTP, optional Sequelize User sync |
| Driver verification | Nahi hai | API: document upload, 360° upload, admin approve/reject |
| DB | Aurora (PG) – agar unreachable to server still starts | Local PG for dev; Aurora for prod; migrations if needed |

### Testing

| Item | Status |
|------|--------|
| Phase 1 (Foundation) | Code-wise done; **end-to-end testing** (Chrome + Android) abhi 100% verify karna baaki ho sakta hai |
| Bugs | USER_APP_TESTING.md, DRIVER_APP_TESTING.md, CONTROL_PANEL_TESTING.md mein log karte raho |

---

## 3. Next step kya le (Recommendation)

**Option A – Phase 1 close karo (recommended)**  
1. **End-to-end test** – TESTING_STEPS.md follow karo: backend → user app → driver app → control panel.  
2. **Ek full ride flow** – User app se ride banao → Driver app se accept karo → complete karo → Control panel Bookings mein dikhao.  
3. Jo bug mile wo testing MD files mein likho, fix karo.  
4. Iske baad Phase 1 “100% verified” consider karo.

**Option B – Phase 2 shuru karo (Core Ride polish)**  
1. Real OTP (SMS) ya production-ready auth.  
2. Push notifications (new request driver ko, status user ko).  
3. Ride state machine clear (pending → accepted → driver_arrived → ride_started → completed) + validations.

**Option C – Control panel placeholders bharo**  
1. Dispatcher – manual ride create (form: pickup, drop, user phone, etc.).  
2. Verification Hub – driver list + document/360° view + Approve/Reject.  
3. Finance – recharge requests list + approve → credit balance.

**Short answer:**  
- **Kaha par kya ho gaya:** Upar wala “Done” section – backend, panel, user app, driver app, connection sab flow ke hisaab se ho chuka hai.  
- **Kya reh gaya:** Placeholder pages (Dispatcher, Verification Hub, Finance, Agencies, Settings), real driver verification (upload + approval), real Profile/Wallet/History/Support data, full E2E testing verify.  
- **Next step:** Pehle **Option A** (E2E test + ek full ride + bugs fix), phir tum Phase 2 ya Control panel placeholders mein se jo priority ho wo le lo.

---

## 4. Quick reference – Firma config kahan hai

| App | File | Kya change karna hai |
|-----|------|----------------------|
| Control panel | `admin_panel/src/config/firm.js` | FIRM_NAME, FIRM_FEATURES (sidebar, descriptions) |
| Driver app | `driver_app/lib/core/firm_config.dart` | kFirmName, kDriverAppTitle, kDriverFeatures, kUserAppFeatures |
| User app | (title “TBidder” hardcoded / drawer) | Agar Firma name central karna ho to ek config file add karo |

---

*Yeh doc flow ke hisaab se ek baar Firma check karke banaya gaya. Jab bhi bada change ho, isko update kar lena.*
