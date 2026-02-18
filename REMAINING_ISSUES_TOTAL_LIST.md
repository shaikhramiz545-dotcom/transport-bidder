# TBidder – Total Issues List (Remaining / Open)

**Last updated:** 2026-02-06

---

## 1. Is session mein fix ho chuke (reh gaye = 0)

| # | Issue | Status |
|---|--------|--------|
| 1 | Admin Users page blank (`/admin-users`) | ✅ Fixed – merge conflict se import wapas add kiya |
| 2 | Admin Users – dark panel par black-on-black text (title, labels, permissions) | ✅ Fixed – text white kar diya, inputs light background |

**Is session ke hisaab se koi issue reh gaya nahi.**

---

## 2. Project docs ke hisaab se – Production / Driver ID (RESOLVED_VS_REMAINING.md)

| # | Issue | Status |
|---|--------|--------|
| 1–4 | Upload when Pending, Admin approved but Pending, Recharge on Pending, Map zoom on drawer | ✅ Resolved |
| 5–6 | Har open par nayi ID, Driver ID drawer mein nahi | ✅ Resolved |
| 7 | Panel me purani ID / bahut saari IDs | ⚪ Not a bug (panel shows DB rows) |
| 8 | Postman test script JSON on failed response | ✅ Resolved |

**Yahan bhi koi open bug nahi.**

---

## 3. Testing files mein logged bugs (open)

- **USER_APP_TESTING.md:** Sab listed bugs Fixed/Noted – koi Open nahi.
- **DRIVER_APP_TESTING.md:** Sab Fixed/Noted – koi Open nahi.
- **CONTROL_PANEL_TESTING.md:** 3 empty rows (placeholder) – abhi koi real bug log nahi hua.

---

## 4. Known limitations / future work (PROJECT_AUDIT, BUGS.md, etc.)

Ye “bugs” nahi, balki incomplete features ya env/infra baatein hain:

| # | Item | Type | Notes |
|---|------|------|--------|
| 1 | **User app – real login** | Feature | Email/password form hai, backend auth API call nahi; sirf “Skip for testing” se home. |
| 2 | **Create Account (user)** | Feature | “Coming soon” snackbar; registration flow nahi. |
| 3 | **Real OTP (SMS)** | Feature | Abhi mock OTP (1234); SMS send nahi. |
| 4 | **OTP validation (ride start)** | Feature | Backend pe optional; strict validate nahi. |
| 5 | **Push notifications** | Feature | FCM/APNs integrate nahi; in-app polling/siren hi. |
| 6 | **User wallet / recharge** | Feature | User app wallet screen placeholder; backend flow incomplete. |
| 7 | **Finance (admin) – recharge** | Feature | Recharge requests list stub; approve/credit flow implement karna baaki. |
| 8 | **Agencies (admin)** | Feature | Backend `[]` return; CRUD / fleet owners baaki. |
| 9 | **Database (RDS) timeout** | Infra/Env | RDS ETIMEDOUT – security group / local PG / .env check. |
| 10 | **Auth fail jab DB down** | Infra | Driver login 500 – DB connection pe depend. |
| 11 | **Google Map buttons (zoom/compass)** | Limitation | Map iframe ke andar; plugin se hide nahi ho paate (WEB_MAP_ISSUES.md). |
| 12 | **Agency / Corporate portal** | Future | Sirf `.gitkeep`; build nahi. |

---

## 5. Short summary

| Category | Count |
|----------|--------|
| Is session ke fixes (reh gaye) | **0** |
| Production / Driver ID open bugs | **0** |
| Testing files mein open bugs | **0** |
| Known limitations / future work | **12** (features + infra, bugs nahi) |

**Net:** Ab koi **open bug** list mein nahi bacha. Jo 12 items hain wo **incomplete features** ya **infra/env** points hain, jo baad mein implement ya fix kiye ja sakte hain.

Agar koi naya bug mile to:
- User app → `USER_APP_TESTING.md`
- Driver app → `DRIVER_APP_TESTING.md`
- Admin panel → `CONTROL_PANEL_TESTING.md`  
mein add karo, phir is list ko update kar sakte ho.
