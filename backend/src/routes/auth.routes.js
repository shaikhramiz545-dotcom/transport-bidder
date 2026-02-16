const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db/firestore');
const config = require('../config');
const { AppUser, EmailOtp } = require('../models');
const { sendVerificationOtp, sendPasswordResetOtp, sendWelcomeEmail, isConfigured: isMsg91Configured } = require('../services/msg91');
const { sendPasswordResetOtpEmail } = require('../services/password-reset-email');

const router = express.Router();
const MOCK_OTP = config.mockOtp;
const isDev = config.env === 'development';
const BCRYPT_ROUNDS = 10;
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const OTP_RATE_LIMIT = 3; // max OTPs per email per 10 min
const OTP_RATE_WINDOW_MS = 10 * 60 * 1000;

// Generate real 6-digit OTP when mockOtp is null
function generateRealOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// In-memory OTP store: phone -> { otp, expiresAt }. TTL = 5 minutes.
const otpStore = new Map();
const OTP_TTL_MS = 5 * 60 * 1000;

function storeOtp(phone, otp) {
  otpStore.set(phone, { otp, expiresAt: Date.now() + OTP_TTL_MS });
}

function verifyStoredOtp(phone, code) {
  if (MOCK_OTP) return code === MOCK_OTP;
  const entry = otpStore.get(phone);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) { otpStore.delete(phone); return false; }
  const valid = entry.otp === code;
  if (valid) otpStore.delete(phone);
  return valid;
}

// Cleanup expired OTPs every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [phone, entry] of otpStore) {
    if (now > entry.expiresAt) otpStore.delete(phone);
  }
}, 10 * 60 * 1000);

// In-memory fallback when DB fails (dev only). Map: phone -> { id, phone, role, rating }
const devFallbackUsers = new Map();

/**
 * POST /api/auth/login
 * Body: { phone_number, role } — role: "user" | "driver"
 * Upserts user, returns mock OTP "1234" for dev.
 */
router.post('/login', async (req, res) => {
  try {
    const { phone_number, role } = req.body || {};
    const phone = typeof phone_number === 'string' ? phone_number.trim() : '';
    const r = typeof role === 'string' ? role.toLowerCase().trim() : '';

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'phone_number is required',
      });
    }

    const allowedRoles = ['user', 'driver'];
    if (!allowedRoles.includes(r)) {
      return res.status(400).json({
        success: false,
        message: 'role must be "user" or "driver"',
      });
    }

    const dbRole = r === 'user' ? 'passenger' : 'driver';

    try {
      const user = await db.upsertUserByPhone(phone, dbRole);
      if (!user && !db.getDb()) {
        throw new Error('Firestore not configured');
      }
    } catch (dbErr) {
      console.error('[auth] DB login error:', dbErr.message);
      if (isDev) {
        // Dev fallback: use in-memory store when Firestore unreachable
        const id = devFallbackUsers.has(phone)
          ? devFallbackUsers.get(phone).id
          : crypto.randomUUID();
        devFallbackUsers.set(phone, { id, phone, role: dbRole, rating: 0 });
        console.log('[auth] Using in-memory fallback (Firebase not configured). Set FIREBASE_SERVICE_ACCOUNT_PATH.');
        const otp = MOCK_OTP || generateRealOtp();
        storeOtp(phone, otp);
        return res.status(200).json({
          success: true,
          message: 'OTP sent',
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Login failed. Set FIREBASE_SERVICE_ACCOUNT_PATH in .env for Firestore.',
      });
    }

    const otp = MOCK_OTP || generateRealOtp();
    storeOtp(phone, otp);
    return res.status(200).json({
      success: true,
      message: 'OTP sent',
    });
  } catch (err) {
    console.error('[auth] login error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Login failed',
    });
  }
});

/**
 * POST /api/auth/verify
 * Body: { phone_number, otp }
 * If OTP is "1234", issues JWT and returns user object.
 */
router.post('/verify', async (req, res) => {
  try {
    const { phone_number, otp } = req.body || {};
    const phone = typeof phone_number === 'string' ? phone_number.trim() : '';
    const code = typeof otp === 'string' ? otp.trim() : '';

    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        message: 'phone_number and otp are required',
      });
    }

    if (!verifyStoredOtp(phone, code)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    let user;
    try {
      user = await db.getUserByPhone(phone);
    } catch (dbErr) {
      console.error('[auth] DB verify error:', dbErr.message);
    }

    // Dev fallback: check in-memory store
    if (!user && isDev && devFallbackUsers.has(phone)) {
      user = devFallbackUsers.get(phone);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Request OTP first.',
      });
    }
    const payload = {
      userId: user.id,
      phone: user.phone,
      role: user.role,
    };

    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });

    const userObj = {
      id: user.id,
      phone: user.phone,
      role: user.role,
      rating: user.rating != null ? Number(user.rating) : 0,
      driverId: user.driverId || null, // Include Driver ID for driver app
    };

    return res.status(200).json({
      success: true,
      token,
      user: userObj,
    });
  } catch (err) {
    console.error('[auth] verify error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Verification failed',
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// NEW: Email + Password auth (replaces Firebase Auth for User & Driver apps)
// Uses AppUser (PostgreSQL) + MSG91 for OTP emails.
// ═══════════════════════════════════════════════════════════════════════════════

/** Helper: generate 6-digit OTP */
function generateOtp6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Helper: rate-limit check (max N OTPs per email per window) */
async function isRateLimited(email, scope, role) {
  try {
    const since = new Date(Date.now() - OTP_RATE_WINDOW_MS);
    const count = await EmailOtp.count({
      where: {
        email,
        scope,
        role: role || 'user',
        createdAt: { [require('sequelize').Op.gte]: since },
      },
    });
    return count >= OTP_RATE_LIMIT;
  } catch {
    return false; // fail open
  }
}

/**
 * POST /api/auth/signup
 * Body: { email, password, name, phone?, role } — role: "user" | "driver"
 * Creates account + sends verification OTP via MSG91.
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name, phone, role } = req.body || {};
    const e = (typeof email === 'string' ? email.trim() : '').toLowerCase();
    const pwd = typeof password === 'string' ? password : '';
    const n = typeof name === 'string' ? name.trim() : '';
    const p = typeof phone === 'string' ? phone.trim() : '';
    const r = typeof role === 'string' ? role.toLowerCase().trim() : 'user';

    if (!e || !pwd) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }
    if (pwd.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    if (!['user', 'driver'].includes(r)) {
      return res.status(400).json({ success: false, message: 'role must be "user" or "driver"' });
    }

    // Check if email already registered
    const existing = await AppUser.findOne({ where: { email: e } });
    if (existing) {
      // Allow re-signup if email was never verified (user may have lost OTP or app crashed)
      if (!existing.emailVerified) {
        const hash = await bcrypt.hash(pwd, BCRYPT_ROUNDS);
        await existing.update({ passwordHash: hash, name: n || existing.name, phone: p || existing.phone, role: r });
        const otp = generateOtp6();
        await EmailOtp.create({ email: e, otp, scope: 'verification', role: r, expiresAt: new Date(Date.now() + OTP_EXPIRY_MS) });
        const sent = await sendVerificationOtp(e, otp, r);
        if (!sent) console.error('[auth] re-signup: email send failed for', e);
        return res.status(200).json({ success: true, message: 'Verification OTP re-sent to your email.', userId: existing.id });
      }
      return res.status(409).json({ success: false, message: 'An account already exists with this email.' });
    }

    // Hash password and create user
    const hash = await bcrypt.hash(pwd, BCRYPT_ROUNDS);
    const user = await AppUser.create({
      email: e,
      passwordHash: hash,
      name: n || null,
      phone: p || null,
      role: r,
      emailVerified: false,
    });

    // Also upsert in Firestore for backward compat (rides, drivers use Firestore)
    // Only upsert if a real phone number is provided (avoid storing email as phone)
    if (p) {
      try {
        const dbRole = r === 'user' ? 'passenger' : 'driver';
        await db.upsertUserByPhone(p, dbRole);
      } catch (dbErr) {
        console.warn('[auth] signup: Firestore upsert skipped:', dbErr.message);
      }
    }

    // Send verification OTP
    const otp = generateOtp6();
    await EmailOtp.create({
      email: e,
      otp,
      scope: 'verification',
      role: r,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
    });

    const sent = await sendVerificationOtp(e, otp, r);
    if (!sent) {
      console.error('[auth] signup: email send failed for', e);
    }

    return res.status(201).json({
      success: true,
      message: 'Account created. Verification OTP sent to your email.',
      userId: user.id,
    });
  } catch (err) {
    console.error('[auth] signup error:', err.message);
    return res.status(500).json({ success: false, message: 'Signup failed' });
  }
});

/**
 * POST /api/auth/send-verification-otp
 * Body: { email, role? }
 * Resend verification OTP (rate-limited).
 */
router.post('/send-verification-otp', async (req, res) => {
  try {
    const { email, role } = req.body || {};
    const e = (typeof email === 'string' ? email.trim() : '').toLowerCase();
    const r = typeof role === 'string' ? role.toLowerCase().trim() : 'user';
    if (!e) return res.status(400).json({ success: false, message: 'Email required' });

    if (await isRateLimited(e, 'verification', r)) {
      return res.status(429).json({ success: false, message: 'Too many OTP requests. Try again in 10 minutes.' });
    }

    const otp = generateOtp6();
    await EmailOtp.create({
      email: e, otp, scope: 'verification', role: r,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
    });
    await sendVerificationOtp(e, otp, r);
    return res.json({ success: true, message: 'Verification OTP sent.' });
  } catch (err) {
    console.error('[auth] send-verification-otp:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
});

/**
 * POST /api/auth/verify-email
 * Body: { email, otp, role? }
 * Verifies email OTP → marks emailVerified=true → issues JWT.
 */
router.post('/verify-email', async (req, res) => {
  try {
    const { email, otp, role } = req.body || {};
    const e = (typeof email === 'string' ? email.trim() : '').toLowerCase();
    const code = String(otp || '').trim();
    const r = typeof role === 'string' ? role.toLowerCase().trim() : 'user';
    if (!e || !code) return res.status(400).json({ success: false, message: 'Email and OTP required' });

    // Find latest non-expired OTP
    const row = await EmailOtp.findOne({
      where: {
        email: e, scope: 'verification', role: r,
        expiresAt: { [require('sequelize').Op.gt]: new Date() },
      },
      order: [['createdAt', 'DESC']],
    });
    if (!row || row.otp !== code) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }
    await row.destroy();

    // Mark verified
    const user = await AppUser.findOne({ where: { email: e, role: r } });
    if (!user) return res.status(404).json({ success: false, message: 'Account not found' });
    user.emailVerified = true;
    await user.save();

    // Issue JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role === 'user' ? 'passenger' : user.role, phone: user.phone || '' },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    // Send welcome email (non-blocking)
    sendWelcomeEmail(user.email, user.name || '', user.role || r).catch(() => {});

    return res.json({
      success: true,
      message: 'Email verified.',
      token,
      user: { id: String(user.id), email: user.email, name: user.name, phone: user.phone, role: user.role },
    });
  } catch (err) {
    console.error('[auth] verify-email:', err.message);
    return res.status(500).json({ success: false, message: 'Verification failed' });
  }
});

/**
 * POST /api/auth/email-login
 * Body: { email, password, role? }
 * Email + password login → JWT.
 */
router.post('/email-login', async (req, res) => {
  try {
    const { email, password, role } = req.body || {};
    const e = (typeof email === 'string' ? email.trim() : '').toLowerCase();
    const pwd = typeof password === 'string' ? password : '';
    const r = typeof role === 'string' ? role.toLowerCase().trim() : null;
    if (!e || !pwd) return res.status(400).json({ success: false, message: 'Email and password required' });

    const where = { email: e };
    if (r) where.role = r;
    const user = await AppUser.findOne({ where });
    if (!user || user.status === 'disabled') {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    const valid = await bcrypt.compare(pwd, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    if (!user.emailVerified) {
      return res.status(403).json({ success: false, message: 'Email not verified. Check your inbox for verification OTP.', code: 'email_not_verified' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role === 'user' ? 'passenger' : user.role, phone: user.phone || '' },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: { id: String(user.id), email: user.email, name: user.name, phone: user.phone, role: user.role },
    });
  } catch (err) {
    console.error('[auth] email-login:', err.message);
    return res.status(500).json({ success: false, message: 'Login failed' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Body: { email, role? }
 * Sends password reset OTP via MSG91.
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email, role } = req.body || {};
    const e = (typeof email === 'string' ? email.trim() : '').toLowerCase();
    const r = typeof role === 'string' ? role.toLowerCase().trim() : 'user';
    if (!e) return res.status(400).json({ success: false, message: 'Email required' });

    // Always return success to prevent email enumeration
    const user = await AppUser.findOne({ where: { email: e } });
    if (!user) {
      return res.json({ success: true, message: 'If an account exists, you will receive an OTP.' });
    }

    if (await isRateLimited(e, 'password_reset', r)) {
      return res.status(429).json({ success: false, message: 'Too many OTP requests. Try again in 10 minutes.' });
    }

    const otp = generateOtp6();
    await EmailOtp.create({
      email: e, otp, scope: 'password_reset', role: r,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
    });

    // Try MSG91 first, fall back to SMTP
    let sent = await sendPasswordResetOtp(e, otp, r);
    if (!sent) {
      sent = await sendPasswordResetOtpEmail(e, otp, r);
    }
    if (!sent) {
      console.error('[auth] forgot-password: email send failed for', e);
    }
    // OTP logging removed for production security

    return res.json({ success: true, message: 'If an account exists, you will receive an OTP.' });
  } catch (err) {
    console.error('[auth] forgot-password:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

/**
 * POST /api/auth/reset-password
 * Body: { email, otp, newPassword, role? }
 * Verifies OTP → updates password hash in AppUser.
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword, role } = req.body || {};
    const e = (typeof email === 'string' ? email.trim() : '').toLowerCase();
    const code = String(otp || '').trim();
    const pwd = String(newPassword || '').trim();
    const r = typeof role === 'string' ? role.toLowerCase().trim() : 'user';
    if (!e || !code || !pwd) return res.status(400).json({ success: false, message: 'Email, OTP and new password required' });
    if (pwd.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

    const row = await EmailOtp.findOne({
      where: {
        email: e, scope: 'password_reset', role: r,
        expiresAt: { [require('sequelize').Op.gt]: new Date() },
      },
      order: [['createdAt', 'DESC']],
    });
    if (!row || row.otp !== code) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }
    await row.destroy();

    const user = await AppUser.findOne({ where: { email: e } });
    if (!user) return res.status(404).json({ success: false, message: 'Account not found' });

    user.passwordHash = await bcrypt.hash(pwd, BCRYPT_ROUNDS);
    await user.save();

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('[auth] reset-password:', err.message);
    return res.status(500).json({ success: false, message: 'Password reset failed' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// LEGACY: Keep link-email + phone-by-email for backward compat with Firestore
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/user/link-email', async (req, res) => {
  try {
    const { phone, email } = req.body || {};
    const p = typeof phone === 'string' ? phone.trim() : '';
    const e = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!p || !e) return res.status(400).json({ success: false, message: 'phone and email required' });
    await db.setUserAppEmail(p, e);
    return res.json({ success: true, message: 'OK' });
  } catch (err) {
    console.error('[auth] user/link-email', err.message);
    return res.status(500).json({ success: false, message: 'Operation failed' });
  }
});

router.post('/driver/link-email', async (req, res) => {
  try {
    const { phone, email } = req.body || {};
    const p = typeof phone === 'string' ? phone.trim() : '';
    const e = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!p || !e) return res.status(400).json({ success: false, message: 'phone and email required' });
    await db.setDriverAppEmail(p, e);
    return res.json({ success: true, message: 'OK' });
  } catch (err) {
    console.error('[auth] driver/link-email', err.message);
    return res.status(500).json({ success: false, message: 'Operation failed' });
  }
});

router.get('/driver/phone-by-email', async (req, res) => {
  try {
    const email = (typeof req.query.email === 'string' ? req.query.email.trim() : '').toLowerCase();
    if (!email) return res.status(400).json({ success: false, message: 'email query param required' });
    const phone = await db.getDriverPhoneByEmail(email);
    if (!phone) return res.status(404).json({ success: false, message: 'No driver linked to this email' });
    return res.json({ success: true, phone });
  } catch (err) {
    console.error('[auth] driver/phone-by-email', err.message);
    return res.status(500).json({ success: false, message: 'Operation failed' });
  }
});

module.exports = router;
