# SMTP Email Setup Guide for TransportBidder

## 🔧 Email OTP Not Sending? Configure SMTP

Email OTP (password reset) nahi bhej raha hai to SMTP configuration zaroori hai.

---

## 📧 SMTP Configuration Steps

### 1. Backend `.env` file mein add karein

`backend/.env` file mein ye lines add karein:

```env
# SMTP Configuration for Email OTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
MAIL_FROM=noreply@transportbidder.com
```

---

## 📱 Gmail ke liye App Password kaise banayein

### Step 1: 2-Factor Authentication enable karein
1. Gmail account mein login karein
2. Google Account settings → Security
3. **2-Step Verification** enable karein

### Step 2: App Password generate karein
1. Google Account → Security → 2-Step Verification
2. **App passwords** section pe click karein
3. **Select app**: Mail
4. **Select device**: Other (Custom name) → "TransportBidder"
5. **Generate** pe click karein
6. **16-character password** copy karein (ye `SMTP_PASS` mein use hogi)

---

## 🔄 Other Email Providers

### Outlook/Hotmail:
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

### Yahoo:
```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@yahoo.com
SMTP_PASS=your-app-password
```

---

## 🚀 Backend Restart

`.env` file update karne ke baad backend restart karein:

```bash
cd backend
npm stop
npm start
```

---

## 🧪 Test Email OTP

1. User app ya driver app mein login karein
2. **Forgot Password** pe click karein
3. Email enter karein aur **Send OTP** pe click karein
4. Check email inbox (spam folder bhi check karein)

---

## ❌ Common Issues

| Problem | Solution |
|---------|----------|
| "Authentication failed" | Gmail app password use karein, normal password nahi |
| "Connection refused" | SMTP host aur port check karein |
| "Email not received" | Spam folder check karein |
| "Invalid credentials" | Email aur app password double check karein |

---

## 📝 Notes

- **Gmail app password** 16 characters hota hai (spaces include)
- **SMTP_SECURE=false** for port 587 (TLS)
- **SMTP_SECURE=true** for port 465 (SSL)
- `MAIL_FROM` se email sender name set hota hai

---

## ✅ Verification Checklist

- [ ] `.env` file mein SMTP details add kiye
- [ ] Gmail 2FA enabled hai
- [ ] App password generate kiya
- [ ] Backend restart kiya
- [ ] Test email OTP bheja
- [ ] Email received hai

---

**Agar phir bhi problem hai to:**
1. Backend logs check karein: `cd backend && npm start`
2. Email provider settings verify karein
3. Firewall/port blocking check karein
