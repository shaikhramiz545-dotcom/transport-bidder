# TBidder – Deep Diagnosis Report

**Date:** 31 Jan 2025  
**Purpose:** Har choti file ready hai ya nahi, errors kahan hain, flow ke hisaab se kitna % kaam ho chuka hai, aur live jane ke liye kitna kaam bacha hai – sab ek jagah.

---

## 1. Executive Summary

| Metric | Value |
|--------|--------|
| **Overall completion (by flow)** | **~62%** |
| **Live ke liye bacha hua (critical)** | **~38%** |
| **Critical errors (blockers)** | 4 |
| **Partial / stub features** | 8+ |

**Short answer:**  
- **Kaam ho chuka:** User app (map, booking, bidding, chat, driver track), Driver app (auth, requests, ride flow, chat, wallet UI), Admin (login, dashboard, bookings, dispatcher, verification, finance UI, settings, tours), Agency portal (signup, login, add tour, my tours), Backend (auth, rides, drivers, admin, tours, agency, wallet routes).  
- **Live se pehle zaroori:** DB connection fix, User app real login, Real OTP (SMS), Push notifications, Wallet/Finance end-to-end, Agencies CRUD (admin), Driver doc upload.  
- **Optional / baad mein:** Corporate portal, User registration, Map button hide (web).

---

## 2. Module-wise File Status (Choti se choti file)

### 2.1 Backend (`backend/`)

| File | Status | Notes / Errors |
|------|--------|----------------|
| `src/server.js` | ✅ Ready | Server + Socket.io; DB sync `alter: true` – DB unreachable pe bhi server chal jata hai |
| `src/app.js` | ✅ Ready | Routes mounted: health, auth, places, directions, drivers, rides, admin, tours, agency, wallet |
| `src/config/index.js` | ✅ Ready | PORT, pg, jwtSecret, mockOtp=1234 |
| `src/config/db.js` | ✅ Ready | Pool + Sequelize; 10s connectionTimeout; DB down pe query throw karta hai |
| `src/models.js` | ⚠️ Partial | **Error:** Sequelize `User` model **email/password** hai; auth **raw SQL** `users` (phone/role) use karta hai – **dono align nahi**. Migration mein `users` (UUID, phone); sync alag tables bana sakta hai |
| `src/routes/health.js` | ✅ Ready | DB-independent health |
| `src/routes/auth.routes.js` | ⚠️ Depends on DB | Phone+OTP login/verify; **DB down = 500**; **users** table chahiye (migration run honi chahiye) |
| `src/routes/places.proxy.js` | ✅ Ready | Google Places proxy |
| `src/routes/directions.js` | ✅ Ready | Directions; API key .env se |
| `src/routes/drivers.js` | ✅ Ready | Location, requests; in-memory + DB |
| `src/routes/rides.js` | ✅ Ready | Create, get, bid, accept, status, chat, driver-location (Sequelize Ride) |
| `src/routes/admin.routes.js` | ✅ Ready | Stats, rides, dispatcher, drivers verify, wallet-transactions, recharge-requests, **agencies stub** (empty array), tours, travel-agencies, settings, feature-flags |
| `src/routes/tours.js` | ✅ Ready | Public tours list |
| `src/routes/agency.routes.js` | ✅ Ready | Signup, login, tours CRUD (TravelAgency + Tour models) |
| `src/routes/wallet.routes.js` | ✅ Ready | Driver wallet, submit transaction |
| `migrations/001_initial_schema.sql` | ⚠️ Not auto-run | **Error:** Server sirf `sequelize.sync()` chalata hai; **migrations run nahi hoti**. Isliye `users` table (auth ke liye) create hone ke liye migration manually run karni padegi ya sync se pehle |
| `scripts/run-migrations.js` | ⚠️ No SSL | Manual run: `node scripts/run-migrations.js`. **RDS ke liye:** script mein Pool ko `ssl: { rejectUnauthorized: true }` add karna padega (db.js jaisa) |
| `.env.example` | ✅ Ready | PG_*, JWT_SECRET; NODE_ENV, PORT |

**Backend errors summary:**  
1. **DB connection:** RDS ETIMEDOUT – PG_HOST, security group, public access check karo.  
2. **Auth vs DB schema:** Auth `users` (phone, role) use karta hai; Sequelize `User` (email, name, password) – agar sirf sync chalao to `users` table nahi banti. **Fix:** Migration run karo (users, rides enum wala schema) YA auth ko Sequelize User se align mat karo; migration se `users` create karo.  
3. **Mock OTP:** Production ke liye real SMS gateway chahiye.

---

### 2.2 User App (`user_app/`)

| File | Status | Notes / Errors |
|------|--------|----------------|
| `lib/main.dart` | ✅ Ready | LoginScreen → home; locale load |
| `lib/features/auth/login_screen.dart` | ❌ Error | **Login button:** API call **nahi** – sirf validate karke direct Home open. **Create Account:** "Coming soon" snackbar. **TODO** comments maujood |
| `lib/features/auth/otp_screen.dart` | ⚠️ Missing | Backend abhi phone+OTP (driver); user app email/password dikhata hai – OTP screen user app mein hai hi nahi (agar phone login karo to chahiye) |
| `lib/features/home/home_screen.dart` | ✅ Ready | Map, pickup/drop, ride create, bidding, chat, driver location poll |
| `lib/features/history/history_screen.dart` | ✅ Ready | Placeholder / list |
| `lib/features/profile/profile_screen.dart` | ✅ Ready | Placeholder |
| `lib/features/support/support_screen.dart` | ✅ Ready | Placeholder |
| `lib/features/wallet/wallet_screen.dart` | ⚠️ Stub | Placeholder – balance/recharge backend se nahi |
| `lib/core/auth_api.dart` | ✅ Exists | (Agar use ho to login call wire karna hai) |
| `lib/core/api_config*.dart` | ✅ Ready | Base URL config |
| `lib/services/*.dart` | ✅ Ready | Bidding, directions, fare, location, places, backend_health |

**User app errors summary:**  
1. **Login:** _login() mein backend auth call missing – sirf `Navigator.pushReplacement(HomeScreen)`.  
2. **Create Account:** Registration flow nahi.  
3. **Wallet:** Screen hai, data backend se nahi (user wallet API agar hai to wire karna hai).

---

### 2.3 Driver App (`driver_app/`)

| File | Status | Notes / Errors |
|------|--------|----------------|
| `lib/main.dart` | ✅ Ready | Login / skip → home |
| `lib/features/auth/login_screen.dart` | ✅ Ready | Phone + API login (AuthApi.login), OTP screen navigate |
| `lib/features/auth/otp_screen.dart` | ✅ Ready | OTP verify API, token save, home |
| `lib/features/home/home_screen.dart` | ✅ Ready | Online/offline, requests, ride flow, chat |
| `lib/features/verification/verification_screen.dart` | ⚠️ Partial | UI hai; **document/360° upload + backend storage nahi** |
| `lib/features/wallet/wallet_screen.dart` | ✅ Ready | Balance, scratch card – API se |
| `lib/core/auth_api.dart` | ✅ Ready | login(), verify() backend call |
| `lib/core/firm_config.dart` | ✅ Ready | App title |
| `lib/services/*.dart` | ✅ Ready | Ride bid, location, earnings, wallet, notification (polling/sound) |

**Driver app errors summary:**  
1. **Auth:** DB unreachable hone par 500 – backend fix (DB + optional graceful message).  
2. **Verification:** Document upload + backend URL save + admin mein dikhana – pending.

---

### 2.4 Admin Panel (`admin_panel/`)

| File | Status | Notes / Errors |
|------|--------|----------------|
| `src/App.jsx` | ✅ Ready | Routes, Layout |
| `src/main.jsx` | ✅ Ready | - |
| `src/services/api.js` | ✅ Ready | baseURL: VITE_API_URL ya `/api`; proxy dev mein `/api` → 4000 |
| `vite.config.js` | ✅ Ready | proxy `/api` → http://localhost:4000 |
| `src/config/firm.js` | ✅ Ready | Feature labels, paths |
| `src/pages/Login.jsx` | ✅ Ready | Email/password → /api/admin/login, token save |
| `src/pages/Dashboard.jsx` | ✅ Ready | Stats, graph, live drivers map, vehicle filter |
| `src/pages/Bookings.jsx` | ✅ Ready | Rides list + detail |
| `src/pages/Dispatcher.jsx` | ✅ Ready | Manual ride create |
| `src/pages/VerificationHub.jsx` | ✅ Ready | GET /admin/drivers, verify; 404 handle |
| `src/pages/Finance.jsx` | ✅ Ready | recharge-requests, approve/decline/needs-pdf (wallet-transactions) |
| `src/pages/Agencies.jsx` | ✅ Ready | GET /admin/agencies – abhi stub se empty list; UI ready |
| `src/pages/Settings.jsx` | ✅ Ready | Commission, notifications persist |
| `src/pages/Tours.jsx` | ✅ Ready | Tours list (attractions) |
| `src/pages/TourDetail.jsx` | ✅ Ready | Tour detail, approve/reject/suspend |
| `src/components/Layout.jsx` | ✅ Ready | Sidebar, nav |
| `src/components/DriversMap.jsx` | ✅ Ready | Live drivers map |

**Admin panel errors summary:**  
- Koi critical code error nahi. **Agencies** backend se abhi `[]` aata hai – feature stub. Production mein agencies CRUD backend + frontend wire karna hoga.

---

### 2.5 Agency Portal (`agency_portal/`)

| File | Status | Notes / Errors |
|------|--------|----------------|
| `src/App.jsx` | ✅ Ready | Login, ProtectedRoute, Dashboard, MyTours, AddTour |
| `src/services/api.js` | ✅ Ready | baseURL `/api` ya VITE_API_URL; token `agency_token` |
| `vite.config.js` | ✅ Ready | proxy `/api` → 4000, port 5174 |
| `src/pages/Login.jsx` | ✅ Ready | Signup/Login – backend /api/agency/signup, /api/agency/login |
| `src/pages/Dashboard.jsx` | ✅ Ready | Placeholder / stats |
| `src/pages/MyTours.jsx` | ✅ Ready | GET /api/agency/tours |
| `src/pages/AddTour.jsx` | ✅ Ready | POST /api/agency/tours (paxOptions, slots) |
| `src/pages/TourDetail.jsx` | ✅ Ready | Detail + edit/delete agar API ho |
| `src/components/Layout.jsx` | ✅ Ready | Nav |

**Agency portal errors summary:**  
- Backend agency routes + TravelAgency/Tour models ready. Portal **ready** – sirf DB connect hona chahiye taaki signup/login/tours kaam karein.

---

### 2.6 Corporate Portal (`corporate_portal/`)

| File | Status | Notes / Errors |
|------|--------|----------------|
| (all) | ❌ Missing | Sirf `.gitkeep` – koi app nahi. Future module. |

---

## 3. Errors List (Ek jagah)

| # | Severity | Location | Error |
|---|----------|----------|--------|
| 1 | **Blocker** | Backend DB | RDS **ETIMEDOUT** – DB unreachable; auth, rides, admin sab fail |
| 2 | **Blocker** | Backend schema | **users** table auth ke liye chahiye; server sirf `sequelize.sync()` chalata hai – migration **auto-run nahi**. Sequelize User model alag (email); auth raw SQL `users` (phone). Either run migration manually ya sync se pehle `users` ensure karo |
| 3 | **Blocker** | User app | Login button pe **auth API call nahi** – sirf "Skip for testing" se hi home |
| 4 | High | Backend auth | Real **SMS OTP** nahi – mock 1234; production ke liye gateway chahiye |
| 5 | High | User/Driver | **Push notifications** nahi – sirf in-app polling/sound |
| 6 | Medium | Admin | **Agencies** GET /admin/agencies stub – empty array; CRUD baad mein |
| 7 | Medium | Driver app | **Verification:** document/360° upload + backend storage + admin view nahi |
| 8 | Medium | User app | **Wallet** screen placeholder – recharge/balance backend se nahi |
| 9 | Low | User app | **Create Account** – registration flow nahi |
| 10 | Low | Web map | Google Map zoom/compass/fullscreen buttons hide nahi (iframe limitation) |

---

## 4. Flow-wise Kitna % Kaam Ho Chuka Hai

| Flow | Done % | Done | Pending / Broken |
|------|--------|------|-------------------|
| **User: Open app → Map → Book ride** | 95% | Login skip, map, pickup/drop, ride create, bidding, accept, status, chat, driver location | User **real login** (API) |
| **User: Login / Register** | 25% | UI only; Skip se home | Login API call, Register flow |
| **User: Wallet** | 10% | Placeholder screen | Backend balance, recharge, history |
| **Driver: Login → Home → Requests → Ride** | 90% | Phone+OTP, requests, accept/counter, ride flow, chat, earnings | DB down pe 500; Push notifications |
| **Driver: Verification** | 50% | UI, admin approve/reject | Doc/360° upload + storage |
| **Driver: Wallet** | 85% | Balance, scratch, submit transaction; admin approve/decline | End-to-end test with DB |
| **Admin: Dashboard, Bookings, Dispatcher** | 95% | Stats, rides, manual ride, map | DB required |
| **Admin: Verification, Finance, Settings** | 90% | Drivers list verify, recharge approve/decline, settings persist | Finance data when DB + driver submissions |
| **Admin: Agencies** | 20% | Page + stub API | Backend CRUD + list |
| **Admin: Tours (Attractions)** | 95% | List, detail, approve/reject/suspend, travel-agencies | DB required |
| **Agency: Signup → Login → Add Tour** | 95% | Signup, login, add tour, my tours | DB required |
| **Backend: API + DB** | 75% | Sab routes; Sequelize models; auth raw SQL | DB connect; migration vs sync fix; real OTP |

**Overall (weighted by critical paths):**  
- **Ride flow (user + driver + admin):** ~90%  
- **Auth (driver ok, user skip only):** ~55%  
- **Wallet/Finance (driver + admin):** ~70%  
- **Tours/Agency:** ~90%  
- **Agencies (admin):** ~20%  

**Overall completion ≈ 62%. Live ke liye critical ≈ 38% (DB + user login + OTP + push + wallet/agencies/doc optional).**

---

## 5. Live Jane Ke Liye Kya Bacha Hai (Checklist)

### Must-have (blockers)

- [ ] **DB connection fix** – RDS security group, PG_HOST, PG_SSL; ya local Postgres. Migration run karo taaki `users` table ho (auth ke liye).
- [ ] **User app login** – Login button pe backend auth call (email/password YA phone+OTP – jo backend support kare); token save; phir home.
- [ ] **Auth schema align** – Ensure `users` table exist (migration 001 run) aur auth raw SQL usi table use kare; Sequelize sync se conflict na ho.

### Should-have (production-ready)

- [ ] **Real OTP (SMS)** – Mock 1234 ki jagah SMS gateway (Twilio, MSG91, etc.).
- [ ] **Push notifications** – Driver ko new request, user ko ride status (FCM/APNs).
- [ ] **Environment** – Production .env (JWT_SECRET, PG_*, API keys); NODE_ENV=production.

### Nice-to-have (post-MVP)

- [ ] **Wallet (user)** – Balance, recharge, history – backend + user app wire.
- [ ] **Admin Agencies** – CRUD backend + Agencies page list/form.
- [ ] **Driver verification** – Document/360° upload, storage (S3/local), admin view.
- [ ] **User registration** – Create Account flow.
- [ ] **Corporate portal** – Future.

---

## 6. File Count Summary

| Module | Total critical files | Ready | Partial/Stub | Error/Missing |
|--------|----------------------|------|--------------|----------------|
| Backend | 18 | 14 | 2 | 2 (migration not run, schema conflict) |
| User app | 15+ | 10 | 2 | 1 (login no API) |
| Driver app | 12+ | 10 | 1 (verification upload) | 0 |
| Admin panel | 16+ | 16 | 0 (Agencies stub backend) | 0 |
| Agency portal | 10+ | 10 | 0 | 0 |
| Corporate portal | - | 0 | 0 | 1 (empty) |

---

**Conclusion:**  
- **Har choti file** – list above; zyada tar **ready** hai, kuch **partial/stub** ya **schema/flow errors** hain.  
- **Flow hisaab se** – hum **~62%** kaam kar chuke hain; **live** ke liye **~38%** (mainly DB + user login + OTP + push + env).  
- **Errors** – 4 critical/blocker (DB, schema, user login, OTP); baaki medium/low aur post-MVP.

Agar tum chaho to next step mein sirf **blockers** (DB + user login + migration) par targeted fix suggest kar sakta hoon – file-by-file changes ke saath.
