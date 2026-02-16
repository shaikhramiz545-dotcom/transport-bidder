# TBidder – Server Par Set Karne Ka Tarika

Ab **User app**, **Driver app**, aur **Admin panel** sab **apne server** par point kar sakte hain. Localhost ki jagah server ka URL use hoga.

---

## 1. Server par kya kya chalega

| Cheez        | Kaam |
|-------------|------|
| **Backend** | Server par Node.js app (API) – yeh sab apps ko serve karega. |
| **Admin panel** | Build karke static files (HTML/JS/CSS) – Nginx ya kisi bhi web server se serve. |
| **User app (Web)** | Flutter web build – static files – Nginx se serve. |
| **Driver app (Web)** | Flutter web build – static files – Nginx se serve. |

Backend URL maan lo: **`https://api.yourserver.com`** (ya `http://YOUR_SERVER_IP:4000`).

---

## 2. Backend server par set karna

1. Server par code upload karo (git clone ya zip).
2. **backend** folder mein jao:
   ```bash
   cd backend
   npm install
   ```
3. **.env** banao (`.env.example` copy karke):
   ```env
   NODE_ENV=production
   PORT=4000
   PG_HOST=your_db_host
   PG_PORT=5432
   PG_DATABASE=tbidder
   PG_USER=postgres
   PG_PASSWORD=your_password
   JWT_SECRET=strong_random_secret_here
   ```
4. DB migrations chalao (agar use karte ho):
   ```bash
   npm run migrate
   ```
5. Start karo:
   ```bash
   npm start
   ```
   Ya **pm2** se hamesha chalane ke liye:
   ```bash
   pm2 start src/server.js --name tbidder-api
   pm2 save && pm2 startup
   ```
6. **Nginx** (ya reverse proxy) se API ko expose karo, e.g.:
   - `https://api.yourserver.com` → `http://127.0.0.1:4000`

---

## 3. Admin panel – server URL use karke build

1. **admin_panel** folder mein:
   ```bash
   cd admin_panel
   ```
2. **.env** banao (server ke backend URL ke liye):
   ```env
   VITE_API_URL=https://api.yourserver.com
   ```
   (Local test ke liye .env hata do ya `VITE_API_URL=http://localhost:4000` rakho.)
3. Build karo:
   ```bash
   npm install
   npm run build
   ```
4. **dist** folder ki saari files server par kisi bhi web root par rakh do (e.g. Nginx:
   - `https://admin.yourserver.com` → `admin_panel/dist`).

---

## 4. User app (Flutter Web) – server URL use karke build

1. **user_app** folder mein:
   ```bash
   cd user_app
   flutter pub get
   flutter build web --dart-define=BACKEND_URL=https://api.yourserver.com
   ```
2. **build/web** ki saari files server par deploy karo (e.g. Nginx:
   - `https://app.yourserver.com` → `user_app/build/web`).

---

## 5. Driver app (Flutter Web) – server URL use karke build

1. **driver_app** folder mein:
   ```bash
   cd driver_app
   flutter pub get
   flutter build web --dart-define=BACKEND_URL=https://api.yourserver.com
   ```
2. **build/web** ki files deploy karo (e.g. `https://driver.yourserver.com` → `driver_app/build/web`).

---

## 6. Summary – URLs kya set karne hain

| App / Build        | Kaise set karte hain |
|--------------------|------------------------|
| Backend            | Server par .env mein `PORT`, DB, `JWT_SECRET`. Nginx se `https://api.yourserver.com` → backend. |
| Admin panel        | Build se pehle `.env` mein `VITE_API_URL=https://api.yourserver.com`. |
| User app (web)     | Build: `flutter build web --dart-define=BACKEND_URL=https://api.yourserver.com` |
| Driver app (web)   | Build: `flutter build web --dart-define=BACKEND_URL=https://api.yourserver.com` |
| User/Driver (mobile) | Run/build: `--dart-define=BACKEND_URL=https://api.yourserver.com` (same URL). |

---

## 7. Local vs server

- **Local (localhost):** Kuch set mat karo – User/Driver app `localhost:4000`, Admin panel bhi `localhost:4000` use karega.
- **Server:** Sirf backend URL change karo: `https://api.yourserver.com` (admin .env + Flutter `BACKEND_URL`).

Agar aapka server abhi **IP** par hai (e.g. `http://192.168.1.10:4000`), to `BACKEND_URL` aur `VITE_API_URL` mein wahi IP use karo; baad mein domain laga kar HTTPS kar sakte ho.
