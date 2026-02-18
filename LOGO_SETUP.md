# TBidder Logo – Kahan Copy Karein

TransportBidder (TB) logo – **orange T, white B, tagline "YOUR RIDE-YOUR PRICE"** – ko teeno apps mein use kiya gaya hai. Logo file ko yeh jagah par copy karo:

---

## 1. User app (Flutter)

- **Path:** `user_app/assets/logo.png`
- **Jagah:** Login screen (upar), Home app bar (title), Drawer header (menu ke upar)
- Agar `logo.png` nahi hai to "TBidder" text fallback dikhega.

---

## 2. Driver app (Flutter)

- **Path:** `driver_app/assets/logo.png`
- **Jagah:** Login screen (upar), Drawer header (menu ke upar)
- Agar `logo.png` nahi hai to "TBidder Partner" / "TBidder" text fallback dikhega.

---

## 3. Admin panel (React/Vite)

- **Path:** `admin_panel/public/logo.png`
- **Jagah:** Login page (card ke upar), Sidebar (brand), Browser favicon
- Agar `logo.png` nahi hai to text "TBidder Admin" fallback dikhega.

---

## Logo file kahan se milegi

Jo logo image aapne share ki thi (TB + "YOUR RIDE-YOUR PRICE"), usi ko **logo.png** naam de kar upar diye paths par copy karo.  
Agar image Cursor ke workspace storage mein hai to us path se copy karke in teeno jagah paste karo:

- `user_app/assets/logo.png`
- `driver_app/assets/logo.png`
- `admin_panel/public/logo.png`

---

## Optional: Web favicon (User / Driver app)

- **User app:** `user_app/web/favicon.png` – is file ko logo se replace karo agar app ka favicon bhi logo jaisa chahiye.
- **Driver app:** `driver_app/web/favicon.png` – same.

Iske baad `flutter build web` se build karo; favicon update ho jayega.
