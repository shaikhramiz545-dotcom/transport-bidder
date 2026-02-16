# Tbidder Backend

Node.js + Express + Socket.io + PostgreSQL.

## Setup

1. **Create PostgreSQL database:**

   ```bash
   psql -U postgres -c "CREATE DATABASE tbidder;"
   ```

2. **Environment:**

   ```bash
   cp .env.example .env
   # Edit .env with your PG_HOST, PG_USER, PG_PASSWORD, etc.
   ```

3. **Install dependencies:**

   ```bash
   npm install
   ```

   If `npm install` fails with cache errors, try: `npm install --prefer-online`

4. **Run migrations** (creates tables):

   ```bash
   npm run migrate
   ```

5. **Start the API:**

   ```bash
   npm run dev
   ```

- **API:** `http://localhost:4000`
- **Health:** `http://localhost:4000/health`
- **Socket.io:** same origin, default path `/socket.io`

## Auth API

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | `{ "phone_number": "...", "role": "user" \| "driver" }` | Upsert user, return mock OTP (dev: `1234`) |
| POST | `/api/auth/verify` | `{ "phone_number": "...", "otp": "1234" }` | Validate OTP, return JWT + user |

Set `JWT_SECRET` in `.env` for production.

## Project structure

```
backend/
├── migrations/           # SQL migrations
│   └── 001_initial_schema.sql
├── scripts/
│   └── run-migrations.js
├── src/
│   ├── config/          # env, db pool
│   ├── routes/          # REST routes
│   ├── app.js           # Express app
│   └── server.js        # HTTP + Socket.io
├── .env.example
├── package.json
└── README.md
```

## Database schema

| Table | Key columns |
|-------|-------------|
| **users** | `phone`, `role`, `rating`, `device_id` |
| **drivers** | `user_id`, `wallet_balance`, `vehicle_video_url`, `agency_id`, `is_verified`, `dni_url`, `license_url`, `soat_url` |
| **agencies** | `master_wallet`, `commission_rate` |
| **companies** | `credit_limit`, `ruc_tax_id` |
| **rides** | `user_id`, `driver_id`, `offered_price`, `final_price`, `status`, `otp`, pickup/drop lat-lng & address |
| **transactions** | `type`, `amount`, `proof_image`, `status`, `driver_id`, `ride_id` |

Enums: `user_role`, `ride_status`, `transaction_type`, `transaction_status`.
