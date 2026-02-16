# Payment System – TBidder

## Overview

| Module | Payment Type | Gateway | Payout |
|--------|--------------|---------|--------|
| **Driver (Rides)** | Prepaid credits (recharge) | Manual (admin approve) | ❌ No – drivers collect cash from users |
| **Tours** | Online payment | dLocal Go | ✅ Yes – Travel agencies receive earnings |

---

## 1. Driver Wallet (Prepaid)

- Driver pays cash → uploads screenshot → Admin approves → Credits added
- Ride complete → **Credits deducted** (1 Credit = 1 Sol of ride value)
- No payout to drivers (user pays driver directly)

### APIs
- `GET /api/wallet/balance?driverId=xxx`
- `POST /api/wallet/recharge` – submit request
- Admin: `POST /api/admin/wallet-transactions/:id/approve`

---

## 2. Tour Payments (dLocal Go)

### dLocal Go – Kya Chahiye?

**Dono keys chahiye:** `API Key` + `Secret Key`

- Sandbox: https://dashboard-sbx.dlocalgo.com → Integrations → API Integration
- Live: https://dashboard.dlocalgo.com → Integrations → API Integration

### .env Variables

```
DLOCAL_API_KEY=your_api_key
DLOCAL_SECRET_KEY=your_secret_key
DLOCAL_SANDBOX=true   # false for live
API_BASE_URL=https://api.yourdomain.com   # For webhook + redirect URLs
```

### Flow

1. User books tour → `POST /api/tours/bookings` with guest details
2. Backend creates booking, calls dLocal → returns `redirectUrl`
3. User pays on dLocal checkout page
4. dLocal sends webhook to `POST /api/tours/bookings/webhook`
5. On PAID: booking → paid, slot bookedPax++, agency wallet credited (after 15% commission)

### APIs
- `POST /api/tours/bookings` – Create booking + get payment redirect
- `POST /api/tours/bookings/webhook` – dLocal notification (do not call manually)
- `GET /api/tours/bookings/:id` – Booking detail

---

## 3. Travel Agency Payout

- Agency earns from paid tour bookings (85% after 15% commission)
- Balance shown in Agency Wallet
- Agency requests payout → Admin processes via bank transfer

### Agency APIs
- `GET /api/agency/wallet` – Balance
- `POST /api/agency/payout-request` – Request withdrawal
- `GET /api/agency/payout-requests` – List requests
- `GET /api/agency/bookings` – My tour bookings

### Admin APIs
- `GET /api/admin/agency-payouts` – List payout requests
- `POST /api/admin/agency-payouts/:id/complete` – Mark paid
- `POST /api/admin/agency-payouts/:id/reject` – Reject + refund to agency wallet

---

## Commission

- **Tours:** 15% (configurable via Admin Settings)
- **Driver recharge:** Per wallet.js (1 Sol = 20 credits)
