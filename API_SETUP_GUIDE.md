# TBidder – API Kahan Set Karein (Setup Guide)

Sabhi APIs aur config kahan milti hai, kaise set karein – yeh guide.

---

## 1. Backend API URL (sabse important)

Backend Node.js server chal raha hona chahiye (port 4000). Apps backend ko is URL se call karti hain.

| App | Config Location | Default | Production / Device |
|-----|-----------------|---------|---------------------|
| **User app** | `user_app/lib/core/api_config_io.dart` (Android/iOS) | `http://127.0.0.1:4000` | `--dart-define=BACKEND_URL=https://api.yourserver.com` |
| **User app (Web)** | `user_app/lib/core/api_config_stub.dart` | `http://localhost:4000` | Same `--dart-define` |
| **Driver app** | `driver_app/lib/core/api_config_io.dart` | `http://10.0.2.2:4000` (emulator) | `--dart-define=BACKEND_URL=http://192.168.x.x:4000` |
| **Admin panel** | `admin_panel/.env` | Vite proxy → localhost:4000 | `VITE_API_URL=https://api.yourserver.com` |
| **Agency portal** | `agency_portal/vite.config.js` proxy | localhost:4000 | Deploy par proxy target change karo |

### Local development
- Backend: `cd backend && npm start` → `http://localhost:4000`
- User app / Driver app (Chrome): default hi sahi, backend same PC par hai
- Physical Android phone par: `flutter run -d android --dart-define=BACKEND_URL=http://YOUR_PC_IP:4000`  
  (PC IP: `ipconfig` se dekho, e.g. 192.168.1.5)

### Production
- Backend deploy karo (EC2, Railway, Heroku, etc.) → e.g. `https://api.tbidder.com`
- Flutter build: `flutter build apk --dart-define=BACKEND_URL=https://api.tbidder.com`
- Admin / Agency: `.env` mein `VITE_API_URL=https://api.tbidder.com`

---

## 2. Backend Environment (backend/.env)

Backend ke liye saari keys `backend/.env` mein:

```
PORT=4000
NODE_ENV=development

# Database (PostgreSQL)
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=tbidder
PG_USER=postgres
PG_PASSWORD=your_password
PG_SSL=false

# Auth
JWT_SECRET=your_secret_change_in_production

# Google Maps
GOOGLE_MAPS_API_KEY=AIzaSy...your_key

# dLocal (tour payments)
DLOCAL_API_KEY=
DLOCAL_SECRET_KEY=
DLOCAL_SANDBOX=true
```

**Kahan milega:** `backend/.env.example` ko copy karke `backend/.env` banao, phir values bharo.

---

## 3. Google Maps API Key

| Use | Kahan set karein |
|-----|------------------|
| **Backend** (Places, Directions) | `backend/.env` → `GOOGLE_MAPS_API_KEY=...` |
| **User app** | `user_app/web/index.html` (script src) + `user_app/android/app/src/main/AndroidManifest.xml` |
| **Driver app** | `driver_app/web/index.html` + `driver_app/android/.../AndroidManifest.xml` |

**Key kahan milegi:** [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → Create API Key.  
Enable: Maps SDK (Android/Web), Places API, Directions API. Billing enable karo.

---

## 4. Firebase

| Use | Kahan set karein |
|-----|------------------|
| **Config** | `user_app/lib/firebase_options.dart` + `driver_app/lib/firebase_options.dart` |
| **JSON (Android)** | `user_app/android/app/google-services.json` + `driver_app/android/app/google-services.json` |

**Kahan milega:** [Firebase Console](https://console.firebase.google.com/) → Project → Project Settings → General → Your apps.  
Flutter project add karo, `flutterfire configure` ya manually `google-services.json` + `firebase_options.dart` add karo.

---

## 5. dLocal (Tour payments)

| Variable | Kahan |
|----------|-------|
| DLOCAL_API_KEY | `backend/.env` |
| DLOCAL_SECRET_KEY | `backend/.env` |

**Kahan milega:** [dLocal Go Dashboard](https://dashboard-sbx.dlocalgo.com) (Sandbox) ya [Live](https://dashboard.dlocalgo.com).

---

## 6. Summary – File Paths

| Config | File Path |
|--------|-----------|
| Backend API URL (User app) | `user_app/lib/core/api_config_io.dart` ya `api_config_stub.dart` |
| Backend API URL (Driver app) | `driver_app/lib/core/api_config_io.dart` |
| Backend env | `backend/.env` |
| Admin panel API | `admin_panel/.env` → `VITE_API_URL` |
| Agency portal proxy | `agency_portal/vite.config.js` → `server.proxy` |
| Google Maps (Flutter) | `*/web/index.html`, `*/android/.../AndroidManifest.xml` |
| Firebase | `*/firebase_options.dart`, `*/android/app/google-services.json` |

---

## Quick Start (Local)

1. `backend/.env` banao, PG + JWT + GOOGLE_MAPS_API_KEY set karo  
2. `cd backend && npm run migrate && npm start`  
3. User / Driver app: `flutter run -d chrome` (default localhost:4000 use hoga)  
4. Admin / Agency: `npm run dev` (proxy se backend hit karega)
