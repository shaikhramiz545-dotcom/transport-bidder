# Control Panel – Testing & Change Log

**App:** TBidder Admin Panel (Firma ke hisaab se ready)  
**Folder:** `admin_panel` (project root ke andar, **backend ke andar nahi**)

**Important – Path:** Admin panel **project root** se chalana hai. Agar tum `backend` folder mein ho to pehle bahar aao.

- **Backend:** Project root se → `cd backend` → `npm start`
- **Admin panel:** Project root se → `cd admin_panel` → `npm install` (sirf pehli baar) → `npm run dev`

(Backend pehle chalana zaroori hai taaki login API kaam kare.)

**Admin login (filhaal):** `admin@tbidder.com` / `admin123`

---

## Firma scope (filhaal)

- **Firm name:** `TBidder` – `admin_panel/src/config/firm.js` se aata hai; baad mein Firma change hone par sirf yahi file update karni hogi.
- **Sidebar / Login / Dashboard:** Sab jagah firm title "TBidder Admin" / "TBidder Dashboard" use ho raha hai.
- **Backend admin API:** Login (admin credentials). Stats aur rides ab **DB se** — User app / Driver app se create hone wale rides control panel par Bookings mein dikhenge.
- **Features:** Sidebar aur har page ka title/description ab `firm.js` ke `FIRM_FEATURES` se aata hai. Jo features honge wo baad mein update karenge.

---

## Firma features (current) – baad mein update karenge

| # | Page | Path | Scope (filhaal) |
|---|------|------|------------------|
| 1 | Dashboard | `/dashboard` | Stats: online drivers, verifications, today’s rides, pending/total rides |
| 2 | Bookings | `/bookings` | List rides; ride detail & chat history |
| 3 | Dispatcher | `/dispatcher` | Manual booking interface (placeholder) |
| 4 | Verification Hub | `/verification-hub` | Approve driver documents & 360° vehicle videos (placeholder) |
| 5 | Finance | `/finance` | Wallet recharges — screenshots → credit balance (placeholder) |
| 6 | Agencies | `/agencies` | Manage fleet owners (placeholder) |
| 7 | Settings | `/settings` | Commission rates, push notifications (placeholder) |

**Config:** `admin_panel/src/config/firm.js` – yahan `FIRM_FEATURES` mein label, icon, description change karke sidebar aur page text update ho jata hai.

---

## Testing checklist

- [ ] Backend chal raha hai (`npm start` in `backend`)
- [ ] Admin panel opens (`npm run dev` in `admin_panel`)
- [ ] Login: `admin@tbidder.com` / `admin123` se sign in
- [ ] Dashboard: stats cards – real counts from DB (Online Drivers from driver app location, Today's Rides, Pending/Total from DB)
- [ ] Sidebar: Dashboard, Bookings, Dispatcher, Verification Hub, Finance, Agencies, Settings
- [ ] Bookings: list – rides created from User app / accepted from Driver app (DB); click row → ride detail + chat
- [ ] Ride detail: booking row click → ride detail page (agar koi ride nahi to list se hi check)
- [ ] Logout: header se Logout → login page par wapas
- [ ] Koi crash / blank page nahi

---

## Future changes log (jo changes honge wo yahan likhenge)

| # | Date       | Description / Change                    | Status   |
|---|------------|----------------------------------------|----------|
| 1 | (example)  | Connect real rides from DB in backend  | Pending  |
| 2 | (example)  | Firma name from env / multi-tenant     | Pending  |
| 3 |            |                                        | Open     |
| 4 |            |                                        | Open     |

*(Naye planned changes aane par is table mein row add karo: short description, status = Pending / In progress / Done.)*

---

## Bugs / issues found

| # | Description              | Where / Steps to reproduce     | Status |
|---|--------------------------|--------------------------------|--------|
| 1 |                          |                                | Open   |
| 2 |                          |                                | Open   |
| 3 |                          |                                | Open   |

*(Testing ke dauran jo bhi bug mile, yahan note karo. Fix hone par Status = Fixed.)*

---

## Notes

- Control panel ki testing **alag** hai – User app aur Driver app ki testing apni-apni files mein (USER_APP_TESTING.md, DRIVER_APP_TESTING.md).
- Firma-specific config: `admin_panel/src/config/firm.js`.

---

## User app / Driver app – Control panel se connection

**Ek hi backend** sab ke liye: User app, Driver app (Android/iOS), aur Control panel sab **backend** (port 4000) ko use karte hain. Jo rides User app se create hote hain aur Driver app se accept/complete hote hain, wohi data **Control panel → Bookings** mein dikhega.

- **Emulator / Web:** User app aur Driver app `localhost:4000` (web) ya `10.0.2.2:4000` (Android emulator) use karti hain — backend same machine pe chalana.
- **Physical Android/iOS device:** Device aur PC same Wi‑Fi pe hon. PC ka IP use karo (e.g. `http://192.168.1.5:4000`). Run:
  - User app: `flutter run --dart-define=BACKEND_URL=http://192.168.1.5:4000`
  - Driver app: `flutter run --dart-define=BACKEND_URL=http://192.168.1.5:4000`
  Control panel browser mein bhi isi backend ko hit karega (browser PC pe hai to `http://localhost:4000`; agar backend dusri machine pe hai to admin_panel ka API base URL bhi wahi set karna hoga).
