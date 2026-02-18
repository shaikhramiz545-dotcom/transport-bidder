# TransportBidder — Local Development Setup

**Goal:** Run the full stack locally with **no AWS or paid cloud**. All testing on internal/local infrastructure only.

---

## 1. Prerequisites (local only)

- **Node.js** 18+ (backend)
- **PostgreSQL** 14+ (local install, or Docker)
- **Flutter** SDK (user app, driver app)
- **npm** (admin panel, agency portal)

No AWS account, RDS, or S3 required for development.

---

## 2. Local PostgreSQL

### Option A: Installed locally
- Install PostgreSQL (e.g. from https://www.postgresql.org/download/)
- Create database: `createdb tbidder` (or via pgAdmin)
- Default user `postgres`, password as set during install

### Option B: Docker
```bash
docker run -d --name tbidder-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=tbidder -p 5432:5432 postgres:14
```

### Option C: SQLite (not implemented yet)
- Current codebase uses PostgreSQL only. For zero-DB setup, a future task could add SQLite adapter; for now use local Postgres or Docker.

---

## 3. Backend (Node/Express)

```bash
cd backend
```

**First-time: use local env**
- Copy `backend/.env.local.example` to `backend/.env`
- Or set in `.env`:
  - `PG_HOST=localhost`
  - `PG_PORT=5432`
  - `PG_DATABASE=tbidder`
  - `PG_USER=postgres`
  - `PG_PASSWORD=postgres`   # or your local postgres password
  - `PG_SSL=false`

**Run migrations (creates `users` table for auth + schema)**
```bash
npm run migrate
```

**Install dependencies (if not done)**
```bash
npm install
```

**Start server**
```bash
npm start
```

- API: **http://localhost:4000**
- Health: **http://localhost:4000/health**
- No AWS RDS needed; if `.env` has `PG_HOST=localhost` and `PG_SSL=false`, backend uses local Postgres only.

---

## 4. Auth / users table

- Auth uses **raw SQL** on table `users` (phone, role).
- Migrations create this table; if you use **Sequelize sync only** (no migrations), ensure `users` exists (e.g. run `npm run migrate` once).
- **OTP:** Mock only in dev; code `1234` (see `mockOtp` in config). No real SMS gateway.

---

## 5. User app (Flutter)

```bash
cd user_app
flutter pub get
flutter run -d chrome
# or: flutter run -d android (emulator)
```

- Backend URL: **http://localhost:4000** (web) or **http://10.0.2.2:4000** (Android emulator). See `lib/core/api_config_io.dart` and `api_config_stub.dart`.
- No cloud dependency; all API calls go to local backend.

### 5.1 Testing on physical Android phone

**Zaroori:** Phone aur PC **dono same WiFi** par hon. Backend PC par chal raha ho (`npm start` in `backend`).

1. **PC ka IP nikalo (WiFi wala):**
   - **Windows:** CMD ya PowerShell mein `ipconfig` → **Wireless LAN adapter Wi-Fi** → **IPv4 Address** (e.g. `192.168.1.5`).
   - **Mac/Linux:** Terminal mein `ifconfig` ya `ip addr` → WiFi interface ka inet (e.g. `192.168.1.5`).

2. **Phone par USB debugging on karo:**
   - Settings → About phone → **Build number** 7 baar tap → Developer options enable.
   - Settings → Developer options → **USB debugging** ON.
   - USB cable se PC se connect karo; phone par "Allow USB debugging" allow karo.

3. **Device check:**  
   `flutter devices` — apna phone dikhna chahiye.

4. **User app phone par run karo (PC IP use karo):**
   ```bash
   cd user_app
   flutter run -d <device_id> --dart-define=BACKEND_URL=http://192.168.1.5:4000
   ```
   `192.168.1.5` ko apne PC ke IPv4 se replace karo. `device_id` = `flutter devices` mein jo ID aata hai (e.g. `ABC123XYZ`), ya sirf `flutter run --dart-define=BACKEND_URL=http://192.168.1.5:4000` agar ek hi device connected hai.

5. **Driver app phone par run karo:**
   ```bash
   cd driver_app
   flutter run -d <device_id> --dart-define=BACKEND_URL=http://192.168.1.5:4000
   ```

6. **Firewall:** Agar phone se backend connect nahi ho raha to Windows Firewall mein **Inbound rule** banao: Port **4000** TCP allow (Private network) for `node.exe` ya backend process.

**Optional — APK install karke test (bina USB):**  
Build APK with same backend URL (replace `192.168.1.5` with your PC IP):
```bash
cd user_app
flutter build apk --dart-define=BACKEND_URL=http://192.168.1.5:4000
```
APK milega: `build/app/outputs/flutter-apk/app-release.apk`. Isko phone par copy karke install karo; PC par backend chalna chahiye aur same WiFi.

---

## 6. Driver app (Flutter)

```bash
cd driver_app
flutter pub get
flutter run -d chrome
```

- Same backend URL rules as user app.

---

## 7. Admin panel (React/Vite)

```bash
cd admin_panel
npm install
npm run dev
```

- Opens on **http://localhost:5173** (or next free port). Proxy `/api` → `http://localhost:4000`.
- No AWS; all API calls to local backend.

---

## 8. Agency portal (Travel Partner)

```bash
cd agency_portal
npm install
npm run dev
```

- Opens on **http://localhost:5174**. Proxy `/api` → `http://localhost:4000`.
- Local only.

---

## 9. Payments / OTP / Push (MOCK only)

- **OTP:** Backend returns mock OTP `1234`. No real SMS.
- **Payments (dLocal):** Leave `DLOCAL_API_KEY` / `DLOCAL_SECRET_KEY` empty or use sandbox; no real charges.
- **Push notifications:** Not required for local dev; use in-app polling/sound only.
- **Email (payout):** Optional; if SMTP not set, payout completes but no email is sent.

---

## 10. AWS / Cloud

- **Development:** AWS must be **off** or **free tier only**. No production deployment, no auto-scaling, no paid instances.
- **Code:** Application code (`backend/src`) has **no hardcoded AWS**; DB and config are **env-only** (PG_HOST, PG_SSL, etc.). Local defaults = localhost, no SSL.
- **If existing `.env` points to RDS:** Override with `PG_HOST=localhost` and `PG_SSL=false` for local runs.
- **No S3/EC2** in current code paths for core flows; any future file storage should use local or mock in dev.
- Before any cloud deployment, get permission and document cost + benefits.

---

## 11. Quick check (local stability)

1. **Backend:** `curl http://localhost:4000/health` → OK.
2. **DB:** Backend logs show `[DB] Connecting to host: localhost (no SSL, local)` and no ETIMEDOUT.
3. **Migrations:** `npm run migrate` in `backend` → runs without error.
4. **User app:** Open Tours from drawer; Retry → list loads (or empty if no tours).
5. **Driver app:** Login with phone + OTP 1234 (or Skip); home loads.
6. **Admin:** Login (e.g. admin@tbidder.com / admin123); dashboard loads.
7. **Agency portal:** Signup/Login; dashboard and tours work.

---

## 12. Troubleshooting

- **"Failed to fetch" / connection refused:** Start backend (`npm start` in `backend`) and ensure `.env` has `PG_HOST=localhost`, `PG_SSL=false`.
- **DB sync error / ETIMEDOUT:** You are still pointing at a remote host. Use `.env.local.example` as template and set `PG_HOST=localhost`, `PG_SSL=false`.
- **Auth 500:** Ensure `users` table exists (run `npm run migrate` in backend).
- **Migrations fail (SSL):** Ensure `.env` has `PG_SSL=false` for local Postgres.

---

**Confirm when done:**
- [ ] Local backend starts and responds on port 4000
- [ ] Local DB (PostgreSQL) connected; no RDS required
- [ ] User app, driver app, admin, agency portal run without cloud dependency
