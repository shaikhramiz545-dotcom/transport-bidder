# Phase 4 — Fixes Log

Fixes applied during or after Phase 4 QA. UI not changed unless it blocked testing.

---

## FIX-001 — Postman: “Create ride (for 403 low-credit test)” script

- **Issue:** Test script called `pm.response.json()` even when the request errored (e.g. ECONNREFUSED), causing **JSONError** in test-script and failing the run.
- **Change:** In `tests/postman/TBidder-Phase4-Driver-Wallet-Ride.json`, the test for “Create ride (for 403 low-credit test)” now:
  - Asserts status 201 as before.
  - Only parses JSON and sets `scenarioRideId` when `pm.response.code === 201`, inside a try/catch to avoid throwing on parse errors.
- **Result:** When backend is down, the request still errors but the script no longer throws; when backend is up and returns 201, `scenarioRideId` is set for the next request (Ride accept with zero-balance driver).

---

## No production code fixes in this phase

- No changes to backend routes, driver app, or admin panel for Phase 4 testing.
- Only test artifact (Postman collection) was updated.
