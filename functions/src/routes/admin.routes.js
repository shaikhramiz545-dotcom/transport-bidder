/**
 * Control Panel (Admin) API – Firma ke hisaab se.
 * Stats & rides ab DB se (Ride table). User/Driver app ka data yahan dikhega.
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const { Op, fn, col } = require('sequelize');
const config = require('../config');
const { pool, healthCheck: pgHealthCheck } = require('../config/db');
const { sendPasswordResetOtpEmail } = require('../services/password-reset-email');
const {
  Ride,
  Message,
  DriverVerification,
  DriverVerificationAudit,
  DriverDocument,
  AdminSettings,
  AdminUser,
  AdminRole,
  FeatureFlag,
  WalletTransaction,
  DriverWallet,
  WalletLedger,
  Tour,
  TravelAgency,
  TourPaxOption,
  TourSlot,
  AgencyPayoutRequest,
  TourBooking,
  AgencyWallet,
  AgencyDocument,
} = require('../models');
const { buildPdfBuffer, buildExcelBuffer, sendPayoutEmail } = require('../services/agency-payout-email');
const { sendAgencyVerificationEmail } = require('../services/agency-verification-email');
const firestore = require('../db/firestore');
const { getAdmin, getFirestore } = require('../services/firebase-admin');
const trafficCounter = require('../utils/traffic-counter');
const apiMetrics = require('../utils/api-metrics');
const dlocal = require('../services/dlocal');
const nodemailer = require('nodemailer');
const driversRouter = require('./drivers');
const getOnlineDriverCount = driversRouter.getOnlineDriverCount || (() => 0);
const getOnlineDriversByVehicle = driversRouter.getOnlineDriversByVehicle || (() => ({ car: 0, bike: 0, taxi: 0, van: 0, truck: 0, ambulance: 0 }));
const getOnlineDriversList = driversRouter.getOnlineDriversList || (() => []);
const router = express.Router();

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@tbidder.com').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SALT = process.env.AGENCY_PASSWORD_SALT || 'tbidder-agency-salt-change-in-prod';
const PBKDF2_ITERATIONS = 100000;

function hashPassword(password) {
  return crypto.pbkdf2Sync(password, SALT, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
}

function verifyPassword(password, hash) {
  if (!hash) return false;
  try {
    const h = hashPassword(password);
    if (h.length !== hash.length) return false;
    return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.admin = jwt.verify(token, config.jwtSecret);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Guard admin-only routes (sub-users cannot manage other admins). */
function requireAdminRole(req, res, next) {
  if (req.admin?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return next();
}

/** GET /api/admin – Health check for control panel (confirm admin API is mounted). */
router.get('/', (_req, res) => {
  res.json({ ok: true, message: 'Admin API', endpoints: ['stats', 'rides', 'drivers', 'recharge-requests', 'agencies', 'settings', 'health-status'] });
});

/** Admin Roles — CRUD (team-wise module permissions) */
router.get('/roles', authMiddleware, requireAdminRole, async (_req, res) => {
  try {
    const roles = await AdminRole.findAll({
      attributes: ['id', 'name', 'description', 'permissions', 'createdAt', 'updatedAt'],
      order: [['name', 'ASC']],
      raw: true,
    });
    return res.json({ roles });
  } catch (err) {
    console.error('[admin] roles list', err.message);
    return res.status(500).json({ error: err.message, roles: [] });
  }
});

router.post('/roles', authMiddleware, requireAdminRole, async (req, res) => {
  try {
    const { name, description, permissions } = req.body || {};
    const n = (name || '').trim();
    if (!n) return res.status(400).json({ error: 'Role name required' });
    const existing = await AdminRole.findOne({ where: { name: n } });
    if (existing) return res.status(409).json({ error: 'Role already exists' });
    const created = await AdminRole.create({
      name: n,
      description: (description || '').trim() || null,
      permissions: Array.isArray(permissions) ? permissions : [],
    });
    return res.status(201).json({ role: {
      id: created.id, name: created.name, description: created.description, permissions: created.permissions, createdAt: created.createdAt, updatedAt: created.updatedAt,
    } });
  } catch (err) {
    console.error('[admin] roles create', err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/roles/:id', authMiddleware, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, permissions } = req.body || {};
    const updates = {};
    if (name != null) updates.name = String(name).trim();
    if (description !== undefined) updates.description = description != null ? String(description).trim() : null;
    if (Array.isArray(permissions)) updates.permissions = permissions;
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid updates' });
    const [count, rows] = await AdminRole.update(updates, { where: { id }, returning: true });
    if (!count) return res.status(404).json({ error: 'Role not found' });
    const r = rows?.[0];
    return res.json({ role: r ? { id: r.id, name: r.name, description: r.description, permissions: r.permissions, createdAt: r.createdAt, updatedAt: r.updatedAt } : null });
  } catch (err) {
    console.error('[admin] roles update', err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/roles/:id', authMiddleware, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const count = await AdminRole.destroy({ where: { id } });
    if (!count) return res.status(404).json({ error: 'Role not found' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[admin] roles delete', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** Helper: ping internal API route. Returns true if route responds (2xx, 400, 401). */
async function pingRoute(baseUrl, path, method = 'GET') {
  try {
    const r = await axios({
      method,
      url: baseUrl + path,
      timeout: 5000,
      validateStatus: () => true,
    });
    return r.status < 500;
  } catch (e) {
    return false;
  }
}

/** GET /api/admin/health-status – TBidder Health: live status of all services. */
router.get('/health-status', authMiddleware, async (req, res) => {
  const result = { services: {}, apis: {}, stats: {}, live: {}, lastChecked: new Date().toISOString() };
  const baseUrl = `http://127.0.0.1:${config.port || 4001}`;

  // Backend – always ok if we got here
  result.services.backend = true;

  // Socket.io – real-time connections
  try {
    const io = req.app.get('io');
    result.live.socketio = {
      ok: !!io,
      connections: io ? (io.engine?.clientsCount ?? io.sockets?.sockets?.size ?? 0) : 0,
    };
  } catch (e) {
    result.live.socketio = { ok: false, connections: 0 };
  }

  // Response time & error rate (last 60s)
  result.live.metrics = apiMetrics.getMetrics();

  // Database (PostgreSQL)
  try {
    result.services.database = await pgHealthCheck();
    const poolRes = await pool.query('SELECT count(*)::int as c FROM pg_stat_activity WHERE datname = current_database()');
    result.live.dbConnections = poolRes.rows[0]?.c ?? 0;
  } catch (e) {
    result.services.database = false;
    result.live.dbConnections = 0;
  }

  // Firestore – check if configured first
  const fsConfigured = !!getFirestore();
  if (!fsConfigured) {
    result.services.firestore = { configured: false, ok: null, msg: 'Not configured' };
  } else {
    try {
      const fsOk = await firestore.healthCheck();
      result.services.firestore = { configured: true, ok: fsOk, msg: fsOk ? 'OK' : 'Down' };
    } catch (e) {
      result.services.firestore = { configured: true, ok: false, msg: e.message || 'Error' };
    }
  }

  // MSG91 (Email OTP for account verification + password reset)
  const msg91Configured = require('../services/msg91').isConfigured();
  result.services.msg91 = { configured: msg91Configured, ok: msg91Configured, msg: msg91Configured ? 'OK' : 'MSG91_AUTH_KEY not set' };

  // External: Places & Directions
  const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || '';
  try {
    if (!googleKey) {
      result.services.places = false;
      result.services.placesMsg = 'No API key';
    } else {
      const r = await axios.get(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=Lima&key=${googleKey}&language=es&components=country:pe`,
        { timeout: 8000 }
      );
      result.services.places = r.data?.status === 'OK' || r.data?.status === 'ZERO_RESULTS';
    }
  } catch (e) {
    result.services.places = false;
    result.services.placesMsg = e.message || 'Request failed';
  }
  try {
    if (!googleKey) {
      result.services.directions = false;
      result.services.directionsMsg = 'No API key';
    } else {
      const r = await axios.get(
        `https://maps.googleapis.com/maps/api/directions/json?origin=-12.0,-77.0&destination=-12.1,-77.1&mode=driving&key=${googleKey}`,
        { timeout: 8000 }
      );
      result.services.directions = r.data?.status === 'OK';
    }
  } catch (e) {
    result.services.directions = false;
    result.services.directionsMsg = e.message || 'Request failed';
  }

  // Internal APIs – ping all routes (including previously missing)
  const [
    ridesOk, authOk, authVerifyOk, authSignupOk, authEmailLoginOk, authVerifyEmailOk, authForgotPwdOk,
    driversOk, walletBalOk, toursOk, agencyMeOk,
    placesDetailsOk, driverVerificationOk, tourBookingsOk, tourTickerOk, tourFeatureFlagOk,
    agencySignupOk, agencyLoginOk, agencyPayoutsOk, agencyWalletOk,
    walletTxOk, walletRechargeOk, adminStatsOk, uploadsOk,
  ] = await Promise.all([
    pingRoute(baseUrl, '/api/rides'),
    pingRoute(baseUrl, '/api/auth/login', 'POST'),
    pingRoute(baseUrl, '/api/auth/verify', 'POST'),
    pingRoute(baseUrl, '/api/auth/signup', 'POST'),
    pingRoute(baseUrl, '/api/auth/email-login', 'POST'),
    pingRoute(baseUrl, '/api/auth/verify-email', 'POST'),
    pingRoute(baseUrl, '/api/auth/forgot-password', 'POST'),
    pingRoute(baseUrl, '/api/drivers/requests'),
    pingRoute(baseUrl, '/api/wallet/balance'),
    pingRoute(baseUrl, '/api/tours'),
    pingRoute(baseUrl, '/api/agency/me'),
    pingRoute(baseUrl, '/api/places/details?place_id=ChIJ0_c7xv-KrpQRnrlsC1S3l2I'), // Lima
    pingRoute(baseUrl, '/api/drivers/verification-status'),
    pingRoute(baseUrl, '/api/tours/bookings', 'POST'), // 400 without body = route exists
    pingRoute(baseUrl, '/api/tours/ticker-messages'),
    pingRoute(baseUrl, '/api/tours/feature-flag'),
    pingRoute(baseUrl, '/api/agency/signup', 'POST'), // 400 without body = route exists
    pingRoute(baseUrl, '/api/agency/login', 'POST'),
    pingRoute(baseUrl, '/api/agency/payout-requests'),
    pingRoute(baseUrl, '/api/agency/wallet'),
    pingRoute(baseUrl, '/api/wallet/transactions'),
    pingRoute(baseUrl, '/api/wallet/recharge', 'POST'), // 400 = route exists
    pingRoute(baseUrl, '/api/admin/stats'), // 401 without token = route exists
    pingRoute(baseUrl, '/uploads/'),
  ]);

  result.apis = {
    userApp: {
      places: result.services.places,
      placesDetails: placesDetailsOk,
      directions: result.services.directions,
      rides: ridesOk,
      auth: authOk,
      authVerify: authVerifyOk,
      authSignup: authSignupOk,
      authEmailLogin: authEmailLoginOk,
      authVerifyEmail: authVerifyEmailOk,
      authForgotPassword: authForgotPwdOk,
      tourTicker: tourTickerOk,
      tourFeatureFlag: tourFeatureFlagOk,
    },
    driverApp: {
      auth: authOk,
      authSignup: authSignupOk,
      authEmailLogin: authEmailLoginOk,
      authVerifyEmail: authVerifyEmailOk,
      authForgotPassword: authForgotPwdOk,
      drivers: driversOk,
      driverVerification: driverVerificationOk,
      wallet: walletBalOk,
      walletTransactions: walletTxOk,
      walletRecharge: walletRechargeOk,
      rides: ridesOk,
    },
    adminPanel: { admin: adminStatsOk },
    partnerPanel: {
      tours: toursOk,
      agency: agencyMeOk,
      agencySignup: agencySignupOk,
      agencyLogin: agencyLoginOk,
      agencyPayouts: agencyPayoutsOk,
      agencyWallet: agencyWalletOk,
      tourBookings: tourBookingsOk,
    },
    uploads: uploadsOk,
  };

  // Save history (for 4–7 day uptime % and bar graph)
  try {
    await pool.query(
      'INSERT INTO health_check_history (checked_at, result) VALUES ($1, $2)',
      [new Date(), JSON.stringify(result)]
    );
    await pool.query(
      'DELETE FROM health_check_history WHERE checked_at < now() - interval \'7 days\''
    );
  } catch (historyErr) {
    console.warn('[admin] health-history save:', historyErr.message);
  }

  // Payment gateway (dLocal)
  try {
    if (!dlocal.isConfigured()) {
      result.services.paymentGateway = { configured: false, ok: null, msg: 'Not configured' };
    } else {
      const pingRes = await axios.get(dlocal.getBaseUrl(), { timeout: 5000, validateStatus: () => true });
      result.services.paymentGateway = { configured: true, ok: pingRes.status < 500, msg: pingRes.status < 500 ? 'OK' : `HTTP ${pingRes.status}` };
    }
  } catch (e) {
    result.services.paymentGateway = { configured: dlocal.isConfigured(), ok: false, msg: e.message || 'Unreachable' };
  }

  // SMTP
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    await transporter.verify();
    result.services.smtp = { ok: true, msg: 'OK' };
  } catch (e) {
    result.services.smtp = { ok: false, msg: e.message || 'Not configured or unreachable' };
  }

  // Stats + live business metrics
  try {
    result.stats.onlineDrivers = getOnlineDriverCount();
    result.stats.pendingVerifications = 0;
    result.stats.pendingRides = 0;
    result.stats.totalRides = 0;
    result.stats.activeRides = 0;
    result.stats.pendingWalletRecharge = 0;
    result.stats.pendingPayouts = 0;
    result.stats.pendingTourBookings = 0;
    try {
      result.stats.pendingVerifications = await DriverVerification.count({ where: { status: 'pending' } });
      result.stats.pendingRides = await Ride.count({ where: { status: 'pending' } });
      result.stats.totalRides = await Ride.count();
      result.stats.activeRides = await Ride.count({
        where: { status: { [Op.in]: ['driver_arrived', 'ride_started'] } },
      });
      result.stats.pendingWalletRecharge = await WalletTransaction.count({ where: { status: 'pending' } });
      result.stats.pendingPayouts = await AgencyPayoutRequest.count({ where: { status: 'pending' } });
      result.stats.pendingTourBookings = await TourBooking.count({
        where: { status: { [Op.in]: ['pending', 'confirmed'] } },
      });
    } catch (dbErr) {
      try {
        const fsList = await firestore.listDriverVerifications();
        result.stats.pendingVerifications = fsList.filter((d) => (d.status || 'pending') === 'pending').length;
      } catch (_) {}
    }
  } catch (e) {
    result.stats = {
      onlineDrivers: 0, pendingVerifications: 0, pendingRides: 0, totalRides: 0,
      activeRides: 0, pendingWalletRecharge: 0, pendingPayouts: 0, pendingTourBookings: 0,
    };
  }

  const firestoreOk = result.services.firestore?.configured ? result.services.firestore?.ok : true;
  const allOk = result.services.backend && (result.services.database || firestoreOk) && result.services.places && result.services.directions;
  result.ok = allOk;

  result.traffic = trafficCounter.getStats();
  result.trafficWindowSec = 60;

  return res.json(result);
});

/** GET /api/admin/health-history – Last 7 days of health checks (for uptime % & bar graph). */
router.get('/health-history', authMiddleware, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, checked_at, result FROM health_check_history
       WHERE checked_at >= now() - interval '7 days'
       ORDER BY checked_at ASC`
    );
    return res.json({ history: rows });
  } catch (e) {
    return res.status(500).json({ error: e.message, history: [] });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const trimmedEmail = email.trim().toLowerCase();
    if (trimmedEmail === ADMIN_EMAIL) {
      // Check admin_credential (from password reset) first; else env
      let storedHash = null;
      try {
        const credResult = await pool.query(
          "SELECT value FROM admin_credential WHERE key = 'password_hash'"
        );
        storedHash = credResult.rows[0]?.value;
      } catch (dbErr) {
        // admin_credential table may not exist (migration not run) – use env
        console.warn('[admin] admin_credential check failed:', dbErr.message);
      }
      const valid = storedHash
        ? verifyPassword(password, storedHash)
        : (password === ADMIN_PASSWORD);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      const token = jwt.sign(
        { sub: trimmedEmail, role: 'admin' },
        config.jwtSecret,
        { expiresIn: '7d' }
      );
      return res.json({ token });
    }

    // Sub-admin (manager) login
    const subUser = await AdminUser.findOne({ where: { email: trimmedEmail }, raw: true });
    if (!subUser || subUser.status === 'disabled') {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const valid = verifyPassword(password, subUser.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign(
      {
        sub: trimmedEmail,
        name: subUser.name || '',
        department: subUser.department || '',
        role: subUser.role || 'manager',
        permissions: Array.isArray(subUser.permissions) ? subUser.permissions : [],
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );
    return res.json({ token });
  } catch (err) {
    console.error('[admin] login', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/forgot-password – Send OTP to admin email */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    const trimmedEmail = (email || '').trim().toLowerCase();
    if (!trimmedEmail) {
      return res.status(400).json({ error: 'Email required' });
    }
    if (trimmedEmail !== ADMIN_EMAIL) {
      return res.status(200).json({ message: 'If an admin account exists with this email, you will receive an OTP.' });
    }
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query(
      'INSERT INTO password_reset_otp (email, otp, scope, expires_at) VALUES ($1, $2, $3, $4)',
      [trimmedEmail, otp, 'admin', expiresAt]
    );
    const sent = await sendPasswordResetOtpEmail(trimmedEmail, otp, 'admin');
    if (!sent) {
      return res.status(500).json({ error: 'Failed to send email. Check SMTP configuration.' });
    }
    return res.status(200).json({ message: 'OTP sent to your email.' });
  } catch (err) {
    console.error('[admin] forgot-password', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/reset-password – Verify OTP and set new password */
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body || {};
    const trimmedEmail = (email || '').trim().toLowerCase();
    const otpStr = String(otp || '').trim();
    const pwd = (newPassword || '').trim();
    if (!trimmedEmail || !otpStr || !pwd) {
      return res.status(400).json({ error: 'Email, OTP, and new password required' });
    }
    if (pwd.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (trimmedEmail !== ADMIN_EMAIL) {
      return res.status(401).json({ error: 'Invalid request' });
    }
    const result = await pool.query(
      `SELECT id, otp FROM password_reset_otp
       WHERE email = $1 AND scope = 'admin' AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
      [trimmedEmail]
    );
    const row = result.rows[0];
    if (!row || row.otp !== otpStr) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }
    const hash = hashPassword(pwd);
    await pool.query(
      `INSERT INTO admin_credential (key, value) VALUES ('password_hash', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [hash]
    );
    await pool.query('DELETE FROM password_reset_otp WHERE id = $1', [row.id]);
    return res.status(200).json({ message: 'Password reset successfully. You can now login.' });
  } catch (err) {
    console.error('[admin] reset-password', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/users – List sub-admin accounts. */
router.get('/users', authMiddleware, requireAdminRole, async (_req, res) => {
  try {
    const users = await AdminUser.findAll({
      attributes: ['id', 'email', 'name', 'department', 'role', 'permissions', 'status', 'createdAt', 'updatedAt'],
      order: [['createdAt', 'DESC']],
      raw: true,
    });
    return res.json({ users });
  } catch (err) {
    console.error('[admin] users list', err.message);
    return res.status(500).json({ error: err.message, users: [] });
  }
});

/** POST /api/admin/users – Create sub-admin account with permissions. */
router.post('/users', authMiddleware, requireAdminRole, async (req, res) => {
  try {
    const { email, password, role, permissions, name, department } = req.body || {};
    const trimmedEmail = (email || '').trim().toLowerCase();
    const pwd = (password || '').trim();
    if (!trimmedEmail || !pwd) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    if (trimmedEmail === ADMIN_EMAIL) {
      return res.status(400).json({ error: 'Use the main admin account for this email' });
    }
    if (!trimmedEmail.includes('@')) {
      return res.status(400).json({ error: 'Enter a valid email' });
    }
    if (pwd.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const existing = await AdminUser.findOne({ where: { email: trimmedEmail } });
    if (existing) {
      return res.status(409).json({ error: 'Admin user already exists' });
    }
    const created = await AdminUser.create({
      email: trimmedEmail,
      passwordHash: hashPassword(pwd),
      name: (name || '').trim() || null,
      department: (department || '').trim() || null,
      role: role === 'admin' ? 'admin' : 'manager',
      permissions: Array.isArray(permissions) ? permissions : [],
      status: 'active',
    });
    return res.status(201).json({
      user: {
        id: created.id,
        email: created.email,
        name: created.name,
        department: created.department,
        role: created.role,
        permissions: created.permissions,
        status: created.status,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
    });
  } catch (err) {
    console.error('[admin] users create', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** PATCH /api/admin/users/:id – Update permissions, status, or password. */
router.patch('/users/:id', authMiddleware, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, permissions, status, password, name, department } = req.body || {};
    const updates = {};
    if (role) {
      updates.role = role === 'admin' ? 'admin' : 'manager';
    }
    if (Array.isArray(permissions)) {
      updates.permissions = permissions;
    }
    if (status) {
      updates.status = status === 'disabled' ? 'disabled' : 'active';
    }
    if (password && String(password).trim().length >= 6) {
      updates.passwordHash = hashPassword(String(password).trim());
    }
    if (name !== undefined) {
      updates.name = name != null ? String(name).trim() || null : null;
    }
    if (department !== undefined) {
      updates.department = department != null ? String(department).trim() || null : null;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }
    const [count, rows] = await AdminUser.update(updates, {
      where: { id },
      returning: true,
    });
    if (!count) {
      return res.status(404).json({ error: 'Admin user not found' });
    }
    const updated = rows?.[0];
    return res.json({
      user: updated ? {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        department: updated.department,
        role: updated.role,
        permissions: updated.permissions,
        status: updated.status,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      } : { id, ...updates },
    });
  } catch (err) {
    console.error('[admin] users update', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/stats – Dashboard: counts, income by month, drivers by vehicle, live list. */
router.get('/stats', authMiddleware, async (_req, res) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const previousMonthLabel = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  const currentMonthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let totalRides = 0, pendingRides = 0, todaysRides = 0;
  let incomeCurrentMonth = 0, incomePreviousMonth = 0;
  let pendingVerifications = 0;
  let totalDriversByVehicleRows = [];

  try {
    [
      totalRides,
      pendingRides,
      todaysRides,
      incomeCurrentMonth,
      incomePreviousMonth,
    ] = await Promise.all([
      Ride.count(),
      Ride.count({ where: { status: 'pending' } }),
      Ride.count({ where: { createdAt: { [Op.gte]: startOfToday } } }),
      Ride.sum('userPrice', { where: { status: 'completed', createdAt: { [Op.gte]: startOfCurrentMonth } } }) || 0,
      Ride.sum('userPrice', { where: { status: 'completed', createdAt: { [Op.gte]: startOfPreviousMonth, [Op.lte]: endOfPreviousMonth } } }) || 0,
    ]);
  } catch (rideErr) {
    console.warn('[admin] stats Ride queries skipped:', rideErr.message);
  }

  try {
    pendingVerifications = await DriverVerification.count({ where: { status: 'pending' } });
    totalDriversByVehicleRows = await DriverVerification.findAll({ attributes: ['vehicleType'], raw: true });
  } catch (dvErr) {
    console.warn('[admin] stats DriverVerification queries skipped:', dvErr.message);
    // Firestore fallback when PostgreSQL table missing or DB down
    try {
      const fsList = await firestore.listDriverVerifications();
      pendingVerifications = fsList.filter((d) => (d.status || 'pending') === 'pending').length;
      totalDriversByVehicleRows = fsList.map((d) => ({ vehicleType: d.vehicleType || 'car' }));
    } catch (fsErr) {
      console.warn('[admin] stats Firestore fallback skipped:', fsErr.message);
    }
  }

  const totalDriversByVehicle = { car: 0, bike: 0, taxi: 0, van: 0, truck: 0, car_hauler: 0, ambulance: 0 };
  for (const row of totalDriversByVehicleRows || []) {
    const vt = (row.vehicleType || 'car').toLowerCase();
    if (totalDriversByVehicle[vt] !== undefined) totalDriversByVehicle[vt]++;
    else totalDriversByVehicle.car++;
  }
  const activeDriversByVehicle = getOnlineDriversByVehicle();
  const liveDrivers = getOnlineDriversList();
  const onlineDrivers = getOnlineDriverCount();

  return res.json({
    onlineDrivers,
    pendingVerifications,
    todaysRides,
    pendingRides,
    totalRides,
    incomeCurrentMonth: Number(incomeCurrentMonth),
    incomePreviousMonth: Number(incomePreviousMonth),
    currentMonthLabel,
    previousMonthLabel,
    totalDriversByVehicle,
    activeDriversByVehicle,
    liveDrivers,
  });
});

/** GET /api/admin/income-by-month – Custom months income (query: from=YYYY-MM, to=YYYY-MM). Returns [{ month, total }, ...]. */
router.get('/income-by-month', authMiddleware, async (req, res) => {
  try {
    const from = req.query.from; // YYYY-MM
    const to = req.query.to;     // YYYY-MM
    if (!from || !to) {
      return res.status(400).json({ error: 'Query from and to (YYYY-MM) required', incomeByMonth: [] });
    }
    const [fromY, fromM] = from.split('-').map(Number);
    const [toY, toM] = to.split('-').map(Number);
    const start = new Date(fromY, (fromM || 1) - 1, 1, 0, 0, 0, 0);
    const end = new Date(toY, (toM || 12) - 1 + 1, 0, 23, 59, 59, 999);
    const rides = await Ride.findAll({
      where: { status: 'completed', createdAt: { [Op.gte]: start, [Op.lte]: end } },
      attributes: ['userPrice', 'createdAt'],
      raw: true,
    });
    const byMonth = {};
    for (const r of rides) {
      const d = new Date(r.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] || 0) + Number(r.userPrice || 0);
    }
    const incomeByMonth = Object.entries(byMonth).sort().map(([month, total]) => ({ month, total }));
    return res.json({ incomeByMonth });
  } catch (err) {
    console.error('[admin] income-by-month', err.message);
    return res.status(200).json({ incomeByMonth: [] });
  }
});

/** GET /api/admin/rides – List rides (user/driver app ka data). */
router.get('/rides', authMiddleware, async (_req, res) => {
  try {
    const rides = await Ride.findAll({
      order: [['createdAt', 'DESC']],
      include: [{ model: Message, attributes: ['id'] }],
    });
    const list = rides.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      pickupAddress: r.pickupAddress,
      dropAddress: r.dropAddress,
      status: r.status,
      vehicleType: r.vehicleType,
      userPrice: r.userPrice,
      messagesCount: (r.Messages || []).length,
    }));
    return res.json({ rides: list });
  } catch (err) {
    console.error('[admin] rides list', err.message);
    return res.status(200).json({ rides: [] });
  }
});

/** GET /api/admin/rides/:id – Single ride + messages (control panel detail). */
router.get('/rides/:id', authMiddleware, async (req, res) => {
  try {
    const ride = await Ride.findByPk(req.params.id, { include: [Message] });
    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }
    const msgList = (ride.Messages || []).slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const messages = msgList.map((m) => ({
      from: m.from,
      text: m.text,
      at: m.createdAt,
    }));
    return res.json({
      id: ride.id,
      createdAt: ride.createdAt,
      status: ride.status,
      vehicleType: ride.vehicleType,
      distanceKm: ride.distanceKm,
      pickupAddress: ride.pickupAddress,
      dropAddress: ride.dropAddress,
      userPrice: ride.userPrice,
      userPhone: ride.userPhone,
      driverPhone: ride.driverPhone,
      // Outstation fields
      outstationPassengers: ride.outstationPassengers || null,
      outstationComments: ride.outstationComments || null,
      outstationIsParcel: ride.outstationIsParcel || false,
      // Delivery fields
      deliveryComments: ride.deliveryComments || null,
      deliveryWeight: ride.deliveryWeight || null,
      deliveryPhotoUrl: ride.deliveryPhotoUrl || null,
      messages,
    });
  } catch (err) {
    console.error('[admin] ride detail', err.message);
    return res.status(200).json({ id: null, error: err.message, messages: [] });
  }
});

/** POST /api/admin/dispatcher/ride – Create ride from control panel (manual booking). */
router.post('/dispatcher/ride', authMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const ride = await Ride.create({
      pickupLat: body.pickupLat ?? 0,
      pickupLng: body.pickupLng ?? 0,
      dropLat: body.dropLat ?? 0,
      dropLng: body.dropLng ?? 0,
      pickupAddress: body.pickupAddress || '',
      dropAddress: body.dropAddress || '',
      distanceKm: body.distanceKm ?? 0,
      trafficDelayMins: body.trafficDelayMins ?? 0,
      vehicleType: body.vehicleType || 'car',
      userPrice: body.userPrice ?? 0,
      userPhone: body.userPhone || null,
      status: 'pending',
    });
    return res.status(201).json({ rideId: String(ride.id), message: 'Ride created. Drivers will see it in requests.' });
  } catch (err) {
    console.error('[admin] dispatcher ride', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/drivers – List drivers for verification (DriverVerification table) with documentsCount (x/7). */
router.get('/drivers', authMiddleware, async (_req, res) => {
  try {
    const list = await DriverVerification.findAll({ order: [['updatedAt', 'DESC']] });
    const driverIds = list.map((d) => d.driverId);
    const docCounts = {};
    const photoByDriverId = {};
    if (driverIds.length > 0) {
      const docs = await DriverDocument.findAll({
        where: { driverId: driverIds },
        attributes: ['driverId', 'documentType', 'fileUrl'],
        raw: true,
      });
      const seen = {};
      for (const doc of docs) {
        const key = `${doc.driverId}:${doc.documentType}`;
        if (!seen[key]) {
          seen[key] = true;
          docCounts[doc.driverId] = (docCounts[doc.driverId] || 0) + 1;
        }
        // Keep selfie as driver photo for admin lists.
        if (doc.documentType === 'selfie' && doc.fileUrl && !photoByDriverId[doc.driverId]) {
          photoByDriverId[doc.driverId] = doc.fileUrl;
        }
      }
    }
    const ratingsByDriverId = {};
    if (driverIds.length > 0) {
      try {
        const ratingRows = await Ride.findAll({
          where: { driverId: driverIds },
          attributes: ['driverId', [fn('AVG', col('userRating')), 'rating']],
          group: ['driverId'],
          raw: true,
        });
        for (const row of ratingRows) {
          if (row.rating != null) {
            ratingsByDriverId[row.driverId] = Number(row.rating);
          }
        }
      } catch (ratingErr) {
        console.warn('[admin] driver ratings:', ratingErr.message);
      }
    }
    return res.json({
      drivers: list.map((d) => ({
        id: d.driverId,
        driverId: d.driverId,
        status: d.status,
        vehicleType: d.vehicleType || 'car',
        vehiclePlate: d.vehiclePlate || null,
        driverName: d.driverName || null,
        blockReason: d.blockReason || null,
        city: null,
        phone: null,
        updatedAt: d.updatedAt,
        createdAt: d.createdAt,
        documentsCount: docCounts[d.driverId] || 0,
        photoUrl: photoByDriverId[d.driverId] || null,
        rating: ratingsByDriverId[d.driverId] ?? null,
      })),
    });
  } catch (err) {
    console.warn('[admin] drivers PG failed:', err.message);
    try {
      const fsList = await firestore.listDriverVerifications();
      return res.json({
        drivers: fsList.map((d) => ({
          id: d.driverId,
          driverId: d.driverId,
          status: d.status || 'pending',
          vehicleType: d.vehicleType || 'car',
          vehiclePlate: d.vehiclePlate || null,
          driverName: d.driverName || null,
          blockReason: d.blockReason || null,
          city: null,
          phone: null,
          updatedAt: d.updatedAt,
          documentsCount: 0,
          photoUrl: null,
          rating: null,
        })),
      });
    } catch (fsErr) {
      console.warn('[admin] drivers Firestore fallback failed:', fsErr.message);
      return res.status(200).json({ drivers: [] });
    }
  }
});

/** GET /api/admin/drivers/:id – Single driver detail (for Drivers module). */
router.get('/drivers/:id', authMiddleware, async (req, res) => {
  const driverId = req.params.id;
  if (!driverId) {
    return res.status(400).json({ error: 'driverId required' });
  }
  try {
    const row = await DriverVerification.findOne({ where: { driverId } });
    if (!row) {
      const fsRow = await firestore.getDriverVerificationByDriverId(driverId);
      if (!fsRow) return res.status(404).json({ error: 'Driver not found' });
      return res.json({
        driver: {
          id: fsRow.driverId,
          driverId: fsRow.driverId,
          status: fsRow.status || 'pending',
          vehicleType: fsRow.vehicleType || 'car',
          vehiclePlate: fsRow.vehiclePlate || null,
          driverName: fsRow.driverName || null,
          blockReason: fsRow.blockReason || null,
          adminNotes: null,
          customRatePerKm: fsRow.customRatePerKm ?? null,
          city: null,
          phone: null,
          updatedAt: fsRow.updatedAt,
          photoUrl: null,
          rating: null,
        },
      });
    }
    const docs = await DriverDocument.findAll({
      where: { driverId },
      attributes: ['documentType', 'fileUrl'],
      raw: true,
    });
    const selfie = docs.find((d) => d.documentType === 'selfie' && d.fileUrl);
    let rating = null;
    try {
      const ratingRow = await Ride.findOne({
        where: { driverId },
        attributes: [[fn('AVG', col('userRating')), 'rating']],
        raw: true,
      });
      if (ratingRow?.rating != null) {
        rating = Number(ratingRow.rating);
      }
    } catch (ratingErr) {
      console.warn('[admin] driver rating detail:', ratingErr.message);
    }
    return res.json({
      driver: {
        id: row.driverId,
        driverId: row.driverId,
        status: row.status,
        vehicleType: row.vehicleType || 'car',
        vehiclePlate: row.vehiclePlate || null,
        driverName: row.driverName || null,
        blockReason: row.blockReason || null,
        adminNotes: row.adminNotes || null,
        customRatePerKm: row.customRatePerKm != null ? Number(row.customRatePerKm) : null,
        city: null,
        phone: null,
        updatedAt: row.updatedAt,
        photoUrl: selfie?.fileUrl || null,
        rating,
      },
    });
  } catch (err) {
    console.warn('[admin] driver detail', err.message);
    try {
      const fsRow = await firestore.getDriverVerificationByDriverId(driverId);
      if (!fsRow) return res.status(404).json({ error: 'Driver not found' });
      return res.json({
        driver: {
          id: fsRow.driverId,
          driverId: fsRow.driverId,
          status: fsRow.status || 'pending',
          vehicleType: fsRow.vehicleType || 'car',
          vehiclePlate: fsRow.vehiclePlate || null,
          driverName: fsRow.driverName || null,
          blockReason: fsRow.blockReason || null,
          adminNotes: null,
          customRatePerKm: fsRow.customRatePerKm ?? null,
          city: null,
          phone: null,
          updatedAt: fsRow.updatedAt,
          photoUrl: null,
          rating: null,
        },
      });
    } catch (fsErr) {
      return res.status(200).json({ driver: null, error: err.message });
    }
  }
});

/** PATCH /api/admin/drivers/:id/rate – Set per-driver custom fare rate (S/ per km). */
router.patch('/drivers/:id/rate', authMiddleware, async (req, res) => {
  try {
    const driverId = req.params.id;
    if (!driverId) return res.status(400).json({ error: 'driverId required' });
    const raw = req.body?.customRatePerKm;
    const customRatePerKm = raw == null || raw === '' ? null : Number(raw);
    if (customRatePerKm != null && (!Number.isFinite(customRatePerKm) || customRatePerKm <= 0)) {
      return res.status(400).json({ error: 'customRatePerKm must be a positive number or null' });
    }
    const [row] = await DriverVerification.findOrCreate({
      where: { driverId },
      defaults: { driverId, status: 'pending' },
    });
    await row.update({ customRatePerKm });

    // Best-effort sync to Firestore driver_verifications
    try {
      await firestore.findOrCreateDriverVerification(driverId, { status: row.status || 'pending', vehicleType: row.vehicleType || 'car' });
      await firestore.updateDriverVerification(driverId, { customRatePerKm });
    } catch (syncErr) {
      console.warn('[admin] customRatePerKm Firestore sync skipped:', syncErr.message);
    }

    return res.json({ ok: true, customRatePerKm });
  } catch (err) {
    console.error('[admin] driver rate', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** PATCH /api/admin/drivers/:id/notes – Update internal admin notes (not shown to driver). */
router.patch('/drivers/:id/notes', authMiddleware, async (req, res) => {
  try {
    const driverId = req.params.id;
    const adminNotes = req.body?.adminNotes != null ? String(req.body.adminNotes).trim() || null : null;
    const [row] = await DriverVerification.findOrCreate({
      where: { driverId },
      defaults: { driverId, status: 'pending' },
    });
    await row.update({ adminNotes });
    return res.json({ ok: true, adminNotes });
  } catch (err) {
    console.error('[admin] drivers notes', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** PATCH /api/admin/drivers/:id/edit – Admin edit driver info (name, vehicleType, vehiclePlate, email). Changes reset status to pending for re-approval. */
router.patch('/drivers/:id/edit', authMiddleware, async (req, res) => {
  try {
    const driverId = req.params.id;
    const body = req.body || {};
    if (!driverId) return res.status(400).json({ error: 'driverId required' });
    const driverName = body.driverName != null ? String(body.driverName).trim() : undefined;
    const email = body.email != null ? String(body.email).trim() : undefined;
    const rawType = body.vehicleType != null ? String(body.vehicleType).trim().toLowerCase() : undefined;
    const rawPlate = body.vehiclePlate != null ? String(body.vehiclePlate).trim() : undefined;
    const vehicleType = rawType;
    const vehiclePlate = rawPlate ? rawPlate.toUpperCase().replace(/\s+/g, '') : undefined;
    const [row] = await DriverVerification.findOrCreate({
      where: { driverId },
      defaults: { driverId, status: 'pending' },
    });
    const wasApproved = row.status === 'approved';
    const current = {
      driverName: row.driverName || null,
      email: row.email || null,
      vehicleType: row.vehicleType || 'car',
      vehiclePlate: row.vehiclePlate || null,
    };
    // Duplicate vehicle plate guard
    if (vehiclePlate && vehiclePlate !== current.vehiclePlate) {
      const dup = await DriverVerification.findOne({ where: { vehiclePlate, driverId: { [Op.ne]: driverId } }, raw: true });
      if (dup && dup.driverId !== driverId) {
        // Mark this driver temp_blocked to prevent duplicate use; admin can resolve later.
        await row.update({
          status: 'temp_blocked',
          vehiclePlate,
          blockReason: 'Duplicate account / same vehicle. Please contact customer service.',
        });
        try {
          await DriverVerificationAudit.create({
            driverId,
            actor: req.admin?.sub || 'admin',
            action: 'temp_blocked',
            reason: 'Duplicate account / same vehicle.',
            oldStatus: wasApproved ? 'approved' : (row.status || 'pending'),
            newStatus: 'temp_blocked',
            metadata: { vehiclePlate },
          });
        } catch (_) {}
        try {
          await firestore.findOrCreateDriverVerification(driverId, {
            status: 'temp_blocked',
            vehicleType: vehicleType || current.vehicleType,
            vehiclePlate,
            driverName: driverName ?? current.driverName,
            blockReason: 'Duplicate account / same vehicle. Please contact customer service.',
          });
          await firestore.updateDriverVerification(driverId, {
            status: 'temp_blocked',
            vehicleType: vehicleType || current.vehicleType,
            vehiclePlate,
            driverName: driverName ?? current.driverName,
            blockReason: 'Duplicate account / same vehicle. Please contact customer service.',
          });
        } catch (_) {}
        return res.status(400).json({ ok: false, duplicateAccount: true, status: 'temp_blocked', message: 'Duplicate account found. Please contact customer service.' });
      }
    }
    const updates = {};
    let changed = false;
    if (driverName !== undefined && driverName !== current.driverName) { updates.driverName = driverName; changed = true; }
    if (email !== undefined && email !== current.email) { updates.email = email; changed = true; }
    if (vehicleType !== undefined && vehicleType !== current.vehicleType) { updates.vehicleType = vehicleType; changed = true; }
    if (vehiclePlate !== undefined && vehiclePlate !== current.vehiclePlate) { updates.vehiclePlate = vehiclePlate; changed = true; }
    if (changed) {
      if (wasApproved) updates.status = 'pending';
      updates.blockReason = null;
      updates.reuploadDocumentTypes = null;
      updates.reuploadMessage = null;
      await row.update(updates);
      try {
        await DriverVerificationAudit.create({
          driverId,
          actor: req.admin?.sub || 'admin',
          action: 'admin_edit',
          reason: null,
          oldStatus: wasApproved ? 'approved' : (row.status || 'pending'),
          newStatus: row.status || 'pending',
          metadata: { updates },
        });
      } catch (_) {}
      try {
        await firestore.findOrCreateDriverVerification(driverId, {
          status: row.status || 'pending',
          vehicleType: row.vehicleType || 'car',
          vehiclePlate: row.vehiclePlate || null,
          driverName: row.driverName || null,
          blockReason: null,
        });
        await firestore.updateDriverVerification(driverId, {
          status: row.status || 'pending',
          vehicleType: row.vehicleType || 'car',
          vehiclePlate: row.vehiclePlate || null,
          driverName: row.driverName || null,
          blockReason: null,
        });
      } catch (_) {}
    }
    return res.json({
      ok: true,
      driver: {
        driverId,
        status: row.status,
        vehicleType: row.vehicleType || 'car',
        vehiclePlate: row.vehiclePlate || null,
        driverName: row.driverName || null,
        email: row.email || null,
        blockReason: row.blockReason || null,
        updatedAt: row.updatedAt,
      },
    });
  } catch (err) {
    console.error('[admin] drivers edit', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/drivers/:id/verify – Set driver status: approved | rejected | temp_blocked | suspended. Optional blockReason. */
router.post('/drivers/:id/verify', authMiddleware, async (req, res) => {
  try {
    const driverId = req.params.id;
    const body = req.body || {};
    const statusMap = { approved: 'approved', rejected: 'rejected', temp_blocked: 'temp_blocked', suspended: 'suspended' };
    const status = statusMap[body.status] || 'approved';
    const blockReason = body.blockReason != null ? String(body.blockReason).trim() : null;
    const [row] = await DriverVerification.findOrCreate({
      where: { driverId },
      defaults: { driverId, status },
    });
    const oldStatus = row.status || 'pending';
    const updates = { status };
    if (status === 'temp_blocked' || status === 'suspended' || status === 'rejected') {
      updates.blockReason = blockReason || row.blockReason;
    } else {
      updates.blockReason = null;
    }
    if (status === 'approved') {
      updates.reuploadDocumentTypes = null;
      updates.reuploadMessage = null;
    }
    await row.update(updates);

    // Audit log
    try {
      await DriverVerificationAudit.create({
        driverId,
        actor: req.admin?.sub || 'admin',
        action: status,
        reason: updates.blockReason || blockReason || null,
        oldStatus,
        newStatus: status,
        metadata: null,
      });
    } catch (auditErr) {
      console.warn('[admin] driver verify – audit insert skipped:', auditErr.message);
    }

    // Best-effort sync to Firestore driver_verifications so that driver app online/offline rules match admin actions.
    try {
      await firestore.findOrCreateDriverVerification(driverId, {
        status,
        vehicleType: row.vehicleType || 'car',
        vehiclePlate: row.vehiclePlate || null,
        driverName: row.driverName || null,
        blockReason: updates.blockReason || null,
      });
      await firestore.updateDriverVerification(driverId, {
        status,
        vehicleType: row.vehicleType || 'car',
        vehiclePlate: row.vehiclePlate || null,
        driverName: row.driverName || null,
        blockReason: updates.blockReason || null,
      });
    } catch (syncErr) {
      console.warn('[admin] driver verify – Firestore sync skipped:', syncErr.message);
    }

    console.info('[admin] driver verify', {
      admin: req.admin?.sub,
      driverId,
      status,
    });

    return res.json({ ok: true, driverId, status, blockReason: updates.blockReason || null });
  } catch (err) {
    console.error('[admin] verify', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/drivers/:id/request-reupload – Request driver to re-upload specific documents. Body: { documentTypes: string[], message?: string }. */
router.post('/drivers/:id/request-reupload', authMiddleware, async (req, res) => {
  try {
    const driverId = req.params.id;
    const body = req.body || {};
    const rawTypes = Array.isArray(body.documentTypes) ? body.documentTypes : [];
    const documentTypes = rawTypes.map((t) => String(t).trim()).filter((t) => t.length > 0);
    const message = body.message != null ? String(body.message).trim() : null;
    if (documentTypes.length === 0) {
      return res.status(400).json({ error: 'documentTypes array with at least one document type is required' });
    }
    const allowed = ['brevete_frente', 'brevete_dorso', 'dni', 'selfie', 'soat', 'tarjeta_propiedad', 'foto_vehiculo'];
    const invalid = documentTypes.filter((t) => !allowed.includes(t));
    if (invalid.length > 0) {
      return res.status(400).json({ error: 'Invalid document types: ' + invalid.join(', ') });
    }
    const [row] = await DriverVerification.findOrCreate({
      where: { driverId },
      defaults: { driverId, status: 'pending' },
    });
    await row.update({
      reuploadDocumentTypes: documentTypes,
      reuploadMessage: message || null,
    });
    try {
      await DriverVerificationAudit.create({
        driverId,
        actor: req.admin?.sub || 'admin',
        action: 'reupload_requested',
        reason: message || null,
        oldStatus: row.status,
        newStatus: row.status,
        metadata: { documentTypes },
      });
    } catch (auditErr) {
      console.warn('[admin] request-reupload audit skipped:', auditErr.message);
    }
    return res.json({ ok: true, driverId, documentTypes, message: message || null });
  } catch (err) {
    console.error('[admin] request-reupload', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/drivers/:id/audit – Audit log for driver verification actions. */
router.get('/drivers/:id/audit', authMiddleware, async (req, res) => {
  try {
    const driverId = req.params.id;
    if (!driverId) return res.status(400).json({ error: 'driverId required', entries: [] });
    const entries = await DriverVerificationAudit.findAll({
      where: { driverId },
      order: [['createdAt', 'DESC']],
      limit: 100,
      attributes: ['id', 'actor', 'action', 'reason', 'oldStatus', 'newStatus', 'metadata', 'createdAt'],
      raw: true,
    });
    return res.json({
      entries: entries.map((e) => ({
        id: e.id,
        actor: e.actor,
        action: e.action,
        reason: e.reason || null,
        oldStatus: e.oldStatus || null,
        newStatus: e.newStatus || null,
        metadata: e.metadata || null,
        createdAt: e.createdAt,
      })),
    });
  } catch (err) {
    console.error('[admin] drivers audit', err.message);
    return res.status(500).json({ entries: [] });
  }
});

/** GET /api/admin/wallet-transactions – List all. Query: ?status= &from=YYYY-MM-DD &to=YYYY-MM-DD &driverId= */
router.get('/wallet-transactions', authMiddleware, async (req, res) => {
  try {
    const status = (req.query.status || '').trim() || null;
    const from = (req.query.from || '').trim() || null;
    const to = (req.query.to || '').trim() || null;
    const driverId = (req.query.driverId || '').trim() || null;
    const where = {};
    // Ensure table exists (helps first-time setups where migrations are pending).
    await WalletTransaction.sync();
    if (status) where.status = status;
    if (driverId) where.driverId = { [Op.iLike]: `%${driverId}%` };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt[Op.gte] = new Date(from + 'T00:00:00.000Z');
      if (to) where.createdAt[Op.lte] = new Date(to + 'T23:59:59.999Z');
    }
    const rows = await WalletTransaction.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: 500,
    });
    const driverIds = Array.from(new Set(rows.map((r) => r.driverId).filter(Boolean)));
    const driverNames = {};
    if (driverIds.length > 0) {
      const nameRows = await DriverVerification.findAll({
        where: { driverId: driverIds },
        attributes: ['driverId', 'driverName'],
        raw: true,
      });
      for (const row of nameRows) {
        if (row.driverName) {
          driverNames[row.driverId] = row.driverName;
        }
      }
    }
    const list = rows.map((r) => ({
      id: String(r.id),
      driverId: r.driverId,
      driverName: driverNames[r.driverId] || null,
      amountSoles: r.amountSoles,
      creditsAmount: r.creditsAmount,
      transactionId: r.transactionId,
      screenshotUrl: r.screenshotUrl,
      status: r.status,
      adminNote: r.adminNote,
      createdAt: r.createdAt,
      approvedAt: r.approvedAt || null,
    }));
    return res.json({ transactions: list });
  } catch (err) {
    console.error('[admin] wallet-transactions', err.message);
    return res.status(200).json({ transactions: [] });
  }
});

/** POST /api/admin/wallet-transactions/:id/approve – Add credits to driver, set status=approved. Credits valid 1 year from approval. Ledger + approvedAt + lastRechargeAt. */
router.post('/wallet-transactions/:id/approve', authMiddleware, async (req, res) => {
  try {
    const tx = await WalletTransaction.findByPk(req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    if (tx.status !== 'pending') return res.status(400).json({ error: 'Transaction already processed' });
    const overrideCredits = req.body?.creditsAmount != null ? Number(req.body.creditsAmount) : NaN;
    const creditsToAdd = !Number.isNaN(overrideCredits) && overrideCredits >= 0 ? Math.floor(overrideCredits) : tx.creditsAmount;
    const [wallet] = await DriverWallet.findOrCreate({
      where: { driverId: tx.driverId },
      defaults: { driverId: tx.driverId, balance: 0 },
    });
    await wallet.increment('balance', { by: creditsToAdd });
    await wallet.reload();
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    const newValidUntil = oneYearFromNow.toISOString().slice(0, 10);
    const currentValid = wallet.creditsValidUntil ? String(wallet.creditsValidUntil).slice(0, 10) : null;
    const keepLater = currentValid && currentValid > newValidUntil ? currentValid : newValidUntil;
    const now = new Date();
    await wallet.update({
      creditsValidUntil: keepLater,
      lastRechargeAt: now,
      rejectedRechargeCount: 0,
    });
    await tx.update({ status: 'approved', approvedAt: now });
    await WalletLedger.create({
      driverId: tx.driverId,
      type: 'recharge',
      creditsChange: creditsToAdd,
      refId: String(tx.id),
    });
    return res.json({ ok: true, newBalance: wallet.balance, creditsValidUntil: keepLater });
  } catch (err) {
    console.error('[admin] wallet approve', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/wallet-transactions/:id/decline – Set status=declined, adminNote required. Increment driver rejectedRechargeCount (fraud). */
router.post('/wallet-transactions/:id/decline', authMiddleware, async (req, res) => {
  try {
    const tx = await WalletTransaction.findByPk(req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    if (tx.status !== 'pending') return res.status(400).json({ error: 'Transaction already processed' });
    const adminNote = (req.body && req.body.adminNote) ? String(req.body.adminNote).trim() : '';
    if (!adminNote) return res.status(400).json({ error: 'Reason for decline is required (adminNote)' });
    await tx.update({ status: 'declined', adminNote });
    const [wallet] = await DriverWallet.findOrCreate({
      where: { driverId: tx.driverId },
      defaults: { driverId: tx.driverId, balance: 0 },
    });
    await wallet.increment('rejectedRechargeCount', { by: 1 });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[admin] wallet decline', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/wallet-transactions/:id/needs-pdf – Set status=needs_pdf. */
router.post('/wallet-transactions/:id/needs-pdf', authMiddleware, async (req, res) => {
  try {
    const tx = await WalletTransaction.findByPk(req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    if (tx.status !== 'pending') return res.status(400).json({ error: 'Transaction already processed' });
    const adminNote = (req.body && req.body.adminNote) ? String(req.body.adminNote) : 'Please submit PDF document.';
    await tx.update({ status: 'needs_pdf', adminNote });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[admin] wallet needs-pdf', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/recharge-requests – Legacy alias; returns pending wallet-transactions as requests. */
router.get('/recharge-requests', authMiddleware, async (req, res) => {
  try {
    const rows = await WalletTransaction.findAll({
      where: { status: 'pending' },
      order: [['createdAt', 'DESC']],
      limit: 100,
    });
    const requests = rows.map((r) => ({
      id: String(r.id),
      userId: r.driverId,
      driverId: r.driverId,
      amount: r.amountSoles,
      creditsAmount: r.creditsAmount,
      transactionId: r.transactionId,
      screenshotUrl: r.screenshotUrl,
      status: r.status,
      createdAt: r.createdAt,
    }));
    return res.json({ requests });
  } catch (err) {
    console.error('[admin] recharge-requests', err.message);
    return res.status(200).json({ requests: [] });
  }
});

/** GET /api/admin/agencies – Stub; baad mein DB. */
router.get('/agencies', authMiddleware, (_req, res) => {
  return res.json({ agencies: [] });
});

// ─── Travel agency verification (Tours > Agency Verification sub-tab) ───────────

const AGENCY_DOC_TYPES = ['business_license', 'tax_id', 'id_proof', 'company_registration'];

/** GET /api/admin/travel-agencies – List agencies (verification + payouts). Query: ?status=pending|approved|rejected|needs_documents */
router.get('/travel-agencies', authMiddleware, async (req, res) => {
  try {
    const status = (req.query.status || '').trim() || null;
    const where = status ? { status } : {};
    const list = await TravelAgency.findAll({
      where,
      include: [
        { model: Tour, as: 'Tours', attributes: ['id'], required: false },
        { model: AgencyWallet, as: 'AgencyWallet', attributes: ['balance', 'currency'], required: false },
      ],
      order: [['createdAt', 'DESC']],
      limit: 200,
    });
    return res.json({
      agencies: list.map((a) => ({
        id: String(a.id),
        name: a.name,
        email: a.email,
        phone: a.phone,
        country: a.country,
        currency: a.currency,
        status: a.status,
        verificationNote: a.verificationNote || null,
        toursCount: (a.Tours || []).length,
        balance: a.AgencyWallet ? Number(a.AgencyWallet.balance) : 0,
        balanceCurrency: a.AgencyWallet?.currency || a.currency || 'USD',
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
    });
  } catch (err) {
    console.error('[admin] travel-agencies list', err.message);
    return res.status(200).json({ agencies: [] });
  }
});

/** GET /api/admin/travel-agencies/:id – Single agency with documents for review */
router.get('/travel-agencies/:id', authMiddleware, async (req, res) => {
  try {
    const agency = await TravelAgency.findByPk(req.params.id, {
      include: [{ model: AgencyDocument, as: 'AgencyDocuments' }],
    });
    if (!agency) return res.status(404).json({ error: 'Agency not found' });
    const docs = (agency.AgencyDocuments || []).map((d) => ({
      id: d.id,
      documentType: d.documentType,
      fileUrl: d.fileUrl,
      fileName: d.fileName,
      createdAt: d.createdAt,
    }));
    return res.json({
      id: String(agency.id),
      name: agency.name,
      email: agency.email,
      phone: agency.phone,
      country: agency.country,
      currency: agency.currency,
      status: agency.status,
      verificationNote: agency.verificationNote || null,
      createdAt: agency.createdAt,
      updatedAt: agency.updatedAt,
      documents: docs,
      requiredDocTypes: AGENCY_DOC_TYPES,
    });
  } catch (err) {
    console.error('[admin] travel-agencies detail', err.message);
    return res.status(200).json({ agency: null, error: err.message });
  }
});

/** POST /api/admin/travel-agencies/:id/verify – Approve | reject | request_documents. Sends email to agency. */
router.post('/travel-agencies/:id/verify', authMiddleware, async (req, res) => {
  try {
    const agency = await TravelAgency.findByPk(req.params.id);
    if (!agency) return res.status(404).json({ error: 'Agency not found' });
    const body = req.body || {};
    const action = (body.action || '').trim();
    const note = (body.note != null ? String(body.note) : '').trim() || null;
    if (!['approve', 'reject', 'request_documents'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use approve, reject, or request_documents.' });
    }
    let newStatus;
    if (action === 'approve') newStatus = 'approved';
    else if (action === 'reject') newStatus = 'rejected';
    else newStatus = 'needs_documents';
    await agency.update({
      status: newStatus,
      verificationNote: note,
    });
    await sendAgencyVerificationEmail(agency.email, agency.name, newStatus, note || '');
    return res.json({ ok: true, agencyId: String(agency.id), status: newStatus });
  } catch (err) {
    console.error('[admin] travel-agencies verify', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Tours (Attractions) – Admin approve/reject ───────────────────────────────────

/** GET /api/admin/tours – List all tours. Query: ?status=pending|approved|rejected|suspended */
router.get('/tours', authMiddleware, async (req, res) => {
  try {
    const status = (req.query.status || '').trim() || null;
    const where = status ? { status } : {};
    const tours = await Tour.findAll({
      where,
      include: [{ model: TravelAgency, as: 'TravelAgency', attributes: ['id', 'name', 'country', 'currency'] }],
      order: [['createdAt', 'DESC']],
      limit: 100,
    });
    const list = tours.map((t) => {
      const imgs = Array.isArray(t.images) ? t.images : [];
      return {
        id: String(t.id),
        title: t.title,
        country: t.country,
        city: t.city,
        location: t.location,
        category: t.category,
        status: t.status,
        agencyName: t.TravelAgency?.name,
        agencyId: t.TravelAgency ? String(t.TravelAgency.id) : null,
        thumbnailUrl: imgs[0] || null,
        hasPendingChanges: !!t.pendingChangeSummary,
        createdAt: t.createdAt,
      };
    });
    return res.json({ tours: list });
  } catch (err) {
    console.error('[admin] tours list', err.message);
    return res.status(200).json({ tours: [] });
  }
});

/** GET /api/admin/tours/:id – Tour detail (for approval view) */
router.get('/tours/:id', authMiddleware, async (req, res) => {
  try {
    const tour = await Tour.findByPk(req.params.id, {
      include: [
        { model: TravelAgency, as: 'TravelAgency' },
        { model: TourPaxOption, as: 'TourPaxOptions' },
        { model: TourSlot, as: 'TourSlots' },
      ],
    });
    if (!tour) return res.status(404).json({ error: 'Tour not found' });
    return res.json({
      id: String(tour.id),
      title: tour.title,
      country: tour.country,
      city: tour.city,
      location: tour.location,
      category: tour.category,
      description: tour.description,
      includedServices: tour.includedServices,
      images: tour.images || [],
      videoUrl: tour.videoUrl || null,
      durationMins: tour.durationMins,
      meetingPoint: tour.meetingPoint,
      cancellationPolicy: tour.cancellationPolicy,
      languages: tour.languages || [],
      status: tour.status,
      pendingChangeSummary: tour.pendingChangeSummary || null,
      suspendReason: tour.suspendReason || null,
      suspendFixInstructions: tour.suspendFixInstructions || null,
      agency: tour.TravelAgency ? {
        id: String(tour.TravelAgency.id),
        name: tour.TravelAgency.name,
        email: tour.TravelAgency.email,
        phone: tour.TravelAgency.phone,
        country: tour.TravelAgency.country,
        currency: tour.TravelAgency.currency,
        status: tour.TravelAgency.status,
      } : null,
      paxOptions: (tour.TourPaxOptions || []).map((p) => ({
        id: String(p.id),
        label: p.label,
        pricePerPax: p.pricePerPax,
        currency: p.currency,
      })),
      slots: (tour.TourSlots || [])
        .sort((a, b) => (a.slotDate > b.slotDate ? 1 : -1))
        .slice(0, 50)
        .map((s) => ({
        id: String(s.id),
        slotDate: s.slotDate,
        startTime: s.startTime,
        endTime: s.endTime,
        maxPax: s.maxPax,
        bookedPax: s.bookedPax,
      })),
      createdAt: tour.createdAt,
      updatedAt: tour.updatedAt,
    });
  } catch (err) {
    console.error('[admin] tour detail', err.message);
    return res.status(200).json({ tour: null, error: err.message });
  }
});

/** POST /api/admin/tours/:id/approve – Set status=approved, clear pending changes */
router.post('/tours/:id/approve', authMiddleware, async (req, res) => {
  try {
    const tour = await Tour.findByPk(req.params.id);
    if (!tour) return res.status(404).json({ error: 'Tour not found' });
    await tour.update({ status: 'approved', pendingChangeSummary: null, suspendReason: null, suspendFixInstructions: null });
    return res.json({ ok: true, status: 'approved' });
  } catch (err) {
    console.error('[admin] tour approve', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/tours/:id/reject – Set status=rejected */
router.post('/tours/:id/reject', authMiddleware, async (req, res) => {
  try {
    const tour = await Tour.findByPk(req.params.id);
    if (!tour) return res.status(404).json({ error: 'Tour not found' });
    await tour.update({ status: 'rejected' });
    return res.json({ ok: true, status: 'rejected' });
  } catch (err) {
    console.error('[admin] tour reject', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/tours/:id/suspend – Set status=suspended (temp). Body: { reason, fixInstructions } */
router.post('/tours/:id/suspend', authMiddleware, async (req, res) => {
  try {
    const tour = await Tour.findByPk(req.params.id);
    if (!tour) return res.status(404).json({ error: 'Tour not found' });
    const reason = (req.body?.reason && String(req.body.reason).trim()) || null;
    const fixInstructions = (req.body?.fixInstructions && String(req.body.fixInstructions).trim()) || null;
    if (!reason || !fixInstructions) {
      return res.status(400).json({ error: 'Reason and fix instructions are required for suspend' });
    }
    await tour.update({
      status: 'suspended',
      suspendReason: reason,
      suspendFixInstructions: fixInstructions,
    });
    return res.json({ ok: true, status: 'suspended' });
  } catch (err) {
    console.error('[admin] tour suspend', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/tours/:id/block – Set status=blocked. Agent cannot create same tour again. */
router.post('/tours/:id/block', authMiddleware, async (req, res) => {
  try {
    const tour = await Tour.findByPk(req.params.id);
    if (!tour) return res.status(404).json({ error: 'Tour not found' });
    await tour.update({
      status: 'blocked',
      suspendReason: null,
      suspendFixInstructions: null,
    });
    return res.json({ ok: true, status: 'blocked' });
  } catch (err) {
    console.error('[admin] tour block', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/tours/:id/reinstate – Unblock, set to pending for review */
router.post('/tours/:id/reinstate', authMiddleware, async (req, res) => {
  try {
    const tour = await Tour.findByPk(req.params.id);
    if (!tour) return res.status(404).json({ error: 'Tour not found' });
    if (tour.status !== 'blocked') {
      return res.status(400).json({ error: 'Only blocked tours can be reinstated' });
    }
    await tour.update({ status: 'pending', suspendReason: null, suspendFixInstructions: null });
    return res.json({ ok: true, status: 'pending' });
  } catch (err) {
    console.error('[admin] tour reinstate', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/agency-payouts – List agency payout requests */
router.get('/agency-payouts', authMiddleware, async (req, res) => {
  try {
    const status = (req.query.status || '').trim() || null;
    const travelAgencyId = req.query.travelAgencyId ? parseInt(req.query.travelAgencyId, 10) : null;
    const where = {};
    if (status) where.status = status;
    if (travelAgencyId) where.travelAgencyId = travelAgencyId;
    const list = await AgencyPayoutRequest.findAll({
      where,
      include: [{ model: TravelAgency, as: 'TravelAgency', attributes: ['id', 'name', 'email', 'phone'] }],
      order: [['createdAt', 'DESC']],
      limit: 100,
    });
    return res.json({
      payouts: list.map((p) => ({
        id: String(p.id),
        travelAgencyId: p.travelAgencyId,
        agencyName: p.TravelAgency?.name,
        agencyEmail: p.TravelAgency?.email,
        amount: p.amount,
        currency: p.currency,
        gatewayCharges: p.gatewayCharges,
        transferFee: p.transferFee,
        netAmount: p.netAmount,
        bankDetails: p.bankDetails,
        status: p.status,
        adminNote: p.adminNote,
        createdAt: p.createdAt,
        processedAt: p.processedAt,
      })),
    });
  } catch (err) {
    console.error('[admin] agency-payouts', err.message);
    return res.status(200).json({ payouts: [] });
  }
});

/** Helper: fetch bookings for agency (last 90 days, paid/completed) for payout email */
async function getBookingsForPayoutEmail(travelAgencyId) {
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const rows = await TourBooking.findAll({
    where: {
      travelAgencyId,
      status: { [Op.in]: ['paid', 'completed'] },
      createdAt: { [Op.gte]: since },
    },
    include: [
      { model: Tour, as: 'Tour', attributes: ['title'] },
      { model: TourSlot, as: 'TourSlot', attributes: ['slotDate', 'startTime', 'endTime'] },
    ],
    order: [['createdAt', 'DESC']],
    limit: 500,
  });
  return rows.map((b) => ({
    id: b.id,
    tourTitle: b.Tour?.title,
    slotDate: b.TourSlot?.slotDate,
    slotStartTime: b.TourSlot?.startTime,
    slotEndTime: b.TourSlot?.endTime,
    guestName: b.guestName,
    guestEmail: b.guestEmail,
    totalAmount: b.totalAmount,
    currency: b.currency,
    createdAt: b.createdAt,
  }));
}

/** POST /api/admin/agency-payouts/:id/complete – Complete payout: deduct gateway + transfer fee, send email with PDF/Excel */
router.post('/agency-payouts/:id/complete', authMiddleware, async (req, res) => {
  try {
    const payout = await AgencyPayoutRequest.findByPk(req.params.id, {
      include: [{ model: TravelAgency, as: 'TravelAgency', attributes: ['id', 'name', 'email'] }],
    });
    if (!payout) return res.status(404).json({ error: 'Payout not found' });
    if (payout.status !== 'pending') return res.status(400).json({ error: 'Payout already processed' });

    const gatewayPercent = req.body?.gatewayPercent != null ? Number(req.body.gatewayPercent) : (parseFloat(process.env.PAYOUT_GATEWAY_PERCENT, 10) || 2);
    const transferFeeFixed = req.body?.transferFee != null ? Number(req.body.transferFee) : (parseFloat(process.env.PAYOUT_TRANSFER_FEE, 10) || 5);
    const gatewayCharges = (payout.amount * gatewayPercent) / 100;
    const transferFee = transferFeeFixed;
    const netAmount = Math.max(0, payout.amount - gatewayCharges - transferFee);

    await payout.update({
      status: 'completed',
      processedAt: new Date(),
      gatewayCharges,
      transferFee,
      netAmount,
    });

    const bookings = await getBookingsForPayoutEmail(payout.travelAgencyId);
    const agencyName = payout.TravelAgency?.name;
    const agencyEmail = payout.TravelAgency?.email;
    const payoutObj = { ...payout.get({ plain: true }), gatewayCharges, transferFee, netAmount };
    const [pdfBuffer, excelBuffer] = await Promise.all([
      buildPdfBuffer(payoutObj, agencyName, bookings),
      Promise.resolve(buildExcelBuffer(payoutObj, agencyName, bookings)),
    ]);
    if (agencyEmail) await sendPayoutEmail(agencyEmail, agencyName, payoutObj, bookings, pdfBuffer, excelBuffer);

    return res.json({
      ok: true,
      status: 'completed',
      gatewayCharges,
      transferFee,
      netAmount,
      emailSent: !!agencyEmail,
    });
  } catch (err) {
    console.error('[admin] agency-payout complete', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/agency-payouts/create – Admin-initiated payout: pay any agency now (deduct wallet, send email with PDF/Excel) */
router.post('/agency-payouts/create', authMiddleware, async (req, res) => {
  try {
    const { travelAgencyId, amount, gatewayPercent, transferFee } = req.body || {};
    const agencyId = travelAgencyId != null ? parseInt(travelAgencyId, 10) : NaN;
    const amt = amount != null ? Number(amount) : NaN;
    if (Number.isNaN(agencyId) || Number.isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: 'travelAgencyId and positive amount required' });
    }

    const agency = await TravelAgency.findByPk(agencyId, { attributes: ['id', 'name', 'email'] });
    if (!agency) return res.status(404).json({ error: 'Agency not found' });

    const [wallet] = await AgencyWallet.findOrCreate({
      where: { travelAgencyId: agencyId },
      defaults: { travelAgencyId: agencyId, balance: 0, currency: 'USD' },
    });
    if (wallet.balance < amt) {
      return res.status(400).json({ error: 'Insufficient agency balance', balance: wallet.balance });
    }

    const gatewayPercentVal = gatewayPercent != null ? Number(gatewayPercent) : (parseFloat(process.env.PAYOUT_GATEWAY_PERCENT, 10) || 2);
    const transferFeeVal = transferFee != null ? Number(transferFee) : (parseFloat(process.env.PAYOUT_TRANSFER_FEE, 10) || 5);
    const gatewayCharges = (amt * gatewayPercentVal) / 100;
    const transferFeeAmount = transferFeeVal;
    const netAmount = Math.max(0, amt - gatewayCharges - transferFeeAmount);

    await wallet.decrement('balance', { by: amt });

    const payout = await AgencyPayoutRequest.create({
      travelAgencyId: agencyId,
      amount: amt,
      currency: wallet.currency || 'USD',
      status: 'completed',
      processedAt: new Date(),
      gatewayCharges,
      transferFee: transferFeeAmount,
      netAmount,
    });

    const bookings = await getBookingsForPayoutEmail(agencyId);
    const payoutObj = payout.get ? payout.get({ plain: true }) : payout;
    const [pdfBuffer, excelBuffer] = await Promise.all([
      buildPdfBuffer(payoutObj, agency.name, bookings),
      Promise.resolve(buildExcelBuffer(payoutObj, agency.name, bookings)),
    ]);
    if (agency.email) await sendPayoutEmail(agency.email, agency.name, payoutObj, bookings, pdfBuffer, excelBuffer);

    return res.status(201).json({
      ok: true,
      id: String(payout.id),
      netAmount,
      gatewayCharges,
      transferFee: transferFeeAmount,
      emailSent: !!agency.email,
    });
  } catch (err) {
    console.error('[admin] agency-payout create', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/agency-payouts/:id/reject – Reject payout (refund to agency wallet) */
router.post('/agency-payouts/:id/reject', authMiddleware, async (req, res) => {
  try {
    const payout = await AgencyPayoutRequest.findByPk(req.params.id);
    if (!payout) return res.status(404).json({ error: 'Payout not found' });
    if (payout.status !== 'pending') return res.status(400).json({ error: 'Payout already processed' });
    const adminNote = (req.body && req.body.adminNote) ? String(req.body.adminNote) : null;
    await payout.update({ status: 'rejected', adminNote, processedAt: new Date() });
    const [wallet] = await AgencyWallet.findOrCreate({
      where: { travelAgencyId: payout.travelAgencyId },
      defaults: { travelAgencyId: payout.travelAgencyId, balance: 0, currency: payout.currency },
    });
    await wallet.increment('balance', { by: payout.amount });
    return res.json({ ok: true, status: 'rejected', message: 'Amount refunded to agency wallet' });
  } catch (err) {
    console.error('[admin] agency-payout reject', err.message);
    return res.status(500).json({ error: err.message });
  }
});

const SETTINGS_KEY = 'global';

/** GET /api/admin/settings – From DB (key=global); default if no row. */
router.get('/settings', authMiddleware, async (_req, res) => {
  try {
    const row = await AdminSettings.findByPk(SETTINGS_KEY);
    return res.json({
      commissionPercent: row ? row.commissionPercent : 10,
      notificationsEnabled: row ? row.notificationsEnabled !== false : true,
    });
  } catch (err) {
    console.error('[admin] get settings', err.message);
    return res.json({ commissionPercent: 10, notificationsEnabled: true });
  }
});

/** POST /api/admin/settings – Persist to DB (upsert key=global). */
router.post('/settings', authMiddleware, async (req, res) => {
  try {
    const commissionPercent = req.body && req.body.commissionPercent != null ? Number(req.body.commissionPercent) : 10;
    const notificationsEnabled = req.body && req.body.notificationsEnabled !== false;
    const [row] = await AdminSettings.findOrCreate({ where: { key: SETTINGS_KEY }, defaults: { key: SETTINGS_KEY, commissionPercent: 10, notificationsEnabled: true } });
    await row.update({ commissionPercent, notificationsEnabled });
    return res.json({ ok: true, message: 'Settings saved.' });
  } catch (err) {
    console.error('[admin] post settings', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/feature-flags – Attractions etc. Default: attractions ON. */
router.get('/feature-flags', authMiddleware, async (_req, res) => {
  try {
    const row = await FeatureFlag.findByPk('attractions_enabled');
    const attractionsEnabled = row ? !!row.value : true;
    return res.json({ attractionsEnabled });
  } catch (err) {
    console.error('[admin] feature-flags', err.message);
    return res.json({ attractionsEnabled: true });
  }
});

/** POST /api/admin/feature-flags – Toggle Attractions (or other flags). */
router.post('/feature-flags', authMiddleware, async (req, res) => {
  try {
    const attractionsEnabled = req.body && req.body.attractionsEnabled !== false;
    const [row] = await FeatureFlag.findOrCreate({
      where: { key: 'attractions_enabled' },
      defaults: { key: 'attractions_enabled', value: true },
    });
    await row.update({ value: attractionsEnabled });
    return res.json({ ok: true, attractionsEnabled });
  } catch (err) {
    console.error('[admin] post feature-flags', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
