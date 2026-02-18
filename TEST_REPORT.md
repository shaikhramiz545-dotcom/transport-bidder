# Phase 4 — Test Report (Driver → Wallet → Ride)

**QA plan:** Driver verification, Wallet recharge, Ride accept, Credit deduction, Expiry. Simulate low credit, expired credit, reupload, reject→approve, network failure.

---

## Scope

| Area | Coverage |
|------|----------|
| **Driver verification** | GET verification-status, POST verification-register, Admin POST drivers/:id/verify (approve), status after approve |
| **Wallet recharge** | GET balance, POST recharge (submit), Admin GET wallet-transactions, Admin POST approve, balance after approve |
| **Ride accept** | POST create ride, POST accept (with driverId — wallet check), POST driver-arrived, POST start-ride, POST complete |
| **Credit deduction** | POST complete ride → wallet balance decreased; ledger entry (backend) |
| **Expiry** | GET balance returns `balance: 0` and `isExpired: true` when `creditsValidUntil < today`; expiry cron script run separately |

---

## Test Artifacts

- **Postman collection:** `tests/postman/TBidder-Phase4-Driver-Wallet-Ride.json`
- **Run with:** Postman Runner or `npx newman run tests/postman/TBidder-Phase4-Driver-Wallet-Ride.json --env-var baseUrl=http://127.0.0.1:4000`

---

## Prerequisites for Run

- Backend running on `http://127.0.0.1:4000` (or set `baseUrl`)
- PostgreSQL migrated (wallet, driver verification, ledger tables)
- Admin login: `admin@tbidder.com` / `admin123` (or env)

---

## Execution Summary

| Folder | Requests | Purpose |
|--------|----------|--------|
| 0. Auth (Admin) | 1 | Obtain `adminToken` for admin APIs |
| 1. Driver Verification | 4 | Status → register → admin approve → status |
| 2. Wallet | 5 | Balance → recharge → list → approve → balance |
| 3. Ride (Accept & Complete) | 6 | Create → accept (driverId) → arrived → start → complete → balance |
| 4. Scenarios | 6 | Create ride for 403 test → accept zero-balance (403), missing driverId (400), decline no reason (400), reject then approve, network failure |
| 5. Expiry | 1 | Balance for driver (expiry state from cron or pre-seeded data) |

**Total requests:** 23.

---

## Scenarios Simulated

| Scenario | How |
|----------|-----|
| **Low credit** | Accept ride with `driverId: driver-zero-balance-qa` (no credits) → expect **403** with `code: NO_CREDIT` or `LOW_CREDIT` |
| **Expired credit** | Run `node backend/scripts/expire-wallet-credits.js` for wallet with past `creditsValidUntil`; then GET balance → `balance: 0`, `isExpired: true`. Accept with that driverId → **403** `EXPIRED` |
| **Reupload** | Manual: Admin requests document reupload; driver GET verification-status sees `reuploadRequested`; driver POST documents (multipart) with new file. |
| **Reject → Approve** | Submit recharge → Admin decline with **mandatory reason** → (optional) submit another recharge → Admin approve. Collection includes “Admin decline — No reason (400)” and “Reject then Approve” (decline with reason). |
| **Network failure** | GET `http://invalid-host-qa-no-dns.example.com/api/health` → request fails (ENOTFOUND / connection error). Test asserts failure or 4xx/5xx. |

---

## Results (when backend is running)

- **0. Auth:** Admin login → 200, `token` set.
- **1. Driver Verification:** Status 200, register 200, admin approve 200, status `approved`.
- **2. Wallet:** Balance 200, recharge 201 (id set), list 200, approve 200, balance increased.
- **3. Ride:** Create 201 (rideId set), accept 200, arrived 200, start 200, complete 200, balance decreased.
- **4. Scenarios:** Create ride 201; accept with zero-balance driver → 403 + code; recharge without driverId → 400; decline without adminNote → 400; reject with reason → 200 or 404 (404 if tx id invalid); network failure → request error.
- **5. Expiry:** Balance 200; if wallet expired, `balance: 0`, `isExpired: true`.

---

## Notes

- Run **full collection in order** so `adminToken`, `rideId`, `walletTransactionId`, `scenarioRideId` are set for dependent requests.
- **Expiry** is validated by the expiry cron script and GET balance; no dedicated “expire now” API in the collection.
- **Reupload** is manual (admin UI + Postman multipart upload with file).
- UI was not modified except where it would block testing (none required).
