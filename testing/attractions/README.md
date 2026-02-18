# Attractions / Tours Module – Testing Guide

Testing folder for the Attractions module. Use this to verify APIs and flows.

## Prerequisites

1. Backend running: `cd backend && npm start`
2. PostgreSQL connected (check `.env`)

## API Base URL

```
http://localhost:4000/api
```

---

## 1. Feature Flag

**Check if Attractions is enabled (default ON):**
```bash
curl http://localhost:4000/api/tours/feature-flag
```
Expected: `{ "attractionsEnabled": true }`

---

## 2. List Tours

**Empty list (no tours yet):**
```bash
curl http://localhost:4000/api/tours
```

**Ticker messages (main screen bottom banner):**
```bash
curl http://localhost:4000/api/tours/ticker-messages
```
Returns shuffled messages for scrolling banner. Includes "Free cancellation – You'll receive a full refund..."

**Response includes `flags` (1–3 per tour):**
- `booked_yesterday` – "Booked X times yesterday"
- `most_selling` – "#1 selling" / "#2 selling"
- `top_rated` – "Top rated" (5+ reviews, avg ≥ 4.5)
- `new_arrival` – "New arrival" (created within 14 days)

**Also:** `freeCancellation` (boolean), `freeCancellationHours` (e.g. 24). Show "Free cancellation" badge when true.

**Sort:** Revenue-based (highest first). Zero-revenue tours sorted by `createdAt` (newest first).

**With filters (country, city, category, search):**
```bash
curl "http://localhost:4000/api/tours?country=PE"
curl "http://localhost:4000/api/tours?city=Lima"
curl "http://localhost:4000/api/tours?category=cultural"
curl "http://localhost:4000/api/tours?q=Machu"
```

---

## 3. Tour Detail

**Get single tour (replace :id with actual tour ID):**
```bash
curl http://localhost:4000/api/tours/1
```

---

## 4. Admin – Feature Flag Toggle

**Login first:**
```bash
curl -X POST http://localhost:4000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tbidder.com","password":"admin123"}'
```
Copy the `token` from response.

**Get feature flags:**
```bash
curl http://localhost:4000/api/admin/feature-flags \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Turn OFF Attractions:**
```bash
curl -X POST http://localhost:4000/api/admin/feature-flags \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"attractionsEnabled":false}'
```

**Turn ON Attractions:**
```bash
curl -X POST http://localhost:4000/api/admin/feature-flags \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"attractionsEnabled":true}'
```

---

## 5. Seed Sample Tour (Optional)

Run seed script **from backend folder** (so sequelize/pg load correctly):

```bash
cd backend
npm run seed:attractions
```

Or manually:
```bash
cd backend
node ../testing/attractions/seed-sample-tour.js
```

Then:
- `GET /api/tours` – should return 1 tour
- `GET /api/tours/1` – should return full detail

---

## Categories (Reference)

| Value        | Label      |
|-------------|------------|
| full_day    | Full Day   |
| night_tour  | Night Tour |
| adventure   | Adventure  |
| cultural    | Cultural   |
| family      | Family     |

---

## 6. Agency Portal (Phase 3)

**Seed test agency (login: test@agency.com / test123):**
```bash
cd backend
npm run seed:agency
```

**Run agency portal:** `cd agency_portal && npm run dev` (port 5174)

**Signup:** http://localhost:5174/login → "Sign up" → Create account

**Login:** Use seeded credentials or your signup

---

## 7. Admin Tours (Phase 2)

**List tours (requires admin login):**
```bash
# Login first, then:
curl http://localhost:4000/api/admin/tours \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Filter by status:**
```bash
curl "http://localhost:4000/api/admin/tours?status=pending" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Approve/Reject/Suspend:**
```bash
curl -X POST http://localhost:4000/api/admin/tours/1/approve \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Checklist

- [ ] Feature flag returns `attractionsEnabled: true`
- [ ] List tours returns empty array (or seeded tours)
- [ ] Tour detail returns 404 for non-existent ID
- [ ] Admin can toggle feature flag
- [ ] When flag OFF, list returns empty + message
- [ ] Search by city/country works
- [ ] Categories filter works
