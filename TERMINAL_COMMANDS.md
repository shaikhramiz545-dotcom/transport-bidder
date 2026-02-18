# TransportBidder — Terminal se sab kuch chalane ki list

**Order:** Pehle **Terminal 1 (Backend)** zaroor chalao; baaki apps backend ko use karti hain.

---

## Terminal 1 — Backend (server connect)

Backend + DB sab apps ko API deta hai. Isko sabse pehle start karo.

```bash
cd backend
npm run migrate
npm start
```

- **URL:** http://localhost:4000  
- **Health check:** http://localhost:4000/health  
- Ye terminal band mat karo; backend chalta rehna chahiye.

---

## Terminal 2 — User app (Flutter)

```bash
cd user_app
flutter pub get
flutter run -d chrome
```

- **URL (Chrome):** app khul jayegi browser mein.  
- **Android phone par:** `flutter run -d android --dart-define=BACKEND_URL=http://<PC_IP>:4000`

---

## Terminal 3 — Driver app (Flutter)

```bash
cd driver_app
flutter pub get
flutter run -d chrome
```

- **URL (Chrome):** app khul jayegi browser mein.  
- **Android phone par:** `flutter run -d android --dart-define=BACKEND_URL=http://<PC_IP>:4000`

---

## Terminal 4 — Travel Partner portal (Agency portal)

```bash
cd agency_portal
npm install
npm run dev
```

- **URL:** http://localhost:5174 (ya next free port)

---

## Terminal 5 — Admin panel

```bash
cd admin_panel
npm install
npm run dev
```

- **URL:** http://localhost:5173 (ya next free port)

---

## Short summary (copy-paste order)

| # | App              | Commands |
|---|------------------|----------|
| 1 | Backend          | `cd backend` → `npm run migrate` → `npm start` |
| 2 | User app         | `cd user_app` → `flutter pub get` → `flutter run -d chrome` |
| 3 | Driver app       | `cd driver_app` → `flutter pub get` → `flutter run -d chrome` |
| 4 | Agency portal    | `cd agency_portal` → `npm install` → `npm run dev` |
| 5 | Admin panel      | `cd admin_panel` → `npm install` → `npm run dev` |

**Note:** Sab commands project root se chalao (jahan `backend`, `user_app`, `driver_app`, `agency_portal`, `admin_panel` folders hain).
