# TBidder API Status

Quick reference for API health and main endpoints. For full route list, see backend `src/routes/` and `GET /health` (or `/api/health`).

---

## Base URL

- **Local:** `http://127.0.0.1:4000` (or `PORT` from env)  
- **Driver app (Android emulator):** `http://10.0.2.2:4000`  
- **Admin panel:** Proxied via Vite to `/api` when `VITE_API_URL` not set  

---

## Health & status

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/` | GET | No | API name and version |
| `/health` | GET | No | Basic health |
| `/api/health` | GET | No | Same as above |
| `/api/admin/health-status` | GET | Admin JWT | TBidder Health: DB, Firestore, Places, Directions, internal APIs, stats |

---

## Driver app

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/drivers/location` | POST | No | Report location (body: driverId, lat, lng, vehicleType). Blocked if not approved. |
| `/api/drivers/offline` | POST | No | Go offline (body: driverId) |
| `/api/drivers/verification-status` | GET | No | Query: driverId. Returns status, blockReason. **Source: PostgreSQL first, then Firestore.** |
| `/api/drivers/verification-register` | POST | No | Body: driverId, vehiclePlate?, driverName?, vehicleType?. Register/update profile; duplicate plate → temp_block. |
| `/api/drivers/documents` | POST | No | Multipart: file, driverId, documentType. Upload one verification doc. |
| `/api/drivers/documents` | GET | No | Query: driverId. List uploaded documents. |
| `/api/drivers/requests` | GET | No | Query: driverId. Pending ride requests (only if driver approved). |
| `/api/drivers/nearby` | GET | No | Query: lat, lng, radiusKm. Count drivers in radius. |

---

## Admin panel

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/admin/login` | POST | No | Body: email, password. Returns JWT. |
| `/api/admin/stats` | GET | Admin JWT | Dashboard counts, income, drivers by vehicle, live list. |
| `/api/admin/drivers` | GET | Admin JWT | List drivers (PG, Firestore fallback). |
| `/api/admin/drivers/:id` | GET | Admin JWT | Single driver detail. |
| `/api/admin/drivers/:id/verify` | POST | Admin JWT | Body: status (approved\|rejected\|temp_blocked\|suspended), blockReason?. Syncs to Firestore. |
| `/api/admin/travel-agencies` | GET | Admin JWT | List agencies. Query: ?status=… Returns verificationNote, toursCount, balance. |
| `/api/admin/travel-agencies/:id` | GET | Admin JWT | Agency detail + documents. |
| `/api/admin/travel-agencies/:id/verify` | POST | Admin JWT | Approve / reject / request_documents. |
| `/api/admin/rides` | GET | Admin JWT | List rides. |
| `/api/admin/wallet-transactions` | GET | Admin JWT | List wallet transactions. Query: `status`, `from`, `to`, `driverId`. |
| `/api/admin/wallet-transactions/:id/approve` | POST | Admin JWT | Approve recharge (body: creditsAmount optional). Adds credits, ledger, extends validity 1y. |
| `/api/admin/wallet-transactions/:id/decline` | POST | Admin JWT | Decline recharge; body **adminNote required**. Increments rejectedRechargeCount. |
| `/api/admin/wallet-transactions/:id/needs-pdf` | POST | Admin JWT | Set status needs_pdf. |
| `/api/admin/health-status` | GET | Admin JWT | Full health check. |
| `/api/admin/health-history` | GET | Admin JWT | Last 7 days health history. |

---

## User app / Rides

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/rides` | POST | No | Create ride (body: pickup, drop, vehicleType, etc.). |
| `/api/rides/:id` | GET | No | Ride detail. |
| `/api/rides/:id/accept` | POST | No | Driver accepts. Body: **driverId** (required for wallet check), driverPhone?. On low/expired credits: **403** `code: LOW_CREDIT \| NO_CREDIT \| EXPIRED`, `message`. |
| `/api/rides/:id/complete` | POST | No | Driver completes. Deducts credits from PG DriverWallet and writes WalletLedger (deduction). |

---

## Wallet (driver)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/wallet/balance` | GET | No | Query: driverId. Effective balance (0 if expired), creditsValidUntil. |
| `/api/wallet/transactions` | GET | No | Query: driverId. Last 50 transactions. |
| `/api/wallet/recharge` | POST | No | Body: driverId, amountSoles, transactionId, screenshotUrl. Blocked if rejectedRechargeCount >= 3 (403 recharge_blocked). |

---

## Tours / Agency (partner)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/agency/signup` | POST | No | Partner signup. |
| `/api/agency/me` | GET | Agency JWT | Current agency. |
| `/api/agency/documents` | POST | Agency JWT | Multipart: file, documentType. Upload verification doc. |
| `/api/agency/verification-status` | GET | Agency JWT | Status and documents. |
| `/api/tours` | GET | No | List tours (public). |
| `/api/tours/bookings` | POST | No | Create tour booking. |

---

## Uploads

- **Driver docs:** `POST /api/drivers/documents` (multipart). Stored under `uploads/driver-docs/{driverId}/`. Served at `/uploads/driver-docs/...`.  
- **Agency docs:** `POST /api/agency/documents` (multipart). Stored under `uploads/agency-docs/{agencyId}/`.  
- **Tour media:** `POST /api/agency/upload` is **disabled** (410). Media is preview-only.

---

## Error responses

- **400** — Bad request (e.g. missing driverId, invalid documentType).  
- **401** — Unauthorized (missing or invalid token).  
- **403** — Forbidden (e.g. driver not approved for Go Online).  
- **404** — Not found (e.g. driver or ride not found).  
- **500** — Internal server error. Body: `{ error: 'Internal server error', message?: string }`.

All list endpoints return empty arrays `[]` or `{ agencies: [] }` etc. on DB/backend errors when a fallback is implemented, so the UI can still load.
