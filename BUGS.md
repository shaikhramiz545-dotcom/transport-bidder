# Phase 4 — Bugs Log

Bugs found during Phase 4 QA (Driver → Wallet → Ride, Postman tests).

---

## BUG-001 — Postman test script: JSON parse on errored response (FIXED)

- **Severity:** Low (test only)
- **Where:** Collection `4. Scenarios` → “Create ride (for 403 low-credit test)”
- **What:** When the request failed (e.g. ECONNREFUSED), the test script called `pm.response.json()` and threw **JSONError** (“undefined” is not valid JSON).
- **Repro:** Run collection with backend stopped; first request errors, then “Create ride (for 403 low-credit test)” test script fails with JSONError.
- **Fix:** Guard: only parse and set `scenarioRideId` when `pm.response.code === 201`. See FIXES.md.

---

## No backend/API bugs logged

- With backend running, Driver verification, Wallet (recharge, approve, balance), Ride (create, accept with driverId, complete), and scenario tests (403 NO_CREDIT, 400 for missing driverId, 400 for decline without reason, network failure) behave as designed.
- Expiry is covered by cron script + GET balance; no API bug identified.

---

## How to add bugs

- **Title:** BUG-XXX — Short description  
- **Severity:** Critical / High / Medium / Low  
- **Where:** File or endpoint  
- **What / Repro / Expected / Fix (if any)**
