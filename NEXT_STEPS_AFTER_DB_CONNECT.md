# Backend start ho gaya — ab kya karna hai

Backend AWS RDS se connect ho chuka hai. Ye steps follow karo.

---

## 1. Health check (optional)

Browser mein kholo: **http://localhost:4000/health**  
Agar `{"status":"ok"}` ya DB status dikhe to sab theek hai.

---

## 2. Migrations (agar SQL migrations use kar rahe ho)

Agar tumne **migrations** folder mein `.sql` files use ki hain (e.g. `001_initial_schema.sql`), to ek baar chala lo:

```bash
cd backend
node scripts/run-migrations.js
```

Sequelize **sync** already tables bana deta hai; migrations extra schema (constraints, indexes) ke liye.

---

## 3. Admin Panel chalao

- **Terminal (naya):**  
  ```bash
  cd admin_panel
  npm install
  npm run dev
  ```
- Browser: **http://localhost:5173** (ya jo port Vite dikhayega)
- Login: backend ke hisaab se (e.g. admin@tbidder.com / admin123 ya jo `.env` mein hai)

Admin panel **backend** ko `http://localhost:4000` par call karegi (Vite proxy). Sab data ab **AWS RDS** se aayega.

---

## 4. Driver App / User App (Flutter)

- **Local device/emulator** se backend use karne ke liye:
  - Emulator: usually `http://10.0.2.2:4000` (Android) ya `http://127.0.0.1:4000` (iOS sim) — code mein already ho sakta hai.
  - **Physical device:** backend ka IP chahiye (e.g. `http://192.168.1.5:4000`). Same WiFi par hona chahiye.
    ```bash
    flutter run --dart-define=BACKEND_URL=http://<tumhara-LAN-IP>:4000
    ```
- Jo bhi **BACKEND_URL** / base URL tum Flutter apps mein set karte ho, wahi backend use karega — aur backend ab **AWS RDS** use kar raha hai.

---

## 5. Security (recommended)

Abhi agar **Anywhere-IPv4** (0.0.0.0/0) Security Group mein add kiya hai **sirf test ke liye**, to production ke pehle:

- EC2 → **Security Groups** → **tbidder-db-sg** → **Edit inbound rules**
- **Anywhere-IPv4** wala rule **delete** karo
- Sirf **My IP** wala rule rakho (ya jis server se backend chalega uska IP)

---

## 6. Deploy (jab server par backend chalana ho)

- Backend jahan deploy karoge (e.g. EC2, Render, Railway), wahan **same `.env`** use karo: `PG_HOST`, `PG_USER`, `PG_PASSWORD`, `PG_SSL=true` (AWS RDS endpoint).
- Us server ka **public IP** Security Group **tbidder-db-sg** mein **Inbound rule** (PostgreSQL 5432) ke Source mein add karo — taaki sirf wahi server RDS se connect kar sake.

---

**Short:** Backend + RDS ready. Ab Admin Panel / Flutter apps chala kar test karo; migrations zaroorat ho to chala lo; Security Group mein test ke baad Anywhere-IPv4 hata kar My IP / server IP rakho.
