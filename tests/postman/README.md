# Phase 4 Postman Tests — Driver → Wallet → Ride

## Prerequisites

- Backend running: `cd backend && npm start` (default `http://127.0.0.1:4000`)
- PostgreSQL and migrations applied (wallet, driver verification, ledger)
- Admin credentials: `admin@tbidder.com` / `admin123` (or from env)

## Import

1. Open Postman → Import → **TBidder-Phase4-Driver-Wallet-Ride.json**
2. Set collection variable **baseUrl** if not using `http://127.0.0.1:4000`

## Run order (QA plan)

1. **0. Auth (Admin)** — get `adminToken`
2. **1. Driver Verification** — register driver, admin approve, status
3. **2. Wallet** — balance, recharge, admin list/approve, balance after
4. **3. Ride (Accept & Complete)** — create ride, accept (with driverId), arrived, start, complete, balance after
5. **4. Scenarios** — low credit (403), missing driverId (400), decline no reason (400), reject then approve, network failure
6. **5. Expiry** — balance for driver (expiry handled by cron script)

## Expiry test

- **Expiry** is tested by: run `node backend/scripts/expire-wallet-credits.js` for a wallet with `creditsValidUntil < today`, then GET balance → expect `balance: 0`, `isExpired: true`.
- Optional: create a driver wallet in DB with past `creditsValidUntil`, run expiry script, then call GET balance.

## Reupload simulation

- **Reupload**: Admin requests document reupload (reupload request in admin panel). Driver GET `verification-status` → `reuploadRequested` present. Driver POST `documents` (multipart) with new file. Run manually with a real file in Postman.

## Newman (CLI)

```bash
npm install -g newman
newman run tests/postman/TBidder-Phase4-Driver-Wallet-Ride.json --env-var baseUrl=http://127.0.0.1:4000
```
