# TBidder (TransportBidder) – Full Project Audit Report

**Audit date:** Project scan ke hisaab se  
**Audience:** Non-technical founder (Hinglish)

---

## 1. Kaun se core features abhi sahi kaam kar rahe hain?

| Feature | Kahan | Status |
|--------|--------|--------|
| **User app open + map** | User app (Flutter) | Login skip → Home; map Lima (Peru) load; cream/orange theme. |
| **Pickup / Destination set** | User app – Home | "Your current location" + "Select on map" + search se A/B set ho jata hai. |
| **Ride create (booking)** | User app → Backend | Buscar Vehículo → vehicle → Reservar → `POST /api/rides` se ride DB mein create. |
| **Driver app open + map** | Driver app (Flutter) | Login (phone + OTP) ya skip → Home; online/offline slider; dark theme. |
| **Driver location ping** | Driver app → Backend | Online hone par `POST /api/drivers/location` se location update; in-memory map mein store. |
| **Driver ko ride requests** | Backend → Driver app | `GET /api/drivers/requests` se pending rides list; driver Accept / Counter / Decline. |
| **User ko bid accept / counter** | User app + Backend | Accept bid → `POST /api/rides/:id/accept-bid`; counter flow backend se. |
| **Ride status flow** | Backend | driver-arrived → start-ride → complete; state validation hai (galat order pe reject). |
| **Chat (ride ke andar)** | User + Driver app | `POST /api/rides/:id/chat` se message save; ride detail mein messages dikhte hain. |
| **Driver live location (ride ke dauran)** | Backend + User app | Driver `POST /api/rides/:id/driver-location` bhejta hai; user `GET /api/rides/:id/driver-location` se poll karta hai. |
| **Admin panel login** | Admin panel | Email/password (admin@tbidder.com / admin123); JWT; Dashboard, Bookings, Dispatcher, Verification Hub, Finance, Agencies, Settings. |
| **Admin: stats, bookings, dispatcher** | Admin panel + Backend | Stats DB se; Bookings list + detail; Dispatcher se manual ride create. |
| **Admin: Verification Hub** | Admin panel + Backend | Drivers list (DriverVerification); Approve/Reject. |
| **Admin: Settings persist** | Admin panel + Backend | Commission %, notifications – DB (AdminSettings) mein save. |
| **Places autocomplete** | Backend proxy | `GET /api/places/autocomplete` – Google Places (key env ya fallback). |
| **Directions** | Backend | `GET /api/directions` – key `.env` mein honi chahiye (nahi to 503). |
| **Language switch** | User + Driver app | Globe icon – EN, ES, RU, FR (user); EN, ES (driver). |
| **Logo + branding** | User, Driver, Admin | TransportBidder logo + text sahi jagah (login, drawer, sidebar); contrast theek. |

---

## 2. Kaun se features partially implement hain ya buggy/unstable?

| Feature | Kya issue hai | Responsible files / module |
|--------|----------------|----------------------------|
| **User app login** | Email/password form hai lekin **backend call nahi** – sirf "Skip for testing (Demo)" se home open hota hai. Real auth flow (API call) implement nahi. | `user_app/lib/features/auth/login_screen.dart` (TODO: call auth API) |
| **Driver app auth** | Phone + OTP backend se call hota hai (**/api/auth/login**, **/api/auth/verify**). **DB unreachable** hone par 500/error – driver login fail. | `driver_app/lib/features/auth/login_screen.dart`, `backend/src/routes/auth.routes.js`, DB `users` table |
| **Database connection** | **RDS (AWS) ETIMEDOUT** – backend start ho jata hai lekin DB sync fail; auth, rides, admin stats sab DB pe depend karte hain. Local PG se connect karo ya RDS security group + public access fix karo. | `backend/src/config/db.js`, `backend/src/server.js`, `.env` (PG_*) |
| **Auth backend** | Auth **raw SQL** use karta hai (`users` table – phone, role). Migrations mein `users` schema hai; **Sequelize sync alag tables** (User model email-based) bana sakta hai. Dono systems align nahi to confusion. | `backend/src/routes/auth.routes.js`, `backend/migrations/001_initial_schema.sql`, `backend/src/models.js` |
| **Verification Hub / Finance / Agencies** | Pehle 404 aa raha tha – ab frontend mein 404 pe empty state + dev proxy add kiye gaye. Backend routes **present** hain (GET drivers, recharge-requests, agencies). Agar ab bhi 404 aaye to backend restart / URL check karo. | `admin_panel/src/pages/VerificationHub.jsx`, `Finance.jsx`, `Agencies.jsx`, `admin_panel/src/services/api.js`, `backend/src/routes/admin.routes.js` |
| **Map icons (Web)** | Flutter **web** par default red pin / emoji black box aa sakta tha – **colored circle** se fix kiya gaya (WEB_MAP_ISSUES.md). Agar koi device par ab bhi galat dikhe to us platform ke liye check. | `user_app` / `driver_app` – map marker logic (e.g. `_bitmapDescriptorFromColoredCircle`) |
| **Google Map buttons** | Zoom/compass/fullscreen **hide nahi** ho pa rahe – map iframe ke andar hai, CSS bahar ka iframe ke andar apply nahi hota. Plugin limitation. | Flutter `google_maps_flutter` (web), `user_app/web/index.html` |

---

## 3. Kaun se important features missing ya incomplete hain?

| Feature | Kya missing hai | Notes |
|--------|------------------|--------|
| **Real OTP (SMS)** | Abhi **mock OTP 1234** – SMS send nahi hota. | Backend: `config.mockOtp`; Phase 3 plan. |
| **OTP validation (ride start)** | Ride start pe backend pe OTP match **optional** – abhi strict validate nahi. | Backend rides.js start-ride; user/driver app OTP screen. |
| **Push notifications** | Driver ko **new request** aur user ko **ride status** ke liye push nahi – sirf in-app polling/siren (driver). | FCM/APNs integrate nahi; NEXT_PLAN Phase 2 Task 5. |
| **User wallet / recharge** | Profile, Wallet screen **placeholder** – balance, recharge, transactions backend se nahi. | User app wallet_screen; backend: recharge flow + transactions table. |
| **Finance (admin)** | Recharge requests list **stub** – backend `[]` return karta hai; approve/credit flow nahi. | `backend/src/routes/admin.routes.js` GET recharge-requests; Finance page. |
| **Agencies (admin)** | Agencies list **stub** – backend `[]` return; CRUD / fleet owners nahi. | Same admin.routes.js GET agencies; Agencies page. |
| **Driver verification: document upload** | Verification screen **UI** hai – document/360° **upload + storage** backend pe nahi. | Driver app verification_screen; backend storage + admin view. |
| **Agency portal** | Folder `agency_portal` – sirf `.gitkeep`; kuch build nahi. | README ke hisaab se fleet tracking, master wallet – future. |
| **Corporate portal** | Folder `corporate_portal` – sirf `.gitkeep`; kuch build nahi. | README ke hisaab se post-paid, guest booking – future. |
| **Create Account (user)** | Login screen pe "Create Account" – **coming soon** snackbar; registration flow nahi. | `user_app/lib/features/auth/login_screen.dart` |

---

## 4. Current issues – kahan kya problem ho rahi hai (aur kaun si files)

| Issue | Kya ho raha hai | Responsible files / module |
|-------|------------------|-----------------------------|
| **Database timeout (ETIMEDOUT)** | Backend RDS se connect nahi ho pa raha – sync fail; auth, rides, admin sab DB pe depend. | `backend/src/config/db.js`, `server.js`, `.env` (PG_HOST, RDS security group, public access) |
| **User app – real login nahi** | Login pe API call nahi; sirf Skip se home. | `user_app/lib/features/auth/login_screen.dart` |
| **Auth fail jab DB down** | Driver login/verify 500 dega; auth raw `query()` use karta hai. | `backend/src/routes/auth.routes.js`, DB connection |
| **Location** | User/driver location **geolocator** se aa rahi hai; map par marker (circle/emoji) show – web par circle fix hai. Agar device par permission deny ya inaccuracy ho to UX issue. | `user_app/lib/services/location_service.dart`, `driver_app/lib/services/location_service.dart`, home_screen map markers |
| **Tracking** | Driver live location **polling** se (user app GET driver-location); **Socket.io** server pe hai lekin ride-specific real-time push use nahi. | `user_app` polling in home/bidding flow; `backend/src/server.js` (io), rides driver-location API |
| **Icons** | Web par colored circle use ho rahe hain (WEB_MAP_ISSUES.md). Android/iOS par emoji/custom icon – theek hone chahiye. | User/driver app – marker creation (e.g. BitmapDescriptor, circle PNG) |
| **UI** | Theme (cream/orange user, dark/orange driver) + TransportBidder branding + logo – done. Koi known critical UI bug doc mein nahi. | App theme, logo assets, firm_config, app_brand |
| **Backend** | Server DB ke bina bhi start ho jata hai; places/directions proxy DB pe depend nahi. Rides/auth/admin **DB pe depend** – DB down = in features fail. | `backend/src/server.js`, `app.js`, `routes/*.js`, `config/db.js` |

---

## 5. Phase-wise status report

| Phase | Naam | Status | Short reason |
|-------|------|--------|--------------|
| **Phase 1** | Foundation | **Done** (DB ke bina partial) | Apps open, map, auth (driver API + user skip), backend routes, admin panel. **DB unreachable** hone par auth/rides/admin fail – isliye "partial" agar RDS use ho. |
| **Phase 2** | Bidding | **Done** | Ride create, driver requests, accept/counter/decline, accept-bid, state flow (arrived → start → complete), chat. E2E checklist bhi hai. |
| **Phase 3** | Realtime | **Done** (polling) | Driver location update; user ride ke dauran driver location **poll** karke map par dikhata hai. Push notifications **pending**. |
| **Phase 4** | Safety | **Partial** | OTP mock; ride start pe OTP validate optional. Driver verification UI hai, document upload/storage nahi. |
| **Phase 5** | Monetization | **Pending / Broken** | Wallet/recharge UI placeholder; Finance/Agencies backend stub (empty array). Commission admin settings persist ho raha hai. |

---

## 6. Pending / Broken items – detail (kya galat, kyun, kaise fix, kitna time)

### 6.1 Database connection (ETIMEDOUT)

- **Kya galat hai:** Backend AWS RDS se connect nahi ho pa raha; connection timeout; DB sync fail.
- **Kyun ho raha hai:** RDS security group mein aapke IP / 5432 allow nahi; ya RDS publicly accessible nahi; ya network/firewall block kar raha hai.
- **Kaise fix karenge:** (1) RDS Security Group → Inbound rule PostgreSQL 5432, Source = My IP ya 0.0.0.0/0 (dev). (2) RDS → Publicly accessible = Yes (agar local PC se connect karna ho). (3) Ya local PostgreSQL use karo – `.env` mein `PG_HOST=localhost`, DB create karke backend chalao.
- **Kitna time:** 15–30 min (AWS console) ya 10 min (local PG setup).

---

### 6.2 User app – login API call nahi

- **Kya galat hai:** User app login pe email/password submit pe backend auth call nahi; sirf "Skip for testing (Demo)" se home open hota hai.
- **Kyun:** Login screen deliberately skip/API call TODO rakha gaya tha (testing ke liye).
- **Kaise fix:** User app ko driver app jaisa banao: auth API (email/password ke liye agar backend pe endpoint ho) call karo, token save karo, phir home open. **Agar abhi backend pe email/password login nahi hai** to pehle backend pe simple email/password login (ya phone OTP) add karna padega; phir user app mein same auth_api + login flow.
- **Kitna time:** Backend endpoint + user app wiring: ~1–2 hours. (Nahi to skip hi rehne do jab tak real auth requirement na ho.)

---

### 6.3 Auth backend – DB down pe fail

- **Kya galat hai:** DB unreachable hone par `/api/auth/login` aur `/api/auth/verify` 500 de dete hain (raw `query()` fail).
- **Kyun:** Auth routes `config/db.js` ka `query()` use karte hain; DB connect nahi to throw.
- **Kaise fix:** (1) DB fix karo (above) – ye primary fix. (2) Optional: auth routes mein try/catch se 500 ki jagah clear message "Service temporarily unavailable" return karo taaki app crash na lage.
- **Kitna time:** DB fix ke baad 0. Agar graceful message add karna ho to ~15 min.

---

### 6.4 OTP – abhi mock, real SMS nahi

- **Kya galat hai:** Production ke hisaab se real OTP nahi – sirf mock code (1234).
- **Kyun:** Development/testing ke liye mock rakha gaya.
- **Kaise fix:** SMS gateway (Twilio, MSG91, etc.) integrate karo; login pe OTP send karo, verify pe match karo. Backend config (API key, from number) + auth.routes.js mein send + verify logic.
- **Kitna time:** 2–4 hours (gateway signup + integration).

---

### 6.5 Push notifications missing

- **Kya galat hai:** Driver ko new request pe aur user ko ride status pe push notification nahi – driver ko sirf in-app polling + siren hai.
- **Kyun:** FCM/APNs abhi add nahi kiye gaye (NEXT_PLAN Phase 2 Task 5).
- **Kaise fix:** Backend pe FCM server key; driver/user app mein Firebase + device token register; ride create/status change pe backend se push bhejna. Nahi to sirf polling/sound hi rehne do.
- **Kitna time:** 4–8 hours (Firebase setup + both apps + backend).

---

### 6.6 Wallet / Finance / Agencies – stub

- **Kya galat hai:** User wallet screen placeholder; admin Finance aur Agencies empty list (backend stub).
- **Kyun:** Phase 3 / future plan – recharge flow, transactions, agencies CRUD design baad mein.
- **Kaise fix:** (1) DB: transactions table (ya existing schema use), recharge_requests table. (2) Backend: recharge request create, list, approve → credit. (3) Admin Finance: list + Approve button. (4) Agencies: backend CRUD + admin list/form. **Naya feature hai – permission ke baad hi implement karna.**
- **Kitna time:** Finance flow ~1 day; Agencies CRUD ~0.5–1 day.

---

### 6.7 Driver verification – document upload nahi

- **Kya galat hai:** Verification screen UI hai; document/360° upload karke store nahi ho raha; admin ko dikhane wala flow nahi.
- **Kyun:** Placeholder UI first; storage + admin view baad mein.
- **Kaise fix:** Backend pe file upload (S3/local) + DriverVerification ya alag table mein URL save; driver app se upload API call; admin Verification Hub mein document/360° link dikhao. **Naya feature – permission ke baad.**
- **Kitna time:** ~1 day (upload + storage + admin view).

---

## 7. Summary table – phase status

| Phase | Done | Pending | Broken |
|-------|------|---------|--------|
| **Phase 1 – Foundation** | Apps, map, backend, admin, driver auth API, places/directions | User app real login | DB connection (RDS timeout) |
| **Phase 2 – Bidding** | Ride create, accept/counter, state flow, chat, E2E checklist | — | — |
| **Phase 3 – Realtime** | Driver location update, user polling driver location | Push notifications | — |
| **Phase 4 – Safety** | OTP mock, verification UI, ride state validation | Real OTP, OTP ride-start validate, doc upload | — |
| **Phase 5 – Monetization** | Admin settings (commission), Settings page persist | Wallet, recharge, Finance approve, Agencies CRUD | Finance/Agencies abhi stub (empty) |

---

## 8. Rules follow kiye (audit ke dauran)

- **Naya feature add nahi kiya** – sirf existing code scan karke report banayi.
- **Bada rewrite nahi kiya** – koi file change nahi ki (sirf ye report file new hai).
- **Fix suggestions** – sirf explain kiye: kya galat, kyun, kaise fix, kitna time. Code change abhi nahi kiya.

Agar tum chaho to kisi ek section (e.g. DB fix, user login API, push) ko next step bana kar usi hisaab se small, targeted fix suggest kar sakta hoon – bina naye feature ke.
