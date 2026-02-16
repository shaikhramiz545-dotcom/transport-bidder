# TBidder – Kaise Test Karein (Step by Step)

Yeh guide simple Hinglish mein hai. Jab bhi testing karni ho, isi order mein karo.

---

## Pehle yeh chalao (Order zaroori hai)

### Step 1: Backend start karo

1. **Cursor / VS Code** mein **Terminal** kholo (Ctrl + ` ya View → Terminal).
2. Type karo:
   ```
   cd backend
   npm start
   ```
3. Jab tak "API listening on http://localhost:4000" ya similar message na dikhe, wait karo.
4. **Backend band mat karo** – yeh terminal open hi rehna chahiye jab tak aap User/Driver app test kar rahe ho (agar app backend call karti hai).

**Agar error aaye:** Check karo `backend` folder mein `node_modules` hai (nahi hai to `npm install` chalao). `.env` mein `Maps_API_KEY` ya `GOOGLE_MAPS_API_KEY` set ho (places/directions ke liye).

---

### Step 2: User App test karo (Chrome)

1. **Naya terminal** kholo (pehla backend ke liye chhod do).
2. Type karo:
   ```
   cd user_app
   flutter run -d chrome
   ```
3. Chrome khul jayega, TBidder user app load hogi.
4. **Check karo:**
   - Login page aaya? → "Skip for testing (Demo)" dabao → Home (map) khulna chahiye.
   - Map Peru (Lima) ka dikh raha hai?
   - Upar right mein **globe (🌐)** – language change (English, Spanish, Russian, French).
   - Upar left **menu (☰)** – drawer: Profile, Wallet, History, Support, Logout.
   - Location allow karo (agar popup aaye ya "Allow location" banner) → "Allow" dabao.
   - **Origen** field ke neeche **"Your current location"** – dabane par A point set ho.
   - **Destino** ke neeche **"Select your destination on map"** – dabao → search box hat jana chahiye, full map dikhe → map par tap karo → destination set ho. **"Type location instead"** se search box wapas aana chahiye.
   - A + B set karo → **Buscar Vehículo** → vehicle select → Reservar → bidding list → Accept/Counter → driver thank-you message + ETA.
   - Driver on way → map par driver ka vehicle icon (🚗) + user ka emoji (👨) dikhna chahiye.
   - Chat / Call buttons (counter accept ke baad).
   - OTP, Start ride, Complete ride flow.
5. **Bug mile to:** `USER_APP_TESTING.md` kholo, "Bugs / Issues Found" table mein nayi row add karo – short description, kahan/kaise, Status = Open.

---

### Step 3: Driver App test karo (Chrome)

1. **Naya terminal** kholo (backend + user app wale open rehne do ya band karo, driver ke liye).
2. Type karo:
   ```
   cd driver_app
   flutter run -d chrome
   ```
3. Chrome mein "TBidder Partner" khulega.
4. **Check karo:**
   - Login page → **Skip for testing (Demo)** → Home (map).
   - Map par **slider** (Estás desconectado | Conductor en servicio) – **ON** karo → "Driver on duty" dikhna chahiye, driver ki location fetch ho, map par **car icon (🚗)** dikhe.
   - Upar right: **globe** (language), **menu (☰)** – drawer: Earnings, Documents, Go Home, Settings, Logout. Earnings, PDF/Excel download check karo.
   - **Current location** button (niche right) – dabane par map driver ki location par center ho.
   - Driver on duty rakho → User app se booking karo → driver app par **notification** aani chahiye (new request). Accept / Counter → pickup–drop map par, route, OTP, Start ride, Slide to complete.
5. **Bug mile to:** `DRIVER_APP_TESTING.md` mein "Bugs / Issues Found" table mein note karo.

---

### Step 4: Control Panel test karo

1. **Backend pehle se chal raha ho** (Step 1). Agar nahi, to `cd backend` → `npm start`.
2. **Naya terminal** kholo:
   ```
   cd admin_panel
   npm run dev
   ```
3. Browser mein admin panel khulega (localhost:5173 ya jo port dikhe).
4. **Login:** Email = `admin@tbidder.com`, Password = `admin123` → Sign In.
5. **Check karo:**
   - Dashboard – stats (Online Drivers, Today's Rides, etc.) – backend se real count.
   - Sidebar: Dashboard, Bookings, Dispatcher, Verification Hub, Finance, Agencies, Settings.
   - Bookings – ride list (user/dispatcher se create kiye rides yahan dikhen).
   - Dispatcher – form se manual ride create karo → Bookings mein dikhna chahiye.
   - Verification Hub – drivers list, Approve/Reject se status update.
   - Settings – commission % aur notifications set karo → Save → refresh pe same values.
   - Logout – login page par wapas.
6. **Bug mile to:** `CONTROL_PANEL_TESTING.md` mein "Bugs / issues found" table mein note karo.

---

## E2E Test Checklist – Full Ride Flow + Control Panel

Yeh checklist tab use karo jab **pura ride flow** aur **admin panel** ek saath verify karna ho. Backend + User app + Driver app + Admin panel sab chalne chahiye.

### A. Pehle sab start karo

| # | Service       | Command                          | Verify                          |
|---|---------------|-----------------------------------|---------------------------------|
| 1 | Backend       | `cd backend` → `npm start`        | "API listening on ... 4000"     |
| 2 | User app      | `cd user_app` → `flutter run -d chrome` | Map + login skip               |
| 3 | Driver app    | `cd driver_app` → `flutter run -d chrome` | Map + login skip               |
| 4 | Admin panel   | `cd admin_panel` → `npm run dev`  | Login: admin@tbidder.com / admin123 |

---

### B. Full ride flow (User → Driver → Complete)

| Step | Kahan (User / Driver / Backend) | Kya karna hai | Kya check karna hai |
|------|----------------------------------|---------------|----------------------|
| B1   | User app                         | Skip login → Home. Origen = "Your current location", Destino = map par tap. **Buscar Vehículo** → vehicle select → **Reservar**. | Ride create ho; bidding/confirmation screen aaye. |
| B2   | Backend                          | —                             | `POST /api/rides` se ride DB mein bane; status = `pending` / `searching`. |
| B3   | Driver app                       | **Online** karo (slider ON).   | Driver "on duty" dikhe; location update ho. |
| B4   | Driver app                       | New request aane par **Accept** ya **Counter** karo. | Request list mein ride dikhe; accept/counter API call ho. |
| B5   | User app                         | Driver ke bid ko **Accept** / **Counter** karo. | Thank-you message / ETA; status = accepted. |
| B6   | Driver app                       | Pickup location tak (map) jao. **Driver arrived** (ya equivalent) dabao. | Status → `driver_arrived`. |
| B7   | User app                         | OTP dikhe (agar UI mein hai).  | OTP screen/field dikhe. |
| B8   | Driver app                       | **Start ride** dabao (OTP enter ya skip). | Backend sirf `driver_arrived` pe start-ride allow kare; status → `ride_started`. |
| B9   | Driver app                       | Ride complete karo → **Slide to complete** / **Complete**. | Status → `completed`; backend validation: complete sirf `ride_started` pe. |
| B10  | User app                         | Ride complete dikhe; history/wallet update (agar shown). | Completed ride dikhe. |

---

### C. Control panel – real data verify

| Page / Feature   | Kya karna hai | Kya check karna hai |
|------------------|----------------|----------------------|
| **Dashboard**    | Login → Dashboard. | Stats: Online Drivers, Today's Rides, Total Rides – backend se real count (0 ya actual). |
| **Bookings**     | Bookings sidebar → list. | Ride list backend se (`GET /admin/rides`); agar koi ride create ki hai (user app ya dispatcher se) to woh dikhe. |
| **Bookings → detail** | Kisi ride par click. | Ride detail + messages (agar chat use kiya). |
| **Dispatcher**   | Dispatcher → form: pickup/drop lat-lng, user/driver ID (ya dropdown), vehicle type. **Create ride** dabao. | Ride create ho; Bookings list mein nayi ride dikhe. |
| **Verification Hub** | Verification Hub open karo. | Drivers list (`GET /admin/drivers`); status: Pending / Approved / Rejected. **Approve** / **Reject** dabao → driver status update ho. |
| **Settings**     | Settings → Commission % aur Notifications (on/off) set karo → Save. | Values backend mein save hon (`POST /api/admin/settings`). Page refresh ya dubara Settings kholo → same values dikhen. |
| **Finance**      | Finance open karo. | Filhaal empty/stub – "No recharge requests" ya similar. |
| **Agencies**     | Agencies open karo. | Filhaal empty/stub – "No agencies" ya similar. |

---

### D. Phase 1 quick verify (sab theek hai ya nahi)

| Area        | Check |
|-------------|--------|
| User app    | Login skip, map load, language (globe), menu (Profile, Wallet, History, Support), location allow, Origen/Destino set, Buscar Vehículo → Reservar. |
| Driver app  | Login skip, online/offline slider, menu (Earnings, Documents, Verification, Go Home, Settings), current location button, vehicle icon on map. |
| Admin panel | Login (admin@tbidder.com / admin123), sidebar (Dashboard, Bookings, Dispatcher, Verification Hub, Finance, Agencies, Settings), Logout. |

---

### E. Bug log

- **User app bug** → `USER_APP_TESTING.md` (Bugs / Issues Found table).
- **Driver app bug** → `DRIVER_APP_TESTING.md` (Bugs / Issues Found table).
- **Control panel bug** → `CONTROL_PANEL_TESTING.md` (Bugs / issues found table).

---

## Short checklist (yaad rahe)

| Kaam              | Command / Step                                      |
|-------------------|-----------------------------------------------------|
| Backend           | `cd backend` → `npm start`                          |
| User app          | `cd user_app` → `flutter run -d chrome`            |
| Driver app        | `cd driver_app` → `flutter run -d chrome`           |
| Control panel     | `cd admin_panel` → `npm run dev` (backend chalu ho)|
| User bugs         | `USER_APP_TESTING.md` → table mein likho            |
| Driver bugs       | `DRIVER_APP_TESTING.md` → table mein likho          |
| Panel bugs        | `CONTROL_PANEL_TESTING.md` → table mein likho       |

---

## Agar "flutter" ya "npm" not found aaye

- **flutter:** Flutter SDK install karo, PATH mein add karo. Terminal mein `flutter doctor` chala ke check karo.
- **npm:** Node.js install karo (npm usi ke sath aata hai). Terminal mein `node -v` aur `npm -v` check karo.

Jitni baar bhi test karoge, isi order se chalao: pehle backend (agar apps API use karti hon), phir jis app ko test karna hai uski command.
