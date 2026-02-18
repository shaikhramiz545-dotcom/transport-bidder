const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db/firestore');
const { DriverVerification, DriverDocument, DriverIdentity } = require('../models');
const { authenticate, requireRole } = require('../utils/auth');

const router = express.Router();

// All driver endpoints require authentication
router.use(authenticate);

async function resolveAuthDriverId(req) {
  const phone = req.auth?.phone ? String(req.auth.phone).trim() : '';
  if (!phone) return null;
  const row = await DriverIdentity.findOne({ where: { phone }, raw: true });
  return row?.driverId ? String(row.driverId) : null;
}

/** Peru driver document types (Step 1: personal; Step 2: vehicle). */
const DRIVER_DOC_TYPES = ['brevete_frente', 'brevete_dorso', 'dni', 'selfie', 'soat', 'tarjeta_propiedad', 'foto_vehiculo'];

const driverDocsRoot = path.join(__dirname, '..', '..', 'uploads', 'driver-docs');
const driverDocStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const driverId = (req.body && req.body.driverId) ? String(req.body.driverId).replace(/[^a-zA-Z0-9_-]/g, '') : 'unknown';
    const dir = path.join(driverDocsRoot, driverId);
    try {
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (e) {
      cb(e, null);
    }
  },
  filename: (req, file, cb) => {
    const docType = (req.body && req.body.documentType) ? String(req.body.documentType).replace(/[^a-z0-9_]/g, '') : 'doc';
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${docType}${ext}`);
  },
});
const uploadDriverDoc = multer({ storage: driverDocStorage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB

// In-memory: driverId -> { lat, lng, updatedAt, vehicleType }
const onlineDrivers = new Map();
const DRIVER_STALE_MS = 60 * 1000; // 1 min – remove if no update
const VEHICLE_TYPES = ['car', 'bike', 'taxi', 'van', 'truck', 'car_hauler', 'ambulance'];

// Vehicle-type based search radius (km) for matching drivers to rides
const VEHICLE_RADIUS_KM = {
  taxi: 6,
  car: 6,
  van: 10, // delivery rides map to van category; 10km radius for delivery/van
  bike: 5,
  truck: 25,
  ambulance: 15,
};
const DEFAULT_RADIUS_KM = 6;

/**
 * Map ride vehicleType (from user app, e.g. taxi_std, truck_m, moto, amb_icu)
 * to driver vehicleType category (taxi, truck, bike, ambulance, etc.).
 */
function rideVehicleToDriverCategory(rideVehicleType) {
  if (!rideVehicleType) return null;
  const vt = String(rideVehicleType).toLowerCase().trim();
  if (vt.startsWith('taxi')) return 'taxi';
  if (vt.startsWith('truck') || vt === 'car_hauler') return 'truck';
  if (vt === 'moto' || vt.startsWith('bike')) return 'bike';
  if (vt.startsWith('amb')) return 'ambulance';
  if (vt === 'delivery') return 'van'; // delivery drivers use van category
  if (vt === 'car' || vt === 'van') return vt;
  return null;
}

/** Get search radius for a given driver vehicle category. */
function getRadiusForVehicle(driverVehicleCategory) {
  return VEHICLE_RADIUS_KM[driverVehicleCategory] || DEFAULT_RADIUS_KM;
}

// Testing aid: allow going online / receiving requests without verification gate.
// Enable only in dev/staging: set BYPASS_DRIVER_VERIFICATION=true
const BYPASS_DRIVER_VERIFICATION = String(process.env.BYPASS_DRIVER_VERIFICATION || '').toLowerCase() === 'true';

// NOTE: Short, human-readable driver id when client doesn't send one.
// Format: d-12345 (5–7 digits). This keeps existing API field (driverId) intact,
// but avoids very long random IDs in Admin and logs.
function generateShortDriverId() {
  const min = 10000; // 5 digits
  const max = 9999999; // up to 7 digits
  const n = Math.floor(min + Math.random() * (max - min));
  return `d-${n}`;
}

/** For control panel: count drivers that reported location in last DRIVER_STALE_MS. */
function getOnlineDriverCount() {
  const now = Date.now();
  let count = 0;
  for (const [, v] of onlineDrivers.entries()) {
    if (now - v.updatedAt <= DRIVER_STALE_MS) count++;
  }
  return count;
}

/** Active drivers by vehicle type (for dashboard). */
function getOnlineDriversByVehicle() {
  const now = Date.now();
  const out = { car: 0, bike: 0, taxi: 0, van: 0, truck: 0, car_hauler: 0, ambulance: 0 };
  for (const [, v] of onlineDrivers.entries()) {
    if (now - v.updatedAt > DRIVER_STALE_MS) continue;
    const vt = (v.vehicleType || 'car').toLowerCase();
    if (out[vt] !== undefined) out[vt]++;
    else out.car++;
  }
  return out;
}

/** List of live drivers (id, vehicleType, lat, lng) for dashboard. */
function getOnlineDriversList() {
  const now = Date.now();
  const list = [];
  for (const [id, v] of onlineDrivers.entries()) {
    if (now - v.updatedAt > DRIVER_STALE_MS) continue;
    list.push({ driverId: id, vehicleType: v.vehicleType || 'car', lat: v.lat, lng: v.lng });
  }
  return list;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  return phone.trim();
}

/** Get verification status for driver. Prefer PostgreSQL (admin source of truth), then Firestore. */
async function getVerificationStatus(driverId) {
  const id = String(driverId);
  try {
    const pgRow = await DriverVerification.findOne({ where: { driverId: id }, attributes: ['status', 'blockReason'], raw: true });
    if (pgRow) return { status: pgRow.status || 'pending', blockReason: pgRow.blockReason || null };
  } catch (pgErr) {
    console.warn('[drivers] getVerificationStatus PG skipped:', pgErr.message);
  }
  try {
    const row = await db.getDriverVerificationByDriverId(id);
    return { status: row ? row.status : 'pending', blockReason: row ? row.blockReason : null };
  } catch (fsErr) {
    console.warn('[drivers] getVerificationStatus Firestore skipped:', fsErr.message);
  }
  return { status: 'pending', blockReason: null };
}

const REQUIRED_DOC_COUNT = DRIVER_DOC_TYPES.length; // 7

/**
 * Check if driver can go online: approved, all 7 docs uploaded, SOAT not expired, not suspended.
 * Returns { canGoOnline: boolean, reason?: string, code?: string }.
 */
async function canGoOnline(driverId) {
  const id = String(driverId);
  const { status, blockReason } = await getVerificationStatus(id);
  if (status !== 'approved') {
    const reason = blockReason || (status === 'pending' ? 'Profile pending approval.' : 'Account temporarily blocked. Please contact customer service.');
    return { canGoOnline: false, reason, code: 'DRIVER_NOT_APPROVED' };
  }
  try {
    const docs = await DriverDocument.findAll({ where: { driverId: id }, attributes: ['documentType', 'expiryDate'], raw: true });
    const types = [...new Set(docs.map((d) => d.documentType))];
    if (types.length < REQUIRED_DOC_COUNT) {
      console.info('[drivers] canGoOnline false', { driverId: id, reason: 'DOC_MISSING', count: types.length });
      return { canGoOnline: false, reason: 'Missing required documents. Please upload all 7 documents.', code: 'DOC_MISSING' };
    }
    const soat = docs.find((d) => d.documentType === 'soat');
    if (soat && soat.expiryDate) {
      const today = new Date().toISOString().slice(0, 10);
      if (soat.expiryDate < today) {
        console.info('[drivers] canGoOnline false', { driverId: id, reason: 'SOAT_EXPIRED', expiryDate: soat.expiryDate });
        return { canGoOnline: false, reason: 'SOAT expired. Please renew and re-upload.', code: 'SOAT_EXPIRED' };
      }
    }
  } catch (err) {
    console.warn('[drivers] canGoOnline doc check failed:', err.message);
    return { canGoOnline: false, reason: 'Unable to verify documents. Please try again.', code: 'DOC_CHECK_FAILED' };
  }
  return { canGoOnline: true };
}

// Driver app: report location when on duty. Only approved drivers can go online.
router.post('/location', requireRole('driver'), async (req, res) => {
  const { driverId, lat, lng, vehicleType, phone } = req.body || {};
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ ok: false, message: 'lat, lng required' });
  }
  const incomingDriverId = driverId ? String(driverId).trim() : '';
  const incomingPhone = req.auth?.phone ? String(req.auth.phone).trim() : normalizePhone(phone);
  let id = incomingDriverId;
  let resolvedFromPhone = false;

  if (incomingPhone) {
    try {
      const byPhone = await DriverIdentity.findOne({ where: { phone: incomingPhone }, raw: true });
      if (byPhone?.driverId) {
        if (incomingDriverId && incomingDriverId !== byPhone.driverId) {
          console.warn('[drivers] driverId mismatch for phone', { phone: incomingPhone, provided: incomingDriverId, mapped: byPhone.driverId });
        }
        id = byPhone.driverId;
        resolvedFromPhone = true;
      }
    } catch (err) {
      console.warn('[drivers] identity lookup skipped:', err.message);
    }
  }

  // If driverId not provided by client, create a short random one (single source of truth: only from Go Online).
  if (!id) {
    id = generateShortDriverId();
    console.log('[drivers] New driverId created:', id);
  }

  // Only enforce verification when driverId was already known (provided or resolved from phone).
  if (!BYPASS_DRIVER_VERIFICATION && (incomingDriverId || resolvedFromPhone)) {
    try {
      const { status, blockReason } = await getVerificationStatus(id);
      if (status !== 'approved') {
        onlineDrivers.delete(id);
        const message = blockReason || (status === 'pending' ? 'Profile pending re-approval.' : 'Account temporarily blocked. Please contact customer service.');
        return res.status(403).json({
          ok: false,
          blocked: true,
          status,
          blockReason: blockReason || null,
          code: 'DRIVER_NOT_APPROVED',
          message,
        });
      }
      const go = await canGoOnline(id);
      if (!go.canGoOnline) {
        onlineDrivers.delete(id);
        return res.status(403).json({
          ok: false,
          blocked: true,
          status: 'approved',
          blockReason: go.reason || null,
          code: go.code || 'CANNOT_GO_ONLINE',
          message: go.reason || 'You cannot go online at this time.',
        });
      }
    } catch (err) {
      console.error('[drivers] location status check', err.message);
      return res.status(403).json({ ok: false, blocked: true, status: 'pending', code: 'DRIVER_NOT_APPROVED', message: 'Profile pending approval.' });
    }
  }

  // Keep phone -> driverId mapping stable for future restores.
  if (incomingPhone) {
    try {
      const byDriverId = await DriverIdentity.findOne({ where: { driverId: id } });
      if (byDriverId) {
        if (byDriverId.phone !== incomingPhone) {
          await byDriverId.update({ phone: incomingPhone });
        }
      } else {
        await DriverIdentity.create({ phone: incomingPhone, driverId: id });
      }
    } catch (err) {
      console.warn('[drivers] identity save skipped:', err.message);
    }
  }

  const vt = vehicleType && VEHICLE_TYPES.includes(String(vehicleType).toLowerCase()) ? String(vehicleType).toLowerCase() : 'car';
  onlineDrivers.set(id, { lat, lng, updatedAt: Date.now(), vehicleType: vt });

  res.json({ ok: true, driverId: id });

  for (const [k, v] of onlineDrivers.entries()) {
    if (Date.now() - v.updatedAt > DRIVER_STALE_MS) onlineDrivers.delete(k);
  }
});

// Driver app: going offline
router.post('/offline', requireRole('driver'), async (req, res) => {
  const { driverId } = req.body || {};
  const authDriverId = await resolveAuthDriverId(req);
  const requestedDriverId = driverId ? String(driverId).trim() : '';
  const finalDriverId = authDriverId || requestedDriverId;
  if (authDriverId && requestedDriverId && requestedDriverId !== authDriverId) {
    return res.status(403).json({ ok: false, error: 'Forbidden' });
  }
  if (finalDriverId) onlineDrivers.delete(finalDriverId);
  res.json({ ok: true });
});

/** POST /api/drivers/fcm-token – Driver app: register/update FCM token for push notifications. */
router.post('/fcm-token', requireRole('driver'), async (req, res) => {
  try {
    const token = req.body && req.body.token ? String(req.body.token).trim() : '';
    const platform = req.body && req.body.platform ? String(req.body.platform).trim() : null;
    if (!token) return res.status(400).json({ ok: false, error: 'token required' });

    const phone = req.auth?.phone ? String(req.auth.phone).trim() : '';
    const authDriverId = await resolveAuthDriverId(req);
    const requestedDriverId = req.body && req.body.driverId ? String(req.body.driverId).trim() : '';
    const driverId = authDriverId || requestedDriverId || null;
    if (authDriverId && requestedDriverId && requestedDriverId !== authDriverId) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    await db.upsertDriverFcmToken({ phone: phone || null, driverId, token, platform });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[drivers] fcm-token', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/** GET /api/drivers/resolve-id?phone=xxx – Resolve stable driverId from phone (no creation). */
router.get('/resolve-id', requireRole('driver'), async (req, res) => {
  try {
    const phone = req.auth?.phone ? String(req.auth.phone).trim() : normalizePhone(req.query.phone);
    if (!phone) return res.json({ ok: false, driverId: null });
    const row = await DriverIdentity.findOne({ where: { phone }, raw: true });
    return res.json({ ok: true, driverId: row?.driverId || null });
  } catch (err) {
    console.warn('[drivers] resolve-id failed:', err.message);
    return res.status(500).json({ ok: false, driverId: null, message: 'Resolve failed' });
  }
});

// User app: count drivers within radius, filtered by vehicle type
// Query: lat, lng, vehicleType (optional, e.g. taxi_std, moto, truck_m), radiusKm (optional override)
router.get('/nearby', requireRole('passenger'), (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const rideVehicleType = req.query.vehicleType || null;
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ count: 0, message: 'lat, lng required' });
  }

  // Determine driver category and radius from ride vehicle type
  const driverCategory = rideVehicleType ? rideVehicleToDriverCategory(rideVehicleType) : null;
  const radiusKm = driverCategory
    ? getRadiusForVehicle(driverCategory)
    : Math.min(parseFloat(req.query.radiusKm) || 6, 30);

  const now = Date.now();
  let count = 0;
  for (const [, v] of onlineDrivers.entries()) {
    if (now - v.updatedAt > DRIVER_STALE_MS) continue;
    // Filter by vehicle type if specified
    if (driverCategory) {
      const dvt = (v.vehicleType || 'car').toLowerCase();
      if (dvt !== driverCategory) continue;
    }
    if (haversineKm(lat, lng, v.lat, v.lng) <= radiusKm) count++;
  }
  res.json({ count, radiusKm, vehicleCategory: driverCategory });
});

/** Normalize vehicle plate for duplicate check (trim, uppercase). */
function normalizePlate(plate) {
  if (plate == null || typeof plate !== 'string') return '';
  return String(plate).trim().toUpperCase().replace(/\s+/g, '') || '';
}

router.get('/profile', requireRole('driver'), async (req, res) => {
  try {
    const authDriverId = await resolveAuthDriverId(req);
    const requestedDriverId = req.query.driverId;
    const driverId = authDriverId || requestedDriverId;
    if (!driverId) return res.status(400).json({ ok: false, message: 'driverId required' });
    if (authDriverId && requestedDriverId && String(requestedDriverId).trim() !== String(authDriverId).trim()) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    let profile = null;
    try {
      const fsRow = await db.getDriverVerificationByDriverId(String(driverId));
      if (fsRow) {
        profile = {
          driverName: fsRow.driverName || null,
          email: fsRow.email || null,
          vehicleType: fsRow.vehicleType || null,
          vehiclePlate: fsRow.vehiclePlate || null,
        };
      }
    } catch (_) {}

    if (!profile) {
      const row = await DriverVerification.findOne({
        where: { driverId: String(driverId) },
        attributes: ['driverName', 'email', 'vehicleType', 'vehiclePlate'],
        raw: true,
      });
      if (row) {
        profile = {
          driverName: row.driverName || null,
          email: row.email || null,
          vehicleType: row.vehicleType || null,
          vehiclePlate: row.vehiclePlate || null,
        };
      }
    }

    return res.json({ ok: true, profile: profile ?? {} });
  } catch (err) {
    console.error('[drivers] profile', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

/** GET /api/drivers/verification-status?driverId=xxx – Driver app: verification status + blockReason + canGoOnline + reuploadRequested. */
router.get('/verification-status', requireRole('driver'), async (req, res) => {
  try {
    const authDriverId = await resolveAuthDriverId(req);
    const requestedDriverId = req.query.driverId;
    const driverId = authDriverId || requestedDriverId;
    if (!driverId) {
      return res.status(400).json({
        status: 'pending',
        blockReason: null,
        canGoOnline: false,
        reuploadRequested: null,
        hasVerification: false,
        documentsCount: 0,
      });
    }
    const { status, blockReason } = await getVerificationStatus(driverId);
    const go = await canGoOnline(driverId);
    let reuploadRequested = null;
    let hasVerification = false;
    let documentsCount = 0;
    let vehicleType = null;
    try {
      const row = await DriverVerification.findOne({
        where: { driverId: String(driverId) },
        attributes: ['reuploadDocumentTypes', 'reuploadMessage', 'vehicleType'],
        raw: true,
      });
      if (row) hasVerification = true;
      if (row?.vehicleType) vehicleType = String(row.vehicleType).trim().toLowerCase();
      const types = row?.reuploadDocumentTypes;
      if (Array.isArray(types) && types.length > 0) {
        reuploadRequested = {
          documentTypes: types.filter((t) => DRIVER_DOC_TYPES.includes(String(t))),
          message: row.reuploadMessage || null,
        };
        if (reuploadRequested.documentTypes.length === 0) reuploadRequested = null;
      }
    } catch (_) {}
    if (!hasVerification) {
      try {
        const fsRow = await db.getDriverVerificationByDriverId(driverId);
        if (fsRow) {
          hasVerification = true;
          if (!vehicleType && fsRow.vehicleType) vehicleType = String(fsRow.vehicleType).trim().toLowerCase();
        }
      } catch (_) {}
    }
    try {
      const docs = await DriverDocument.findAll({
        where: { driverId: String(driverId) },
        attributes: ['documentType'],
        raw: true,
      });
      const unique = new Set((docs || []).map((d) => d.documentType));
      documentsCount = unique.size;
    } catch (_) {}
    return res.json({
      status,
      blockReason: blockReason || null,
      canGoOnline: go.canGoOnline,
      blockCode: go.canGoOnline ? null : (go.code || null),
      reuploadRequested,
      hasVerification,
      documentsCount,
      vehicleType: vehicleType || null,
    });
  } catch (err) {
    console.error('[drivers] verification-status', err.message);
    return res.status(500).json({
      status: 'pending',
      blockReason: null,
      canGoOnline: false,
      reuploadRequested: null,
      hasVerification: false,
      documentsCount: 0,
    });
  }
});

/** POST /api/drivers/verification-register – Driver app: register/update profile. Duplicate vehicle → temp_block. Edit after approve → pending. */
router.post('/verification-register', requireRole('driver'), async (req, res) => {
  try {
    const body = req.body || {};
    const authDriverId = await resolveAuthDriverId(req);
    const requestedDriverId = (body.driverId && String(body.driverId).trim()) || '';
    const driverId = authDriverId || requestedDriverId;
    if (!driverId) return res.status(400).json({ ok: false, message: 'driverId required' });
    if (authDriverId && requestedDriverId && requestedDriverId !== authDriverId) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const hasVehiclePlate = body.vehiclePlate != null;
    const hasDriverName = body.driverName != null;
    const hasVehicleType = body.vehicleType != null;
    const hasEmail = body.email != null;

    const vehiclePlate = hasVehiclePlate ? normalizePlate(body.vehiclePlate) : '';
    const driverName = hasDriverName ? String(body.driverName).trim() : null;
    const vehicleTypeInput = hasVehicleType ? String(body.vehicleType).trim() : null;
    const vehicleType = vehicleTypeInput || 'car';
    const email = hasEmail ? String(body.email).trim() : null; // Minimal fix: email extract kiya

    let finalStatus = 'pending';
    let usedFirestore = false;

    let firestoreChanged = false;
    let plateChanged = false;
    let nameChanged = false;
    let typeChanged = false;

    try {
      const { row, created } = await db.findOrCreateDriverVerification(driverId, {
        status: 'pending',
        vehicleType,
        vehiclePlate: vehiclePlate || null,
        driverName,
        email, // Minimal fix: email bhi save karo
      });
      usedFirestore = true;
      const wasApproved = row.status === 'approved';
      const currentPlate = row.vehiclePlate || null;
      const currentName = row.driverName || null;
      const currentType = row.vehicleType || 'car';
      const nextPlate = hasVehiclePlate ? (vehiclePlate || null) : currentPlate;
      const nextName = hasDriverName ? driverName : currentName;
      const currentEmail = row.email || null;
      const nextEmail = hasEmail ? email : currentEmail;
      const nextType = hasVehicleType ? vehicleType : currentType;

      plateChanged = hasVehiclePlate && currentPlate !== nextPlate;
      nameChanged = hasDriverName && currentName !== nextName;
      let emailChanged = hasEmail && currentEmail !== nextEmail;
      typeChanged = hasVehicleType && currentType !== nextType;

      if (hasVehiclePlate && plateChanged && nextPlate) {
        const existing = await db.getDriverVerificationByVehiclePlate(nextPlate);
        if (existing && existing.driverId !== driverId) {
          await db.findOrCreateDriverVerification(driverId, {
            status: 'temp_blocked',
            vehiclePlate: nextPlate,
            driverName: nextName,
            blockReason: 'Duplicate account / same vehicle. Please contact customer service.',
          });
          await db.updateDriverVerification(driverId, {
            status: 'temp_blocked',
            vehiclePlate: nextPlate,
            driverName: nextName || null,
            blockReason: 'Duplicate account / same vehicle. Please contact customer service.',
          });
          return res.status(400).json({
            ok: false,
            duplicateAccount: true,
            status: 'temp_blocked',
            message: 'Duplicate account found. Please contact customer service.',
          });
        }
      }

      const updates = {};
      if (plateChanged) updates.vehiclePlate = nextPlate;
      if (nameChanged) updates.driverName = nextName;
      if (typeChanged) updates.vehicleType = nextType;
      if (emailChanged) updates.email = nextEmail; // Minimal fix: email update
      if (Object.keys(updates).length) {
        if (wasApproved && (plateChanged || nameChanged)) updates.status = 'pending';
        updates.blockReason = null;
        await db.updateDriverVerification(driverId, updates);
        const updated = await db.getDriverVerificationByDriverId(driverId);
        finalStatus = (updated || row).status || 'pending';
        firestoreChanged = true;
      } else {
        finalStatus = row.status || 'pending';
      }
    } catch (fsErr) {
      console.warn('[drivers] verification-register Firestore skipped:', fsErr.message);
      // Fall through to PostgreSQL-only path
    }

    // Always write to PostgreSQL (for Admin Panel); fallback when Firestore not configured
    try {
      const [pgRow, pgCreated] = await DriverVerification.findOrCreate({
        where: { driverId },
        defaults: {
          driverId,
          status: finalStatus,
          vehicleType,
          vehiclePlate: vehiclePlate || null,
          driverName,
          email, // Minimal fix: email bhi save karo
          blockReason: null,
        },
      });
      const pgCurrentPlate = pgRow.vehiclePlate || null;
      const pgCurrentName = pgRow.driverName || null;
      const pgCurrentType = pgRow.vehicleType || 'car';
      const pgNextPlate = hasVehiclePlate ? (vehiclePlate || null) : pgCurrentPlate;
      const pgNextName = hasDriverName ? driverName : pgCurrentName;
      const pgCurrentEmail = pgRow.email || null;
      const pgNextEmail = hasEmail ? email : pgCurrentEmail;
      const pgNextType = hasVehicleType ? vehicleType : pgCurrentType;
      const pgPlateChanged = hasVehiclePlate && pgCurrentPlate !== pgNextPlate;
      const pgNameChanged = hasDriverName && pgCurrentName !== pgNextName;
      const pgEmailChanged = hasEmail && pgCurrentEmail !== pgNextEmail;
      const pgTypeChanged = hasVehicleType && pgCurrentType !== pgNextType;

      const pgUpdates = {};
      if (pgPlateChanged) pgUpdates.vehiclePlate = pgNextPlate;
      if (pgNameChanged) pgUpdates.driverName = pgNextName;
      if (pgTypeChanged) pgUpdates.vehicleType = pgNextType;
      if (pgEmailChanged) pgUpdates.email = pgNextEmail; // Minimal fix: email update
      if (usedFirestore) {
        if (firestoreChanged) {
          pgUpdates.status = finalStatus;
          pgUpdates.blockReason = null;
        }
      } else if (Object.keys(pgUpdates).length) {
        const wasApproved = pgRow.status === 'approved';
        if (wasApproved && (pgPlateChanged || pgNameChanged)) {
          pgUpdates.status = 'pending';
        }
        pgUpdates.blockReason = null;
      }
      if (pgCreated && !Object.keys(pgUpdates).length) {
        pgUpdates.status = finalStatus;
        pgUpdates.vehicleType = vehicleType;
        pgUpdates.vehiclePlate = vehiclePlate || null;
        pgUpdates.driverName = driverName;
        pgUpdates.email = email; // Minimal fix: email bhi save karo
      }
      if (Object.keys(pgUpdates).length) await pgRow.update(pgUpdates);
      if (!usedFirestore) {
        finalStatus = pgUpdates.status || pgRow.status || finalStatus || 'pending';
      }
    } catch (pgErr) {
      console.error('[drivers] verification-register PG failed:', pgErr.message);
      if (!usedFirestore) {
        return res.status(500).json({ ok: false, message: 'Database error. Run: npm run migrate' });
      }
    }
    return res.json({ ok: true, status: finalStatus });
  } catch (err) {
    console.error('[drivers] verification-register', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

/** POST /api/drivers/documents – Driver app: upload one verification document (multipart: file, driverId, documentType). */
router.post('/documents', requireRole('driver'), uploadDriverDoc.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, message: 'No file uploaded' });
    const authDriverId = await resolveAuthDriverId(req);
    const requestedDriverId = (req.body && req.body.driverId) ? String(req.body.driverId).trim() : '';
    const driverId = authDriverId || requestedDriverId;
    const documentType = (req.body && req.body.documentType) ? String(req.body.documentType).trim() : '';
    if (!driverId) return res.status(400).json({ ok: false, message: 'driverId required' });
    if (authDriverId && requestedDriverId && requestedDriverId !== authDriverId) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }
    if (!documentType || !DRIVER_DOC_TYPES.includes(documentType)) {
      return res.status(400).json({ ok: false, message: 'documentType must be one of: ' + DRIVER_DOC_TYPES.join(', ') });
    }
    // Guard: when verification is pending and no specific reupload is requested, block uploads.
    try {
      const row = await DriverVerification.findOne({
        where: { driverId },
        attributes: ['status', 'reuploadDocumentTypes'],
        raw: true,
      });
      if (row && row.status === 'pending') {
        const types = Array.isArray(row.reuploadDocumentTypes) ? row.reuploadDocumentTypes : [];
        // Minimal fix: Agar admin ne reuploadDocumentTypes set nahi kiya, toh upload allow karo
        if (types.length > 0) {
          const allowed = types.includes(documentType);
          if (!allowed) {
            return res.status(400).json({
              ok: false,
              message: 'Your documents are under review',
              code: 'UNDER_REVIEW',
            });
          }
        }
      }
    } catch (e) {
      // If status check fails, fall back to existing behavior so uploads don't break unexpectedly.
      console.warn('[drivers] documents status check skipped:', e.message);
    }
    const relativePath = `driver-docs/${driverId}/${req.file.filename}`;
    const fileUrl = `/uploads/${relativePath}`;
    const [doc] = await DriverDocument.findOrCreate({
      where: { driverId, documentType },
      defaults: { driverId, documentType, fileUrl, fileName: req.file.originalname || req.file.filename },
    });
    if (doc && (doc.fileUrl !== fileUrl || doc.fileName !== (req.file.originalname || req.file.filename))) {
      await doc.update({ fileUrl, fileName: req.file.originalname || req.file.filename });
    }
    // Ensure a DriverVerification row exists so admin panel sees this driver as pending
    try {
      await DriverVerification.findOrCreate({
        where: { driverId },
        defaults: { driverId, status: 'pending' },
      });
    } catch (dvErr) {
      console.warn('[drivers] documents: DriverVerification findOrCreate skipped:', dvErr.message);
    }
    return res.json({ ok: true, documentType, fileUrl, fileName: req.file.originalname || req.file.filename });
  } catch (err) {
    console.error('[drivers] documents upload', err.message);
    return res.status(500).json({ ok: false, message: err.message || 'Upload failed' });
  }
});

/** GET /api/drivers/documents?driverId=xxx – List uploaded documents for a driver (app or admin). */
router.get('/documents', requireRole('driver'), async (req, res) => {
  try {
    const authDriverId = await resolveAuthDriverId(req);
    const requestedDriverId = (req.query.driverId && String(req.query.driverId).trim()) || '';
    const driverId = authDriverId || requestedDriverId;
    if (!driverId) return res.status(400).json({ documents: [] });
    if (authDriverId && requestedDriverId && requestedDriverId !== authDriverId) {
      return res.status(403).json({ documents: [] });
    }
    const list = await DriverDocument.findAll({
      where: { driverId },
      order: [['createdAt', 'ASC']],
      attributes: ['id', 'documentType', 'fileUrl', 'fileName', 'expiryDate', 'createdAt'],
      raw: true,
    });
    return res.json({
      documents: list.map((d) => ({
        id: d.id,
        documentType: d.documentType,
        fileUrl: d.fileUrl,
        fileName: d.fileName,
        expiryDate: d.expiryDate || null,
        createdAt: d.createdAt,
      })),
    });
  } catch (err) {
    console.error('[drivers] documents list', err.message);
    return res.status(500).json({ documents: [] });
  }
});

/** GET /api/drivers/requests – Driver app: list pending ride requests.
 *  Filters: online + vehicle type match + radius (Taxi 6km, Bike 5km, Truck 25km, Ambulance 15km).
 *  Only approved drivers get requests. */
router.get('/requests', requireRole('driver'), async (req, res) => {
  try {
    const authDriverId = await resolveAuthDriverId(req);
    const requestedDriverId = (req.query.driverId && String(req.query.driverId).trim()) || null;
    const driverId = authDriverId || requestedDriverId;
    if (!BYPASS_DRIVER_VERIFICATION && driverId) {
      const { status } = await getVerificationStatus(driverId);
      if (status !== 'approved') {
        return res.json({ requests: [] });
      }
    }

    // Get this driver's live location and vehicle type from onlineDrivers map
    const driverInfo = driverId ? onlineDrivers.get(driverId) : null;
    const now = Date.now();
    const isOnline = driverInfo && (now - driverInfo.updatedAt <= DRIVER_STALE_MS);

    if (!isOnline) {
      // Driver not online or stale – no requests
      return res.json({ requests: [] });
    }

    const driverVehicle = (driverInfo.vehicleType || 'car').toLowerCase();
    const driverLat = driverInfo.lat;
    const driverLng = driverInfo.lng;

    const rides = await db.listRides({ status: 'pending', limit: 50 });

    // Filter rides: vehicle type match + within radius
    const requests = [];
    for (const r of rides) {
      // Map ride vehicleType (e.g. taxi_std, truck_m, moto) to driver category (taxi, truck, bike)
      const rideCategory = rideVehicleToDriverCategory(r.vehicleType);
      if (rideCategory && rideCategory !== driverVehicle) continue; // vehicle mismatch

      // Radius check: pickup location must be within vehicle-type radius of driver
      const radiusKm = getRadiusForVehicle(driverVehicle);
      const pickupLat = r.pickupLat;
      const pickupLng = r.pickupLng;
      if (typeof pickupLat === 'number' && typeof pickupLng === 'number') {
        const dist = haversineKm(driverLat, driverLng, pickupLat, pickupLng);
        if (dist > radiusKm) continue; // too far
      }

      requests.push({
        id: String(r.id),
        pickupAddress: r.pickupAddress || '',
        dropAddress: r.dropAddress || '',
        distanceKm: r.distanceKm,
        trafficDelayMins: r.trafficDelayMins,
        userPrice: r.userPrice,
        vehicleType: r.vehicleType,
        pickup: { lat: r.pickupLat, lng: r.pickupLng },
        drop: { lat: r.dropLat, lng: r.dropLng },
        userRating: r.userRating,
        userPhotoUrl: r.userPhotoUrl,
        // Outstation fields
        outstationPassengers: r.outstationPassengers || null,
        outstationComments: r.outstationComments || null,
        outstationIsParcel: r.outstationIsParcel || false,
        // Delivery fields
        deliveryComments: r.deliveryComments || null,
        deliveryWeight: r.deliveryWeight || null,
        deliveryPhotoUrl: r.deliveryPhotoUrl || null,
      });
    }
    return res.json({ requests });
  } catch (err) {
    console.error('[drivers] requests', err.message);
    return res.status(500).json({ error: err.message, requests: [] });
  }
});

module.exports = router;
module.exports.getOnlineDriverCount = getOnlineDriverCount;
module.exports.getOnlineDriversByVehicle = getOnlineDriversByVehicle;
module.exports.getOnlineDriversList = getOnlineDriversList;
module.exports.onlineDrivers = onlineDrivers;
module.exports.DRIVER_STALE_MS = DRIVER_STALE_MS;
module.exports.rideVehicleToDriverCategory = rideVehicleToDriverCategory;
module.exports.getRadiusForVehicle = getRadiusForVehicle;
module.exports.haversineKm = haversineKm;
