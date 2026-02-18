# Password Reset – API Design, Flow, DB Schema

Admin Panel aur Agency Portal ke liye Forgot Password + OTP flow.

---

## 1. DB Schema

### password_reset_otp
| Column    | Type        | Description                    |
|-----------|-------------|--------------------------------|
| id        | SERIAL PK   | Auto increment                 |
| email     | TEXT        | User email                     |
| otp       | VARCHAR(6)  | 6-digit OTP                    |
| scope     | VARCHAR(20) | 'admin' \| 'agency'            |
| expires_at| TIMESTAMPTZ | OTP expiry (10 min)            |
| created_at| TIMESTAMPTZ | Creation time                  |

### admin_credential
| Column | Type         | Description                        |
|--------|--------------|------------------------------------|
| key    | VARCHAR(64) PK | 'password_hash'                  |
| value  | TEXT         | PBKDF2 hash (when admin resets)   |

---

## 2. API Endpoints

### Admin Panel

| Method | Endpoint                    | Body                         | Response                  |
|--------|-----------------------------|------------------------------|---------------------------|
| POST   | /api/admin/forgot-password  | `{ email }`                  | `{ message }`             |
| POST   | /api/admin/reset-password   | `{ email, otp, newPassword }`| `{ message }`             |

### Agency Portal

| Method | Endpoint                     | Body                         | Response                  |
|--------|------------------------------|------------------------------|---------------------------|
| POST   | /api/agency/forgot-password  | `{ email }`                  | `{ message }`             |
| POST   | /api/agency/reset-password   | `{ email, otp, newPassword }`| `{ message }`             |

---

## 3. Flow

```
Login Page
    │
    ├── [Forgot password?] ──► Forgot Password Page
    │                               │
    │                               ├── Enter email ──► Send OTP (API)
    │                               │
    │                               └── [Enter OTP] ──► Reset Password Page
    │                                                       │
    │                                                       ├── Email (pre-filled)
    │                                                       ├── OTP (6 digits)
    │                                                       ├── New password
    │                                                       └── Confirm password
    │                                                               │
    │                                                               └── Submit ──► API ──► Login
```

---

## 4. SMTP Configuration

Email bhejne ke liye `backend/.env` mein:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your_password
MAIL_FROM=noreply@tbidder.com
```

Agar SMTP set nahi hai to "Failed to send email" aayega. Local test ke liye [Ethereal](https://ethereal.email/) ya [Mailtrap](https://mailtrap.io/) use kar sakte ho.

---

## 5. Activate

1. **Migration run karo:**
   ```bash
   cd backend && node scripts/run-migrations.js
   ```

2. **Backend restart** karo.

3. **Admin Panel:** Login page par "Forgot password?" link.
4. **Agency Portal:** Login page par "Forgot password?" link.
