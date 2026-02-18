# TBidder – Database & API Keys Check

**Purpose:** Database config aur saari API keys ek jagah; kaun sahi kaam kar rahi hai, kaun available nahi hai.

---

## 1. Database (PostgreSQL)

| Variable | Use | Default / Example | Status |
|----------|-----|-------------------|--------|
| **PG_HOST** | DB server | `localhost` ya Aurora host | `.env` mein set karo; agar nahi to localhost |
| **PG_PORT** | Port | `5432` | Optional |
| **PG_DATABASE** | Database name | `tbidder` | DB create karke same name use karo |
| **PG_USER** | User | `postgres` | |
| **PG_PASSWORD** | Password | (empty) | **Zaroor set karo** – empty = connect fail |
| **PG_SSL** | SSL on/off | (not set) | Local PG ke liye `false`; Aurora ke liye usually true |

**Config file:** `backend/src/config/index.js`  
**Check:** Backend start par log: `[DB] Connecting to host: ... (from PG_HOST in .env)`  
**Agar DB unreachable:** Server phir bhi start hota hai; rides/admin stats fail ho sakte hain. Local test ke liye PostgreSQL install karke `PG_HOST=localhost`, `PG_PASSWORD=...` set karo.

**`.env` copy:** `backend/.env.example` ko copy karke `backend/.env` banao aur values bharo. **.env.example mein Google Maps key nahi hai** – niche dekho.

---

### AWS RDS par database use karna (Move DB to AWS)

Agar tumhara PostgreSQL **AWS RDS** par hai, to backend ko usi se connect karvana:

1. **RDS endpoint lo:** AWS Console → RDS → Databases → apni instance → **Endpoint** (e.g. `tbidder.xxxxxx.ap-south-1.rds.amazonaws.com`).
2. **Security group:** Backend jahan chal raha hai (EC2 / same VPC) us IP/security group ko RDS ke **Inbound rules** mein allow karo (Port **5432**).
3. **`backend/.env` mein set karo:**
   ```env
   PG_HOST=tbidder.xxxxxx.ap-south-1.rds.amazonaws.com
   PG_PORT=5432
   PG_DATABASE=tbidder
   PG_USER=postgres
   PG_PASSWORD=your_rds_master_password
   PG_SSL=true
   ```
4. **Migrations:** Pehli baar RDS use kar rahe ho to schema create karo:
   ```bash
   cd backend && node scripts/run-migrations.js
   ```
   (Ye script `PG_*` from `.env` use karega.)
5. **Backend restart** karo. Log mein `[DB] Connecting to host: tbidder.xxxxxx...` dikhega.

**Apps (Admin Panel, Driver App, User App)** database directly use nahi karti — sab **backend API** ke through jati hain. Matlab backend ko sirf AWS RDS wale `.env` se run karo; admin/driver/user apps ko backend ka URL do (e.g. `VITE_API_URL` / `BACKEND_URL`). Database automatically AWS par hi use hoga.

---

## 2. Backend API Keys & Env

| Variable | Use | Where | Available? |
|----------|-----|--------|------------|
| **GOOGLE_MAPS_API_KEY** ya **GOOGLE_API_KEY** | Places (autocomplete, details) + Directions | `backend/.env` + places.proxy.js, directions.js | **Backend:** Places proxy mein **fallback hardcoded** key hai (`AIzaSy...`). Directions mein agar env empty hai to **503** (key not configured). Dono ko sahi chalane ke liye `.env` mein `GOOGLE_MAPS_API_KEY=your_key` set karo. |
| **JWT_SECRET** | Auth tokens | config/index.js | Default: `tbidder-dev-secret-change-in-production`. Production mein change karo. |
| **ADMIN_EMAIL** / **ADMIN_PASSWORD** | Control panel login | admin.routes.js | Default: admin@tbidder.com / admin123. Optional override via .env. |
| **PORT** | Backend port | config | Default 4000. |

**Places (backend):**  
- `GOOGLE_MAPS_API_KEY` ya `GOOGLE_API_KEY` na ho to **places.proxy.js** fallback key use karta hai (same key jo Flutter apps mein hai).  
- Matlab **Places API** backend se chal sakti hai jab tak woh key valid hai.

**Directions (backend):**  
- `GOOGLE_MAPS_API_KEY` / `GOOGLE_API_KEY` **empty** hai to **directions.js** 503 return karta hai ("Directions API key not configured").  
- **.env** mein same key set karo to Directions bhi chalega.

**Recommendation:**  
`backend/.env` mein add karo:
```env
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
```
(Apna key Google Cloud Console → APIs & Services → Credentials se lo; production ke liye restrict karo.)

---

## 3. Flutter Apps – Google Maps API Key

| App | Android | Web | iOS (Info.plist) |
|-----|---------|-----|-------------------|
| **user_app** | AndroidManifest: `com.google.android.geo.API_KEY` = key set | index.html: script src with key | (Agar iOS build karo to Info.plist mein key add karna padega) |
| **driver_app** | AndroidManifest: same meta-data | index.html: script src with key | Same |

**Current key in apps:** Set via `GOOGLE_MAPS_API_KEY` env var and in AndroidManifest.xml (user_app + driver_app Android + web).  
**Note:** Yeh key **public** hai (client-side). Agar Google Cloud mein billing / restrictions nahi hai to map blank ya error aa sakta hai. Production ke liye: naya key, API restrictions (Maps SDK, Places, Directions), aur billing enable karo.

**Jo API available nahi hai (client-side):**  
- Google Maps SDK (Android/iOS/Web) – key **valid + enabled** honi chahiye. Agar key invalid/disabled/billing issue hai to map load nahi hoga.  
- Backend **Places/Directions** – backend key se chalte hain; agar backend .env mein key nahi (directions ke liye) to Directions **available nahi** (503).

---

## 4. Backend APIs – List (sab sahi kaam karein to)

| Route | Method | Auth | Depends on | Available if |
|-------|--------|------|------------|--------------|
| /health, /api/health | GET | — | DB (health check) | Server up; DB optional for 200 |
| /api/auth/login | POST | — | DB (users table) | PG connected |
| /api/auth/verify | POST | — | DB, JWT_SECRET | PG connected |
| /api/places/autocomplete | GET | — | Google Places API key | Key set (env ya fallback) |
| /api/places/details | GET | — | Google Places API key | Same |
| /api/directions | GET | — | Google Directions API key | **Key in .env** (empty = 503) |
| /api/drivers/location | POST | — | — | Hamesha |
| /api/drivers/offline | POST | — | — | Hamesha |
| /api/drivers/nearby | GET | — | — | Hamesha |
| /api/drivers/requests | GET | — | DB (Ride) | PG connected |
| /api/drivers/verification-status | GET | — | DB (DriverVerification) | PG connected |
| /api/drivers/verification-register | POST | — | DB | PG connected |
| /api/rides (create, get, chat, accept, etc.) | POST/GET | — | DB (Ride, Message) | PG connected |
| /api/admin/login | POST | — | JWT_SECRET, ADMIN_* | Hamesha |
| /api/admin/stats | GET | Bearer | DB, drivers count | PG connected |
| /api/admin/rides | GET | Bearer | DB | PG connected |
| /api/admin/rides/:id | GET | Bearer | DB | PG connected |
| /api/admin/dispatcher/ride | POST | Bearer | DB | PG connected |
| /api/admin/drivers | GET | Bearer | DB (DriverVerification) | PG connected |
| /api/admin/drivers/:id/verify | POST | Bearer | DB | PG connected |
| /api/admin/recharge-requests | GET | Bearer | — | Hamesha (stub) |
| /api/admin/agencies | GET | Bearer | — | Hamesha (stub) |
| /api/admin/settings | GET/POST | Bearer | DB (AdminSettings) | PG connected |

---

## 5. Jo API / Service Available Nahi Hai (summary)

| Item | Reason | Fix |
|------|--------|-----|
| **Directions (backend)** | `GOOGLE_MAPS_API_KEY` / `GOOGLE_API_KEY` empty → 503 | `backend/.env` mein `GOOGLE_MAPS_API_KEY=your_key` set karo. |
| **Database (PG)** | .env mein PG_* galat / DB server off | PG_HOST, PG_USER, PG_PASSWORD sahi karo; DB create karo; server reachable karo. |
| **Google Maps (Flutter)** | Key invalid / disabled / billing not enabled | Google Cloud Console: Maps SDK (Android/iOS/Web), Places, Directions enable karo; key restrict karo; billing enable karo. |
| **Places (backend)** | Key invalid (env + fallback dono fail) | Valid key .env mein do; Places API enable karo. |

---

## 6. .env Example (backend) – Complete

**Local Postgres:**
```env
NODE_ENV=development
PORT=4000

PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=tbidder
PG_USER=postgres
PG_PASSWORD=your_password
PG_SSL=false

JWT_SECRET=your_jwt_secret_change_in_production
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

**AWS RDS:**
```env
NODE_ENV=production
PORT=4000

PG_HOST=your-instance.xxxxxx.region.rds.amazonaws.com
PG_PORT=5432
PG_DATABASE=tbidder
PG_USER=postgres
PG_PASSWORD=your_rds_master_password
PG_SSL=true

JWT_SECRET=your_jwt_secret_change_in_production
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

---

**Fix applied:** Driver app `AndroidManifest.xml` mein API key value ke around quotes add kiye (pehle `android:value=AIzaSy...` tha, ab `android:value="AIzaSy..."`).
