# TBidder Changelog

All notable changes to the TBidder platform are documented here. No file deletion unless explicitly approved.

---

## [Unreleased]

### Phase 3 — Driver Wallet & Manual Recharge

- **Backend — Wallet & payments**
  - **DriverWallet**: `lastRechargeAt`, `rejectedRechargeCount`; **WalletTransactions**: `approvedAt`; **WalletLedger** table for audit (recharge, deduction, expiry, adjustment).
  - Approve: add credits, extend `creditsValidUntil` 1 year, write ledger, set `approvedAt`, reset `rejectedRechargeCount`. Decline: mandatory `adminNote`, increment `rejectedRechargeCount`. Recharge blocked when `rejectedRechargeCount >= 3` (403 `recharge_blocked`).
  - **Booking enforcement**: `POST /api/rides/:id/accept` checks DriverWallet (balance ≥ estimated fare, not expired); returns 403 `EXPIRED` / `LOW_CREDIT` / `NO_CREDIT` with message when driver sends `driverId`.
  - **Ride complete**: Deduct credits from PostgreSQL DriverWallet and write WalletLedger `deduction` (no Firestore wallet for this flow).
  - **Expiry cron**: `node backend/scripts/expire-wallet-credits.js` — zeroes balance and writes ledger `expiry` for wallets past `creditsValidUntil`.
  - **Admin**: `GET /api/admin/wallet-transactions` supports `?status=&from=&to=&driverId=`; decline requires `adminNote`.

- **Admin panel — Driver Payments (Finance tab)**
  - Filters: status, date range, driver ID. Export CSV. Detail modal: screenshot, amount, driver, credits, txn ID, status, admin note; Approve / Reject (reason required) / Mark Needs PDF.
  - Status column and badges (pending, approved, declined, needs_pdf).

- **Driver app**
  - Wallet screen: header with balance and expiry date; low/zero credit warnings; "Verify Payment" form; history last 20; bank details + Copy; QR placeholder.
  - Accept ride: sends `driverId` in accept body; on 403 with `LOW_CREDIT`/`NO_CREDIT`/`EXPIRED` shows recharge dialog with link to Wallet.

- **Docs**: `WALLET_RULES.md` (new), `API_STATUS.md` and `CHANGELOG.md` updated.

---

### Phase 1 — System Stability (Current)

#### Backend

- **Verification sync (admin ↔ driver)**  
  - `GET /api/drivers/verification-status` and driver "Go Online" now prefer **PostgreSQL** as source of truth, then Firestore.  
  - Admin approve/reject/suspend in the Control Panel is reflected immediately in the driver app.

- **Admin travel-agencies API**  
  - Merged duplicate `GET /api/admin/travel-agencies` into a single route.  
  - Supports `?status=pending|approved|rejected|needs_documents` and returns `toursCount`, `balance`, `balanceCurrency`, and `verificationNote` for both verification and payout use.

- **Driver document upload**  
  - New table: `DriverDocuments` (driverId, documentType, fileUrl, fileName).  
  - `POST /api/drivers/documents` — multipart upload (file, driverId, documentType).  
  - `GET /api/drivers/documents?driverId=xxx` — list uploaded docs.  
  - Allowed types: `brevete_frente`, `brevete_dorso`, `dni`, `selfie`, `soat`, `tarjeta_propiedad`, `foto_vehiculo`.  
  - Files stored under `uploads/driver-docs/{driverId}/`.  
  - Run `npm run migrate` in `backend/` to apply `008_driver_documents.sql`.

- **Error handling**  
  - Central Express error handler returns consistent JSON on 500.  
  - 404 for unknown `/api/*` paths returns `{ error: 'Not found', path }`.

#### Driver app (Flutter)

- **Verification screen**  
  - On "Submit for review", the app now **uploads each selected document** to `POST /api/drivers/documents` before calling `verification-register`.  
  - Documents are stored in `_docFiles` (XFile) so bytes can be sent via multipart.  
  - If any upload fails, the user sees an error and submit stops.

#### Not modified (per global rules)

- Authentication  
- Payments (DLocalGo, Wallet, Payouts)  
- Ride dispatch logic  
- Booking logic  

---

## How to report

After each change set:

- **What changed** — see above.  
- **Files modified** — see git diff.  
- **Risks** — New driver document upload depends on backend migration and `uploads/driver-docs` directory creation (automatic on first upload).  
- **Next recommendation** — Proceed to Phase 2 (Driver Verification 3-step flow hardening) and Phase 3 (Admin Drivers module with document gallery).
