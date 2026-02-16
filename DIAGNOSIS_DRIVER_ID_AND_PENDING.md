# Diagnosis: New Driver ID on Every App Open & ID Not Showing in App

**Date:** 2026-02-06  
**Scope:** No code changes — diagnosis only. Root cause and recommended fix.

---

## 1. Symptoms (User-Reported)

1. **Admin panel** shows new IDs (e.g. `d-5277220`, `d-2680972`).
2. **Driver app** does not show Driver ID in the drawer (or shows "Go online to get ID").
3. **Every time the app is opened**, a new request appears in the admin panel with a **new** Driver ID (new pending row).

---

## 2. Root Cause Analysis

### 2.1 Why does a NEW request appear every time the app is opened?

**Flow traced:**

1. **Verification screen** has `_ensureDriverId()` (in `verification_screen.dart`). It runs when the Verification screen loads.
2. **When `driver_on_duty_id` is EMPTY** in SharedPreferences (first launch, cleared data, or Flutter web with different origin/session/incognito):
   - `_ensureDriverId()` calls **POST `/api/drivers/location`** with body:
     ```json
     { "lat": 0, "lng": 0, "vehicleType": "car" }
     ```
   - **No `driverId` is sent** in the body.
3. **Backend** (`drivers.js`):
   - `POST /api/drivers/location` uses: `const id = driverId || generateShortDriverId();`
   - So when the client does not send `driverId`, the server **generates a new short ID** (e.g. `d-1234567`) every time.
4. Verification screen then **saves** this new ID: `await prefs.setString(_kDriverIdKey, id);`
5. **Then** `_fetchVerificationStatus()` runs. It calls **POST `/api/drivers/verification-register`** with that new `driverId`.
6. Backend **findOrCreate** on `DriverVerification` for that `driverId` → a **new row** is created in the database with status `pending` → admin panel shows a **new** pending request.

**So:** Whenever the app is opened in a context where **SharedPreferences has no `driver_on_duty_id`** and the user (or default route) hits the **Verification** flow, a **new** ID is created and a **new** pending verification row is created.  
This happens every time if:
- User clears app data/cache between sessions, or
- Flutter **web**: different port/origin or session storage clears between runs, or
- User opens Verification **before** ever going online (so Home never got a chance to persist an ID from location ping).

**Conclusion:** The **Verification screen** is the main trigger: it **creates a new driver ID** via POST `/location` when prefs is empty, then **registers** that ID via verification-register → new admin row every time under the conditions above.

---

### 2.2 Why doesn’t the Driver ID show in the app (drawer)?

**Flow traced:**

1. **Home screen** sets `_driverId` only in **`_loadDriverId()`**, which runs **once** in **`initState`**.
2. At that moment, if SharedPreferences has **no** `driver_on_duty_id`, then `_driverId` stays **null** and the drawer shows "Go online to get ID".
3. If the user then opens **Verification**, `_ensureDriverId()` may create a **new** ID and **save it to SharedPreferences**.
4. When the user goes **back to Home**, Home’s **`_driverId` is not refreshed** — Home does not re-read SharedPreferences when returning from another screen. So the drawer **still** shows "Go online to get ID" even though prefs now has an ID.
5. The **admin panel** already shows the new ID (from the new row). So: panel has new ID, app drawer does not, until the app is **restarted** (so Home’s `initState` runs again and loads the saved ID).

**Conclusion:** **Home only loads `_driverId` once at startup.** It does not refresh when the user returns from Verification (or any other screen). So if the ID was obtained later (e.g. in Verification), the drawer does not show it until the next app start.

---

### 2.3 Why does the panel show “old” IDs?

The admin panel lists all rows in **DriverVerification**. Existing rows keep their existing `driverId` (old long format or previously generated short IDs). New rows get new short IDs. So the panel can show a mix of “purani” and “nayi” IDs; “purani” here means **already existing** rows, not a bug in display.

---

## 3. Summary Table

| Issue | Root cause |
|-------|------------|
| New request on every app open | Verification’s `_ensureDriverId()` calls POST `/location` **without** `driverId` when prefs is empty → backend generates new ID → then verification-register creates a new pending row. Repeated when prefs is empty on each open (e.g. cleared storage, web session). |
| Driver ID not showing in app | Home sets `_driverId` only in `_loadDriverId()` in `initState`. It never re-reads prefs when coming back from Verification, so an ID saved later in Verification is not shown until app restart. |
| Panel shows old IDs | Panel shows all DB rows; old rows keep old IDs. Not a bug. |

---

## 4. Recommended Fix (One-Time, No New Problems)

### 4.1 Stop creating a new ID from Verification when prefs is empty

- **Do NOT** call POST `/api/drivers/location` from Verification just to “get an ID” when prefs is empty.
- **Instead:** If prefs has no `driver_on_duty_id`, show a clear message: e.g. “Go online first to get your Driver ID”, and **do not** call `/location` or `/verification-register` until the user has gone online at least once (so the ID is created once from **Home** when they tap “Go Online” and the location ping runs with `driverId: null` → backend returns one new ID → Home saves it).
- Optionally: only allow document upload / verification flow when `driverId` is already present (after going online once). This way **only one** ID is ever created per device/session (from the first “Go Online”), and no new pending row is created just by opening the app or Verification.

### 4.2 Persist and reuse the same ID from “Go Online”

- Keep current behaviour: when the user goes **online** from Home, **POST `/api/drivers/location`** is called (with or without `driverId`). If backend returns a `driverId`, Home already saves it with `prefs.setString(_kDriverIdKey, id)`. So the **only** place that should create a new ID is this first “Go Online” from Home, and that ID should be reused for all later calls (verification-register, documents, wallet, etc.).
- Ensure **Verification** (and any other screen) **never** calls POST `/location` with an empty body just to obtain an ID. Remove or bypass `_ensureDriverId()`’s call to `/location` when prefs is empty; instead rely on “Go online first” and the ID from Home.

### 4.3 Show Driver ID in the app (drawer) even when obtained later

- When **returning to Home** (e.g. `Navigator.pop` or when the drawer is opened), **re-load** `driver_on_duty_id` from SharedPreferences and update `_driverId` so the drawer shows the current ID (e.g. the one just saved from Verification if we ever allowed it, or the one from Go Online). Alternatively, re-load from prefs in the drawer’s build or when the drawer is opened, so the Driver ID is always up to date without requiring a full app restart.

---

## 5. Files Involved (for implementation)

| Component | File | Change (conceptual) |
|-----------|------|----------------------|
| Backend | `backend/src/routes/drivers.js` | No change required for diagnosis. Already: no driverId → generate short ID; verification-register creates/finds row. |
| Driver app – Verification | `driver_app/lib/features/verification/verification_screen.dart` | **Stop** calling POST `/location` when prefs is empty. Show “Go online first to get your Driver ID” and do not call verification-register until driverId exists (from Home). |
| Driver app – Home | `driver_app/lib/features/home/home_screen.dart` | When the drawer is opened or when the route resumes, **re-read** `driver_on_duty_id` from SharedPreferences and update `_driverId` so the drawer shows the current ID. |

---

## 6. Risk and Safety

- **No API contract change:** We only change when the app calls existing APIs (do not call `/location` from Verification when prefs is empty).
- **No new backend APIs.**  
- **No auth/payment/ride logic change.**  
- **Result:** One driver ID per device/session (from first “Go Online”), no new pending row on every app open, and the app drawer shows the Driver ID after going online (and when returning to Home) without needing a full restart.

---

*This is a diagnosis document only. Implementation should follow the recommended fix above.*
