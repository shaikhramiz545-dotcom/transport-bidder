# Driver Wallet & Manual Recharge — Rules

This document describes the prepaid-credit wallet system for drivers. No auth, tour payments, or ride dispatch logic are changed.

---

## Conversion

- **1 Sol = 20 Credits** (on recharge).
- Ride completion deducts **1 credit per 1 Sol** of ride value (e.g. 10 Sol ride → 10 credits deducted).

---

## Flow

1. **Recharge** — Driver pays via bank/QR, uploads screenshot and transaction ID. A **WalletTransaction** is created with status `pending`.
2. **Admin approval** — Admin approves → credits added to **DriverWallet**, **WalletLedger** entry `type: recharge`, `approvedAt` set, `creditsValidUntil` extended 1 year from approval, `rejectedRechargeCount` reset to 0.
3. **Admin decline** — Admin declines with **mandatory reason** → no balance change; driver’s **rejectedRechargeCount** incremented.
4. **Mark Needs PDF** — Status set to `needs_pdf`; no balance change.

---

## Tables (PostgreSQL)

- **DriverWallet** — `driverId`, `balance`, `creditsValidUntil`, `lastRechargeAt`, `rejectedRechargeCount`.
- **WalletTransactions** — `driverId`, `amountSoles`, `creditsAmount`, `transactionId`, `screenshotUrl`, `status` (pending | approved | declined | needs_pdf), `adminNote`, `createdAt`, `approvedAt`.
- **WalletLedger** — Audit: `driverId`, `type` (recharge | deduction | expiry | adjustment), `creditsChange`, `refId`, `createdAt`.

All balance changes must write a **WalletLedger** row.

---

## Expiry

- Credits are valid for **1 year** from last **approval** (per recharge).
- **Expiry cron** (e.g. `node scripts/expire-wallet-credits.js`): for wallets where `creditsValidUntil < today` and `balance > 0`, create ledger entry `type: expiry`, `creditsChange: -balance`, then set `balance = 0`.

---

## Fraud protection

- If a driver has **3 or more** rejected recharges (`rejectedRechargeCount >= 3`), **new recharge requests are blocked** (403 `recharge_blocked`). Reset to 0 on next approval.

---

## Booking enforcement

- Before a driver can **accept** a ride, backend checks:
  - `creditsValidUntil >= today` (else 403 `EXPIRED`).
  - `balance >= estimatedFare` in credits (else 403 `LOW_CREDIT` or `NO_CREDIT`).
- Driver app must send **driverId** in `POST /api/rides/:id/accept` body for this check. On 403, app shows recharge dialog and link to Wallet.

---

## Ride completion

- On **complete**, backend deducts credits from **DriverWallet** (PostgreSQL) and creates **WalletLedger** `type: deduction`, `refId: rideId`. Firestore wallet is not used for this flow.

---

## Notifications (optional)

- Recharge approved — driver can see banner in Wallet.
- Low credit / expiry warning — shown in Driver app Wallet screen.

---

## Files

- Backend: `backend/src/routes/wallet.routes.js`, `admin.routes.js`, `rides.js`; `backend/src/models.js`; `backend/scripts/expire-wallet-credits.js`.
- Admin: **Finance** tab — Driver Payments: filters (status, date, driver), export CSV, detail modal, Approve / Reject (reason required) / Mark Needs PDF.
- Driver app: Wallet screen — balance, expiry, recharge form, history (last 20), low/zero credit warnings; accept-ride 403 → recharge dialog → Wallet.
