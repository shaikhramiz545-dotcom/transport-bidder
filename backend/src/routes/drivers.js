const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { s3Client, BUCKET_NAME } = require('../config/s3');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const db = require('../db/firestore');
const { DriverVerification, DriverDocument, DriverIdentity, AppUser } = require('../models');
const { pool } = require('../config/db');
const { authenticate, requireRole } = require('../utils/auth');
const { getClient: getRedis } = require('../services/redis');

const router = express.Router();

// Timestamp validation windows (documents + profile photo)
const MAX_PAST_WINDOW = 60 * 60 * 1000; // 1 hour in ms
const FUTURE_TOLERANCE = 10 * 60 * 1000; // 10 minutes in ms

// All driver endpoints require authentication
router.use(authenticate);

async function resolveAuthDriverId(req) {
  // PRIMARY: Use Firebase Auth UID (single source of truth)
  const authUid = req.auth?.userId || req.auth?.uid || req.auth?.sub;
  if (authUid) {
    try {
      const r = await pool.query('SELECT "driverId" FROM "DriverVerifications" WHERE "authUid" = $1 LIMIT 1', [String(authUid)]);
      if (r.rows[0]?.driverId) return String(r.rows[0].driverId);
    } catch (authUidErr) {
      console.warn('[drivers] resolveAuthDriverId authUid lookup skipped:', authUidErr.message);
    }
  }

  // FALLBACK 1: Phone mapping (for existing drivers without authUid)
  const phone = req.auth?.phone ? String(req.auth.phone).trim() : '';
  if (phone) {
    const row = await DriverIdentity.findOne({ where: { phone }, raw: true });
    if (row?.driverId) {
      if (authUid) {
        try { await pool.query('UPDATE "DriverVerifications" SET "authUid" = $1 WHERE "driverId" = $2 AND "authUid" IS NULL', [String(authUid), row.driverId]); } catch (_) {}
      }
      return String(row.driverId);
    }
  }

  // FALLBACK 2: Email + name matching (legacy support)
  const email = req.auth?.email ? String(req.auth.email).trim().toLowerCase() : '';
  if (email) {
    try {
      const appUser = await AppUser.findOne({ where: { email }, attributes: ['name', 'phone'], raw: true });
      if (appUser?.name) {
        const r = await pool.query('SELECT "driverId" FROM "DriverVerifications" WHERE email = $1 AND "driverName" = $2 LIMIT 1', [email, appUser.name]);
        if (r.rows[0]?.driverId) {
          if (authUid) {
            try { await pool.query('UPDATE "DriverVerifications" SET "authUid" = $1 WHERE "driverId" = $2 AND "authUid" IS NULL', [String(authUid), r.rows[0].driverId]); } catch (_) {}
          }
          if (phone) { try { await DriverIdentity.findOrCreate({ where: { phone }, defaults: { phone, driverId: r.rows[0].driverId } }); } catch (_) {} }
          return String(r.rows[0].driverId);
        }
      }
    } catch (_) {}
  }
  return null;
}

/** Peru driver document types (Step 1: personal; Step 2: vehicle). */
const DRIVER_DOC_TYPES = ['brevete_frente', 'brevete_dorso', 'dni', 'selfie', 'soat', 'tarjeta_propiedad', 'foto_vehiculo'];

const DRIVER_DOC_URL_ALIASES = {
  brevete_frente: ['breveteFrenteUrl', 'brevete_frente_url', 'licenseFrontUrl', 'license_front_url'],
  brevete_dorso: ['breveteDorsoUrl', 'brevete_dorso_url', 'licenseBackUrl', 'license_back_url'],
  dni: ['dniUrl', 'dni_url'],
  selfie: ['selfieUrl', 'selfie_url', 'photoUrl', 'photo_url'],
  soat: ['soatUrl', 'soat_url'],
  tarjeta_propiedad: ['tarjetaPropiedadUrl', 'tarjeta_propiedad_url', 'propertyCardUrl', 'property_card_url'],
  foto_vehiculo: ['fotoVehiculoUrl', 'foto_vehiculo_url', 'vehiclePhotoUrl', 'vehicle_photo_url'],
};

function cleanString(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeDocumentUrl(value) {
  const url = cleanString(value);
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/uploads/')) return url;
  return null;
}

function extractDocumentUrlsFromBody(body = {}) {
  const urls = {};
  const direct = body.documentUrls && typeof body.documentUrls === 'object' ? body.documentUrls : null;

  for (const docType of DRIVER_DOC_TYPES) {
    let url = null;
    if (direct) {
      url = sanitizeDocumentUrl(direct[docType]);
    }
    if (!url) {
      const aliases = DRIVER_DOC_URL_ALIASES[docType] || [];
      for (const key of aliases) {
        const fromBody = sanitizeDocumentUrl(body[key]);
        if (fromBody) {
          url = fromBody;
          break;
        }
      }
    }
    if (url) urls[docType] = url;
  }
  return urls;
}

function fileNameFromUrl(fileUrl, fallback) {
  try {
    const noQuery = String(fileUrl).split('?')[0];
    const last = noQuery.split('/').filter(Boolean).pop();
    return decodeURIComponent(last || fallback);
  } catch (_) {
    return fallback;
  }
}

async function upsertDriverDocumentRecord(driverId, documentType, fileUrl, metadata = {}) {
  const defaults = {
    driverId,
    documentType,
    fileUrl,
    fileName: fileNameFromUrl(fileUrl, `${documentType}.jpg`),
  };
  if (metadata.issueDate) defaults.issueDate = metadata.issueDate;
  if (metadata.expiryDate) defaults.expiryDate = metadata.expiryDate;
  if (metadata.policyNumber) defaults.policyNumber = metadata.policyNumber;
  if (metadata.insuranceCompany) defaults.insuranceCompany = metadata.insuranceCompany;
  if (metadata.certificateNumber) defaults.certificateNumber = metadata.certificateNumber;
  if (metadata.inspectionCenter) defaults.inspectionCenter = metadata.inspectionCenter;

  try {
    const [doc] = await DriverDocument.findOrCreate({
      where: { driverId, documentType },
      defaults,
    });

    const updates = {};
    if (doc.fileUrl !== fileUrl) updates.fileUrl = fileUrl;
    const nextName = fileNameFromUrl(fileUrl, `${documentType}.jpg`);
    if (doc.fileName !== nextName) updates.fileName = nextName;
    if (metadata.issueDate && doc.issueDate !== metadata.issueDate) updates.issueDate = metadata.issueDate;
    if (metadata.expiryDate && doc.expiryDate !== metadata.expiryDate) updates.expiryDate = metadata.expiryDate;
    if (metadata.policyNumber && doc.policyNumber !== metadata.policyNumber) updates.policyNumber = metadata.policyNumber;
    if (metadata.insuranceCompany && doc.insuranceCompany !== metadata.insuranceCompany) updates.insuranceCompany = metadata.insuranceCompany;
    if (metadata.certificateNumber && doc.certificateNumber !== metadata.certificateNumber) updates.certificateNumber = metadata.certificateNumber;
    if (metadata.inspectionCenter && doc.inspectionCenter !== metadata.inspectionCenter) updates.inspectionCenter = metadata.inspectionCenter;

    if (Object.keys(updates).length > 0) {
      await doc.update(updates);
    }
  } catch (err) {
    // Fallback: raw SQL upsert when Sequelize model has columns the DB doesn't have yet
    console.warn('[drivers] upsertDriverDocumentRecord ORM failed, raw SQL fallback:', err.message);
    const { sequelize: sq } = require('../config/db');
    await sq.query(
      `INSERT INTO "DriverDocuments" ("driverId", "documentType", "fileUrl", "fileName", "createdAt")
       VALUES (:driverId, :documentType, :fileUrl, :fileName, NOW())
       ON CONFLICT ("driverId", "documentType") DO UPDATE SET "fileUrl" = :fileUrl, "fileName" = :fileName`,
      { replacements: { driverId, documentType, fileUrl, fileName: fileNameFromUrl(fileUrl, `${documentType}.jpg`) } }
    );
  }
}

async function persistVerificationDocumentData(driverId, body = {}, fallbackSelfieUrl = null) {
  const urls = extractDocumentUrlsFromBody(body);
  if (fallbackSelfieUrl && !urls.selfie) {
    const cleaned = sanitizeDocumentUrl(fallbackSelfieUrl);
    if (cleaned) urls.selfie = cleaned;
  }

  const soatExpiry = cleanString(body.soatExpiry) || cleanString(body.soat?.expiryDate);
  const soatIssueDate = cleanString(body.soatIssueDate) || cleanString(body.soat?.issueDate);
  const soatPolicyNumber = cleanString(body.soatPolicyNumber) || cleanString(body.soat?.policyNumber);
  const soatInsuranceCompany = cleanString(body.soatInsuranceCompany) || cleanString(body.soat?.insuranceCompany);
  const soatCertificateNumber = cleanString(body.soatCertificateNumber) || cleanString(body.soat?.certificateNumber);
  const soatInspectionCenter = cleanString(body.soatInspectionCenter) || cleanString(body.soat?.inspectionCenter);

  const entries = Object.entries(urls);
  for (const [docType, fileUrl] of entries) {
    const metadata = {};
    if (docType === 'soat') {
      if (soatIssueDate) metadata.issueDate = soatIssueDate;
      if (soatExpiry) metadata.expiryDate = soatExpiry;
      if (soatPolicyNumber) metadata.policyNumber = soatPolicyNumber;
      if (soatInsuranceCompany) metadata.insuranceCompany = soatInsuranceCompany;
      if (soatCertificateNumber) metadata.certificateNumber = soatCertificateNumber;
      if (soatInspectionCenter) metadata.inspectionCenter = soatInspectionCenter;
    }
    await upsertDriverDocumentRecord(driverId, docType, fileUrl, metadata);
  }

  // If metadata is present but SOAT URL is not in payload, still sync metadata to existing SOAT document.
  if (!urls.soat && (soatIssueDate || soatExpiry || soatPolicyNumber || soatInsuranceCompany || soatCertificateNumber || soatInspectionCenter)) {
    const existingSoat = await DriverDocument.findOne({
      where: { driverId, documentType: 'soat' },
    });
    if (existingSoat) {
      const updates = {};
      if (soatIssueDate && existingSoat.issueDate !== soatIssueDate) updates.issueDate = soatIssueDate;
      if (soatExpiry && existingSoat.expiryDate !== soatExpiry) updates.expiryDate = soatExpiry;
      if (soatPolicyNumber && existingSoat.policyNumber !== soatPolicyNumber) updates.policyNumber = soatPolicyNumber;
      if (soatInsuranceCompany && existingSoat.insuranceCompany !== soatInsuranceCompany) updates.insuranceCompany = soatInsuranceCompany;
      if (soatCertificateNumber && existingSoat.certificateNumber !== soatCertificateNumber) updates.certificateNumber = soatCertificateNumber;
      if (soatInspectionCenter && existingSoat.inspectionCenter !== soatInspectionCenter) updates.inspectionCenter = soatInspectionCenter;
      if (Object.keys(updates).length > 0) {
        await existingSoat.update(updates);
      }
    }
  }
}

// S3 storage for driver documents (persistent across container restarts)
const driverDocStorage = multerS3({
  s3: s3Client,
  bucket: BUCKET_NAME,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (req, file, cb) => {
    const driverId = (req.body && req.body.driverId) ? String(req.body.driverId).replace(/[^a-zA-Z0-9_-]/g, '') : 'unknown';
    const docType = (req.body && req.body.documentType) ? String(req.body.documentType).replace(/[^a-z0-9_]/g, '') : 'doc';
    const ext = path.extname(file.originalname) || '.jpg';
    const key = `driver-docs/${driverId}/${docType}${ext}`;
    cb(null, key);
  },
});
const uploadDriverDoc = multer({ storage: driverDocStorage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB

const DRIVER_TTL_SECONDS = 120; // Redis key TTL; driver must heartbeat within this window
const DRIVER_STALE_MS = DRIVER_TTL_SECONDS * 1000; // equivalent stale threshold in ms
const ONLINE_IDS_KEY = 'drivers:online:ids';

async function _setOnline(id, data) {
  const redis = getRedis();
  await redis.setex(`driver:online:${id}`, DRIVER_TTL_SECONDS, JSON.stringify(data));
  await redis.sadd(ONLINE_IDS_KEY, id);
}

async function _delOnline(id) {
  const redis = getRedis();
  await redis.del(`driver:online:${id}`);
  await redis.srem(ONLINE_IDS_KEY, id);
}

async function _getOnlineAll() {
  const redis = getRedis();
  const ids = await redis.smembers(ONLINE_IDS_KEY);
  const results = [];
  const stale = [];
  await Promise.all(ids.map(async (id) => {
    const raw = await redis.get(`driver:online:${id}`);
    if (!raw) { stale.push(id); return; }
    try { results.push({ id, ...JSON.parse(raw) }); } catch (_) {}
  }));
  if (stale.length) await Promise.all(stale.map(id => redis.srem(ONLINE_IDS_KEY, id)));
  return results;
}
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

/**
 * Normalize driver vehicleType so that legacy 'car' drivers are treated as 'taxi'.
 * The driver app defaults to 'car' but user-app rides map to 'taxi' category.
 */
function normalizeDriverCategory(driverVehicleType) {
  const vt = (driverVehicleType || 'car').toLowerCase().trim();
  if (vt === 'car' || vt === 'sedan' || vt === 'suv') return 'taxi';
  return vt;
}

/** Get search radius for a given driver vehicle category. */
function getRadiusForVehicle(driverVehicleCategory) {
  return VEHICLE_RADIUS_KM[driverVehicleCategory] || DEFAULT_RADIUS_KM;
}

// Testing aid: allow going online / receiving requests without verification gate.
// Enable only in dev/staging: set BYPASS_DRIVER_VERIFICATION=true
const BYPASS_DRIVER_VERIFICATION = String(process.env.BYPASS_DRIVER_VERIFICATION || '').toLowerCase() === 'true';

// NOTE: Short, human-readable driver id when client doesn't send one.
// SECURITY FIX: Use crypto.randomBytes instead of Math.random to avoid predictable/colliding IDs.
// Format: d-<8 hex chars> (4 billion possible values, cryptographically random).
function generateShortDriverId() {
  const crypto = require('crypto');
  const hex = crypto.randomBytes(4).toString('hex');
  return `d-${hex}`;
}

/** For control panel: count active online drivers (Redis TTL = source of truth). */
async function getOnlineDriverCount() {
  const drivers = await _getOnlineAll();
  return drivers.length;
}

/** Active drivers by vehicle type (for dashboard). */
async function getOnlineDriversByVehicle() {
  const out = { car: 0, bike: 0, taxi: 0, van: 0, truck: 0, car_hauler: 0, ambulance: 0 };
  const drivers = await _getOnlineAll();
  for (const v of drivers) {
    const vt = (v.vehicleType || 'car').toLowerCase();
    if (out[vt] !== undefined) out[vt]++;
    else out.car++;
  }
  return out;
}

/** List of live drivers (id, vehicleType, lat, lng) for dashboard. */
async function getOnlineDriversList() {
  const drivers = await _getOnlineAll();
  return drivers.map(v => ({ driverId: v.id, vehicleType: v.vehicleType || 'car', lat: v.lat, lng: v.lng }));
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

/** Get verification status for driver. Prefer PostgreSQL (admin source of truth), then Firestore.
 *  Returns 'not_submitted' when no verification row exists (driver never registered/uploaded docs). */
async function getVerificationStatus(driverId) {
  const id = String(driverId);
  try {
    const r = await pool.query('SELECT status, "blockReason" FROM "DriverVerifications" WHERE "driverId" = $1 LIMIT 1', [id]);
    if (r.rows[0]) return { status: r.rows[0].status || 'pending', blockReason: r.rows[0].blockReason || null };
  } catch (pgErr) {
    console.warn('[drivers] getVerificationStatus PG skipped:', pgErr.message);
  }
  try {
    const row = await db.getDriverVerificationByDriverId(id);
    if (row) return { status: row.status || 'pending', blockReason: row.blockReason || null };
  } catch (fsErr) {
    console.warn('[drivers] getVerificationStatus Firestore skipped:', fsErr.message);
  }
  return { status: 'not_submitted', blockReason: null };
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
    let reason = blockReason;
    if (!reason) {
      if (status === 'not_submitted') reason = 'Documents not submitted. Please upload your documents.';
      else if (status === 'pending') reason = 'Profile pending approval.';
      else reason = 'Account temporarily blocked. Please contact customer service.';
    }
    return { canGoOnline: false, reason, code: 'DRIVER_NOT_APPROVED' };
  }
  try {
    const docRes = await pool.query('SELECT "documentType", "expiryDate" FROM "DriverDocuments" WHERE "driverId" = $1', [id]);
    const docs = docRes.rows;
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
        await _delOnline(id);
        let message = blockReason;
        if (!message) {
          if (status === 'not_submitted') message = 'Documents not submitted. Please upload your documents.';
          else if (status === 'pending') message = 'Profile pending re-approval.';
          else message = 'Account temporarily blocked. Please contact customer service.';
        }
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
        await _delOnline(id);
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
  // SECURITY FIX: Never overwrite an existing phone→driverId mapping to prevent collision exploitation.
  if (incomingPhone) {
    try {
      const byPhone = await DriverIdentity.findOne({ where: { phone: incomingPhone } });
      if (byPhone) {
        // Phone already mapped — do NOT overwrite, just verify consistency
        if (byPhone.driverId !== id) {
          console.warn('[drivers][SECURITY] phone->driverId mismatch, refusing overwrite', {
            phone: incomingPhone, existingDriverId: byPhone.driverId, requestedDriverId: id,
          });
        }
      } else {
        // No mapping exists — safe to create, but verify driverId isn't already mapped to another phone
        const byDriverId = await DriverIdentity.findOne({ where: { driverId: id } });
        if (byDriverId) {
          console.warn('[drivers][SECURITY] driverId already mapped to different phone, refusing create', {
            driverId: id, existingPhone: byDriverId.phone, requestedPhone: incomingPhone,
          });
        } else {
          await DriverIdentity.create({ phone: incomingPhone, driverId: id });
        }
      }
    } catch (err) {
      console.warn('[drivers] identity save skipped:', err.message);
    }
  }

  const vt = vehicleType && VEHICLE_TYPES.includes(String(vehicleType).toLowerCase()) ? String(vehicleType).toLowerCase() : 'car';
  await _setOnline(id, { lat, lng, updatedAt: Date.now(), vehicleType: vt });

  res.json({ ok: true, driverId: id });
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
router.get('/nearby', requireRole('passenger'), async (req, res) => {
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

  const allDrivers = await _getOnlineAll(); // Redis TTL already filters stale entries
  let count = 0;
  for (const v of allDrivers) {
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
          city: fsRow.city || null,
          dni: fsRow.dni || null,
          phone: fsRow.phone || null,
          license: fsRow.license || null,
          photoUrl: fsRow.photoUrl || null,
          vehicleBrand: fsRow.vehicleBrand || null,
          vehicleModel: fsRow.vehicleModel || null,
          vehicleColor: fsRow.vehicleColor || null,
          registrationYear: fsRow.registrationYear ?? null,
          vehicleCapacity: fsRow.vehicleCapacity ?? null,
          licenseClass: fsRow.licenseClass || null,
          licenseIssueDate: fsRow.licenseIssueDate || null,
          licenseExpiryDate: fsRow.licenseExpiryDate || null,
          dniIssueDate: fsRow.dniIssueDate || null,
          dniExpiryDate: fsRow.dniExpiryDate || null,
          engineNumber: fsRow.engineNumber || null,
          chassisNumber: fsRow.chassisNumber || null,
        };
      }
    } catch (_) {}

    if (!profile) {
      const profRes = await pool.query(
        `SELECT "driverName", email, "vehicleType", "vehiclePlate",
                "vehicleBrand", "vehicleModel", "vehicleColor", "registrationYear", "vehicleCapacity",
                "licenseClass", "licenseIssueDate", "licenseExpiryDate",
                "dniIssueDate", "dniExpiryDate", "engineNumber", "chassisNumber"
         FROM "DriverVerifications" WHERE "driverId" = $1 LIMIT 1`, [String(driverId)]
      );
      const row = profRes.rows[0] || null;
      if (row) {
        profile = {
          driverName: row.driverName || null,
          email: row.email || null,
          vehicleType: row.vehicleType || null,
          vehiclePlate: row.vehiclePlate || null,
          // NEW: Include vehicle details
          vehicleBrand: row.vehicleBrand || null,
          vehicleModel: row.vehicleModel || null,
          vehicleColor: row.vehicleColor || null,
          registrationYear: row.registrationYear || null,
          vehicleCapacity: row.vehicleCapacity || null,
          // NEW: Include license details
          licenseClass: row.licenseClass || null,
          licenseIssueDate: row.licenseIssueDate || null,
          licenseExpiryDate: row.licenseExpiryDate || null,
          // NEW: Include DNI dates
          dniIssueDate: row.dniIssueDate || null,
          dniExpiryDate: row.dniExpiryDate || null,
          // NEW: Include advanced fields
          engineNumber: row.engineNumber || null,
          chassisNumber: row.chassisNumber || null,
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
    console.info('[drivers] verification-status request', { authDriverId, requestedDriverId, resolvedDriverId: driverId, phone: req.auth?.phone });
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
    console.info('[drivers] verification-status result', { driverId, status, blockReason, email: req.auth?.email });
    // Backfill email into DriverVerification if missing (so future resolveAuthDriverId works)
    const authEmail = req.auth?.email ? String(req.auth.email).trim().toLowerCase() : '';
    if (authEmail && driverId) {
      try { await pool.query('UPDATE "DriverVerifications" SET email = $1 WHERE "driverId" = $2 AND email IS NULL', [authEmail, String(driverId)]); } catch (_) {}
    }
    const go = await canGoOnline(driverId);
    let reuploadRequested = null;
    let hasVerification = false;
    let documentsCount = 0;
    let vehicleType = null;
    let hasAntecedentesPoliciales = null;
    let hasAntecedentesPenales = null;
    try {
      const r = await pool.query(
        'SELECT "reuploadDocumentTypes", "reuploadMessage", "vehicleType", "hasAntecedentesPoliciales", "hasAntecedentesPenales" FROM "DriverVerifications" WHERE "driverId" = $1 LIMIT 1',
        [String(driverId)]
      );
      const row = r.rows[0] || null;
      if (row) hasVerification = true;
      if (row?.vehicleType) vehicleType = String(row.vehicleType).trim().toLowerCase();
      if (row?.hasAntecedentesPoliciales !== undefined) hasAntecedentesPoliciales = row.hasAntecedentesPoliciales;
      if (row?.hasAntecedentesPenales !== undefined) hasAntecedentesPenales = row.hasAntecedentesPenales;
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
          if (hasAntecedentesPoliciales == null && fsRow.hasAntecedentesPoliciales !== undefined) {
            hasAntecedentesPoliciales = fsRow.hasAntecedentesPoliciales;
          }
          if (hasAntecedentesPenales == null && fsRow.hasAntecedentesPenales !== undefined) {
            hasAntecedentesPenales = fsRow.hasAntecedentesPenales;
          }
        }
      } catch (_) {}
    }
    try {
      const docRes = await pool.query('SELECT "documentType" FROM "DriverDocuments" WHERE "driverId" = $1', [String(driverId)]);
      const unique = new Set((docRes.rows || []).map((d) => d.documentType));
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
      hasAntecedentesPoliciales,
      hasAntecedentesPenales,
      driverId: driverId || null,
    });
  } catch (err) {
    console.error('[drivers] verification-status', err.message);
    return res.status(500).json({
      status: 'not_submitted',
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
    const hasAntecedentesPoliciales = body.hasAntecedentesPoliciales != null;
    const hasAntecedentesPenales = body.hasAntecedentesPenales != null;
    const hasCity = body.city != null;
    const hasDni = body.dni != null;
    const hasPhone = body.phone != null;
    const hasLicense = body.license != null || body.licenseNumber != null;
    const hasPhotoUrl = body.photoUrl != null || body.selfieUrl != null;
    // NEW: Vehicle detail fields
    const hasVehicleBrand = body.vehicleBrand != null;
    const hasVehicleModel = body.vehicleModel != null;
    const hasVehicleColor = body.vehicleColor != null;
    const hasRegistrationYear = body.registrationYear != null;
    const hasVehicleCapacity = body.vehicleCapacity != null;
    // NEW: License detail fields
    const hasLicenseClass = body.licenseClass != null;
    const hasLicenseIssueDate = body.licenseIssueDate != null;
    const hasLicenseExpiryDate = body.licenseExpiryDate != null;
    // NEW: DNI date fields
    const hasDniIssueDate = body.dniIssueDate != null;
    const hasDniExpiryDate = body.dniExpiryDate != null;
    // NEW: Advanced fields (optional)
    const hasEngineNumber = body.engineNumber != null;
    const hasChassisNumber = body.chassisNumber != null;

    const vehiclePlate = hasVehiclePlate ? normalizePlate(body.vehiclePlate) : '';
    const driverName = hasDriverName ? String(body.driverName).trim() : null;
    const vehicleTypeInput = hasVehicleType ? String(body.vehicleType).trim() : null;
    const vehicleType = vehicleTypeInput || 'car';
    const email = hasEmail ? String(body.email).trim() : null;
    const antecedentesPoliciales = hasAntecedentesPoliciales ? Boolean(body.hasAntecedentesPoliciales) : null;
    const antecedentesPenales = hasAntecedentesPenales ? Boolean(body.hasAntecedentesPenales) : null;
    const city = hasCity ? String(body.city).trim() : null;
    const dni = hasDni ? String(body.dni).trim() : null;
    const phone = hasPhone ? String(body.phone).trim() : null;
    const licenseInput = body.license != null ? body.license : body.licenseNumber;
    const license = hasLicense ? String(licenseInput).trim() : null;
    const photoInput = body.photoUrl != null ? body.photoUrl : body.selfieUrl;
    const photoUrl = hasPhotoUrl ? String(photoInput).trim() : null;
    // NEW: Parse vehicle detail fields
    const vehicleBrand = hasVehicleBrand ? String(body.vehicleBrand).trim() : null;
    const vehicleModel = hasVehicleModel ? String(body.vehicleModel).trim() : null;
    const vehicleColor = hasVehicleColor ? String(body.vehicleColor).trim() : null;
    const registrationYear = hasRegistrationYear ? parseInt(body.registrationYear, 10) : null;
    const vehicleCapacity = hasVehicleCapacity ? parseInt(body.vehicleCapacity, 10) : null;
    // NEW: Parse license detail fields
    const licenseClass = hasLicenseClass ? String(body.licenseClass).trim() : null;
    const licenseIssueDate = hasLicenseIssueDate ? String(body.licenseIssueDate).trim() : null;
    const licenseExpiryDate = hasLicenseExpiryDate ? String(body.licenseExpiryDate).trim() : null;
    // NEW: Parse DNI date fields
    const dniIssueDate = hasDniIssueDate ? String(body.dniIssueDate).trim() : null;
    const dniExpiryDate = hasDniExpiryDate ? String(body.dniExpiryDate).trim() : null;
    // NEW: Parse advanced fields
    const engineNumber = hasEngineNumber ? String(body.engineNumber).trim() : null;
    const chassisNumber = hasChassisNumber ? String(body.chassisNumber).trim() : null;

    let finalStatus = 'pending';
    let usedFirestore = false;

    let firestoreChanged = false;
    let plateChanged = false;
    let nameChanged = false;
    let typeChanged = false;

    const authUid = req.auth?.userId || req.auth?.uid || req.auth?.sub || null;
    try {
      const { row, created } = await db.findOrCreateDriverVerification(driverId, {
        status: 'pending',
        vehicleType,
        vehiclePlate: vehiclePlate || null,
        driverName,
        email,
        city,
        dni,
        phone,
        license,
        photoUrl,
        authUid: authUid ? String(authUid) : null,
      });
      if (created) {
        console.log('[drivers] NEW DRIVER CREATED (Firestore):', { driverId, email, driverName, authUid });
      }
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

      // NEW: Check for duplicate DNI
      if (hasDni && dni) {
        // Check PostgreSQL (Source of Truth)
        const dniRes = await pool.query('SELECT "driverId" FROM "DriverVerifications" WHERE dni = $1 LIMIT 1', [dni]);
        const existingDni = dniRes.rows[0] || null;
        if (existingDni && existingDni.driverId !== driverId) {
          return res.status(400).json({
            ok: false,
            message: 'DNI already registered by another driver.',
          });
        }
      }

      // NEW: Check for duplicate License
      if (hasLicense && license) {
        const licRes = await pool.query('SELECT "driverId" FROM "DriverVerifications" WHERE license = $1 LIMIT 1', [license]);
        const existingLicense = licRes.rows[0] || null;
        if (existingLicense && existingLicense.driverId !== driverId) {
          return res.status(400).json({
            ok: false,
            message: 'License number already registered by another driver.',
          });
        }
      }

      // NEW: Check for duplicate Email
      if (hasEmail && email) {
        const emailRes = await pool.query('SELECT "driverId" FROM "DriverVerifications" WHERE email = $1 LIMIT 1', [email]);
        const existingEmail = emailRes.rows[0] || null;
        if (existingEmail && existingEmail.driverId !== driverId) {
          return res.status(400).json({
            ok: false,
            message: 'Email already registered by another driver.',
          });
        }
      }

      const updates = {};
      if (plateChanged) updates.vehiclePlate = nextPlate;
      if (nameChanged) updates.driverName = nextName;
      if (typeChanged) updates.vehicleType = nextType;
      if (emailChanged) updates.email = nextEmail;
      if (hasAntecedentesPoliciales) updates.hasAntecedentesPoliciales = antecedentesPoliciales;
      if (hasAntecedentesPenales) updates.hasAntecedentesPenales = antecedentesPenales;
      if (hasCity) updates.city = city;
      if (hasDni) updates.dni = dni;
      if (hasPhone) updates.phone = phone;
      if (hasLicense) updates.license = license;
      if (hasPhotoUrl) updates.photoUrl = photoUrl;
      // NEW: Add vehicle detail fields to updates
      if (hasVehicleBrand) updates.vehicleBrand = vehicleBrand;
      if (hasVehicleModel) updates.vehicleModel = vehicleModel;
      if (hasVehicleColor) updates.vehicleColor = vehicleColor;
      if (hasRegistrationYear) updates.registrationYear = registrationYear;
      if (hasVehicleCapacity) updates.vehicleCapacity = vehicleCapacity;
      // NEW: Add license detail fields to updates
      if (hasLicenseClass) updates.licenseClass = licenseClass;
      if (hasLicenseIssueDate) updates.licenseIssueDate = licenseIssueDate;
      if (hasLicenseExpiryDate) updates.licenseExpiryDate = licenseExpiryDate;
      // NEW: Add DNI date fields to updates
      if (hasDniIssueDate) updates.dniIssueDate = dniIssueDate;
      if (hasDniExpiryDate) updates.dniExpiryDate = dniExpiryDate;
      // NEW: Add advanced fields to updates
      if (hasEngineNumber) updates.engineNumber = engineNumber;
      if (hasChassisNumber) updates.chassisNumber = chassisNumber;
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
      // Raw SQL upsert — resilient to missing columns
      const existingPg = await pool.query('SELECT "driverId", status, "vehiclePlate", "driverName", "vehicleType", email FROM "DriverVerifications" WHERE "driverId" = $1 LIMIT 1', [driverId]);
      let pgRow;
      let pgCreated = false;
      if (existingPg.rows.length === 0) {
        await pool.query(
          `INSERT INTO "DriverVerifications" ("driverId", "authUid", status, "vehicleType", "vehiclePlate", "driverName", email, city, dni, phone, license, "photoUrl", "blockReason", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NULL, NOW(), NOW())`,
          [driverId, authUid ? String(authUid) : null, finalStatus, vehicleType, vehiclePlate || null, driverName, email, city, dni, phone, license, photoUrl]
        );
        pgRow = { driverId, status: finalStatus, vehiclePlate: vehiclePlate || null, driverName, vehicleType, email };
        pgCreated = true;
        console.log('[drivers] NEW DRIVER CREATED (PostgreSQL):', { driverId, email, driverName, authUid });
      } else {
        pgRow = existingPg.rows[0];
      }
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
      if (pgEmailChanged) pgUpdates.email = pgNextEmail;
      if (hasAntecedentesPoliciales) pgUpdates.hasAntecedentesPoliciales = antecedentesPoliciales;
      if (hasAntecedentesPenales) pgUpdates.hasAntecedentesPenales = antecedentesPenales;
      if (hasCity) pgUpdates.city = city;
      if (hasDni) pgUpdates.dni = dni;
      if (hasPhone) pgUpdates.phone = phone;
      if (hasLicense) pgUpdates.license = license;
      if (hasPhotoUrl) pgUpdates.photoUrl = photoUrl;
      // NEW: Add vehicle detail fields to PostgreSQL updates
      if (hasVehicleBrand) pgUpdates.vehicleBrand = vehicleBrand;
      if (hasVehicleModel) pgUpdates.vehicleModel = vehicleModel;
      if (hasVehicleColor) pgUpdates.vehicleColor = vehicleColor;
      if (hasRegistrationYear) pgUpdates.registrationYear = registrationYear;
      if (hasVehicleCapacity) pgUpdates.vehicleCapacity = vehicleCapacity;
      // NEW: Add license detail fields to PostgreSQL updates
      if (hasLicenseClass) pgUpdates.licenseClass = licenseClass;
      if (hasLicenseIssueDate) pgUpdates.licenseIssueDate = licenseIssueDate;
      if (hasLicenseExpiryDate) pgUpdates.licenseExpiryDate = licenseExpiryDate;
      // NEW: Add DNI date fields to PostgreSQL updates
      if (hasDniIssueDate) pgUpdates.dniIssueDate = dniIssueDate;
      if (hasDniExpiryDate) pgUpdates.dniExpiryDate = dniExpiryDate;
      // NEW: Add advanced fields to PostgreSQL updates
      if (hasEngineNumber) pgUpdates.engineNumber = engineNumber;
      if (hasChassisNumber) pgUpdates.chassisNumber = chassisNumber;
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
        pgUpdates.email = email;
        pgUpdates.city = city;
        pgUpdates.dni = dni;
        pgUpdates.phone = phone;
        pgUpdates.license = license;
        pgUpdates.photoUrl = photoUrl;
      }
      if (Object.keys(pgUpdates).length) {
        const setClauses = Object.keys(pgUpdates).map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        const vals = [...Object.values(pgUpdates), driverId];
        await pool.query(`UPDATE "DriverVerifications" SET ${setClauses}, "updatedAt" = NOW() WHERE "driverId" = $${vals.length}`, vals);
      }
      if (!usedFirestore) {
        finalStatus = pgUpdates.status || pgRow.status || finalStatus || 'pending';
      }
    } catch (pgErr) {
      console.error('[drivers] verification-register PG failed:', pgErr.message);
      if (!usedFirestore) {
        return res.status(500).json({ ok: false, message: 'Database error. Run: npm run migrate' });
      }
    }
    // Backfill DriverIdentity so phone→driverId mapping works for future requests
    const authPhone = req.auth?.phone ? String(req.auth.phone).trim() : '';
    if (authPhone && driverId) {
      try { await DriverIdentity.findOrCreate({ where: { phone: authPhone }, defaults: { phone: authPhone, driverId } }); } catch (_) {}
    }

    // Keep document URLs + SOAT metadata consistent even when app submits URL payloads.
    try {
      await persistVerificationDocumentData(driverId, body, photoUrl);
    } catch (docPersistErr) {
      console.warn('[drivers] verification-register document sync skipped:', docPersistErr.message);
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
    const captureTimestamp = (req.body && req.body.captureTimestamp) ? String(req.body.captureTimestamp).trim() : null;
    // NEW: Document metadata fields
    const issueDate = (req.body && req.body.issueDate) ? String(req.body.issueDate).trim() : null;
    const expiryDate = (req.body && req.body.expiryDate) ? String(req.body.expiryDate).trim() : null;
    const policyNumber = (req.body && req.body.policyNumber) ? String(req.body.policyNumber).trim() : null;
    const insuranceCompany = (req.body && req.body.insuranceCompany) ? String(req.body.insuranceCompany).trim() : null;
    const certificateNumber = (req.body && req.body.certificateNumber) ? String(req.body.certificateNumber).trim() : null;
    const inspectionCenter = (req.body && req.body.inspectionCenter) ? String(req.body.inspectionCenter).trim() : null;
    
    if (!driverId) return res.status(400).json({ ok: false, message: 'driverId required' });
    if (authDriverId && requestedDriverId && requestedDriverId !== authDriverId) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }
    if (!documentType || !DRIVER_DOC_TYPES.includes(documentType)) {
      return res.status(400).json({ ok: false, message: 'documentType must be one of: ' + DRIVER_DOC_TYPES.join(', ') });
    }
    
    // captureTimestamp is optional. Keep relaxed checks for observability only; do not block uploads.
    if (captureTimestamp) {
      const captureMs = Date.parse(captureTimestamp);
      const nowMs = Date.now();
      console.log('Server Time:', new Date());
      console.log('Capture Time:', new Date(captureTimestamp));
      console.log('Difference (minutes):', (nowMs - captureMs) / 60000);
      if (!Number.isNaN(captureMs)) {
        const diff = nowMs - captureMs; // positive if in past
        if (diff > MAX_PAST_WINDOW) {
          console.warn('[drivers] documents upload timestamp out-of-window (past)', {
            driverId,
            documentType,
            captureTimestamp,
            diffMinutes: Math.round(diff / 60000),
          });
        }
        if (diff < -FUTURE_TOLERANCE) {
          console.warn('[drivers] documents upload timestamp out-of-window (future)', {
            driverId,
            documentType,
            captureTimestamp,
            diffMinutes: Math.round(diff / 60000),
          });
        }
      }
    }
    // Guard: when verification is pending and no specific reupload is requested, block uploads.
    try {
      const dvCheck = await pool.query('SELECT status, "reuploadDocumentTypes" FROM "DriverVerifications" WHERE "driverId" = $1 LIMIT 1', [driverId]);
      const row = dvCheck.rows[0] || null;
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
    // S3 URL is in req.file.location (multer-s3 provides this)
    const fileUrl = req.file.location || req.file.key;
    // NEW: Build document data with metadata fields
    const docData = {
      driverId,
      documentType,
      fileUrl,
      fileName: req.file.originalname || req.file.filename,
    };
    if (issueDate) docData.issueDate = issueDate;
    if (expiryDate) docData.expiryDate = expiryDate;
    if (policyNumber) docData.policyNumber = policyNumber;
    if (insuranceCompany) docData.insuranceCompany = insuranceCompany;
    if (certificateNumber) docData.certificateNumber = certificateNumber;
    if (inspectionCenter) docData.inspectionCenter = inspectionCenter;
    
    let doc;
    try {
      [doc] = await DriverDocument.findOrCreate({
        where: { driverId, documentType },
        defaults: docData,
      });
      // Update with all metadata fields if document already existed
      if (doc) {
        const updates = {};
        if (doc.fileUrl !== fileUrl) updates.fileUrl = fileUrl;
        if (doc.fileName !== (req.file.originalname || req.file.filename)) updates.fileName = req.file.originalname || req.file.filename;
        if (issueDate && doc.issueDate !== issueDate) updates.issueDate = issueDate;
        if (expiryDate && doc.expiryDate !== expiryDate) updates.expiryDate = expiryDate;
        if (policyNumber && doc.policyNumber !== policyNumber) updates.policyNumber = policyNumber;
        if (insuranceCompany && doc.insuranceCompany !== insuranceCompany) updates.insuranceCompany = insuranceCompany;
        if (certificateNumber && doc.certificateNumber !== certificateNumber) updates.certificateNumber = certificateNumber;
        if (inspectionCenter && doc.inspectionCenter !== inspectionCenter) updates.inspectionCenter = inspectionCenter;
        if (Object.keys(updates).length > 0) {
          await doc.update(updates);
        }
      }
    } catch (docErr) {
      // Fallback: if Sequelize fails (e.g. missing 'status' column), use raw SQL with basic columns
      console.warn('[drivers] documents findOrCreate failed, using raw SQL fallback:', docErr.message);
      const { sequelize } = require('../config/db');
      await sequelize.query(
        `INSERT INTO "DriverDocuments" ("driverId", "documentType", "fileUrl", "fileName", "createdAt")
         VALUES (:driverId, :documentType, :fileUrl, :fileName, NOW())
         ON CONFLICT ("driverId", "documentType") DO UPDATE SET "fileUrl" = :fileUrl, "fileName" = :fileName`,
        { replacements: { driverId, documentType, fileUrl, fileName: req.file.originalname || req.file.filename }, type: sequelize.constructor.QueryTypes.UPSERT }
      );
    }
    if (documentType === 'selfie') {
      try {
        await pool.query('UPDATE "DriverVerifications" SET "photoUrl" = $1, "updatedAt" = NOW() WHERE "driverId" = $2', [fileUrl, driverId]);
      } catch (pgPhotoErr) {
        console.warn('[drivers] documents selfie PG photo sync skipped:', pgPhotoErr.message);
      }
      try {
        await db.updateDriverVerification(driverId, { photoUrl: fileUrl });
      } catch (fsPhotoErr) {
        console.warn('[drivers] documents selfie Firestore photo sync skipped:', fsPhotoErr.message);
      }
    }
    // Ensure a DriverVerification row exists so admin panel sees this driver as pending
    try {
      const dvExist = await pool.query('SELECT 1 FROM "DriverVerifications" WHERE "driverId" = $1 LIMIT 1', [driverId]);
      if (dvExist.rows.length === 0) {
        await pool.query('INSERT INTO "DriverVerifications" ("driverId", status, "createdAt", "updatedAt") VALUES ($1, $2, NOW(), NOW())', [driverId, 'pending']);
      }
    } catch (dvErr) {
      console.warn('[drivers] documents: DriverVerification ensure skipped:', dvErr.message);
    }
    // If this upload was part of a reupload request, remove it from the pending list.
    // When all requested docs are uploaded, clear reuploadDocumentTypes entirely.
    try {
      const dvRes = await pool.query('SELECT "reuploadDocumentTypes" FROM "DriverVerifications" WHERE "driverId" = $1 LIMIT 1', [driverId]);
      const dvRow = dvRes.rows[0] || null;
      if (dvRow) {
        const pending = Array.isArray(dvRow.reuploadDocumentTypes) ? dvRow.reuploadDocumentTypes : [];
        if (pending.includes(documentType)) {
          const remaining = pending.filter((t) => t !== documentType);
          if (remaining.length > 0) {
            await pool.query('UPDATE "DriverVerifications" SET "reuploadDocumentTypes" = $1, "updatedAt" = NOW() WHERE "driverId" = $2', [JSON.stringify(remaining), driverId]);
          } else {
            await pool.query('UPDATE "DriverVerifications" SET "reuploadDocumentTypes" = NULL, "reuploadMessage" = NULL, "updatedAt" = NOW() WHERE "driverId" = $1', [driverId]);
          }
          console.log('[drivers] documents reupload progress:', { driverId, documentType, remaining });
        }
      }
    } catch (reuploadErr) {
      console.warn('[drivers] documents: reuploadDocumentTypes update skipped:', reuploadErr.message);
    }
    return res.json({ ok: true, documentType, fileUrl, fileName: req.file.originalname || req.file.filename, issueDate, expiryDate, policyNumber, insuranceCompany });
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
    let list;
    try {
      const docListRes = await pool.query(
        `SELECT id, "documentType", "fileUrl", "fileName", "issueDate", "expiryDate", "policyNumber", "insuranceCompany", "createdAt"
         FROM "DriverDocuments" WHERE "driverId" = $1 ORDER BY "createdAt" ASC`, [driverId]
      );
      list = docListRes.rows;
    } catch (colErr) {
      console.warn('[drivers] documents full query failed, using basic columns:', colErr.message);
      const fallbackRes = await pool.query(
        'SELECT id, "documentType", "fileUrl", "fileName", "createdAt" FROM "DriverDocuments" WHERE "driverId" = $1 ORDER BY "createdAt" ASC', [driverId]
      );
      list = fallbackRes.rows;
    }
    return res.json({
      documents: list.map((d) => ({
        id: d.id,
        documentType: d.documentType,
        fileUrl: d.fileUrl,
        fileName: d.fileName,
        issueDate: d.issueDate || null,
        expiryDate: d.expiryDate || null,
        policyNumber: d.policyNumber || null,
        insuranceCompany: d.insuranceCompany || null,
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

    // Get this driver's live location and vehicle type from Redis
    const driverRaw = driverId ? await getRedis().get(`driver:online:${driverId}`) : null;
    const driverInfo = driverRaw ? (() => { try { return JSON.parse(driverRaw); } catch (_) { return null; } })() : null;
    const isOnline = !!driverInfo; // Redis TTL already handles staleness

    if (!isOnline) {
      // Driver not online or stale – no requests
      return res.json({ requests: [] });
    }

    const driverVehicleRaw = (driverInfo.vehicleType || 'car').toLowerCase();
    const driverVehicle = normalizeDriverCategory(driverVehicleRaw);
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

/** POST /api/drivers/profile-photo – Upload driver profile photo (timestamp optional, no validation) */
router.post('/profile-photo', requireRole('driver'), uploadDriverDoc.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, message: 'No file uploaded' });
    const authDriverId = await resolveAuthDriverId(req);
    const requestedDriverId = (req.body && req.body.driverId) ? String(req.body.driverId).trim() : '';
    const driverId = authDriverId || requestedDriverId;
    const latitude = (req.body && req.body.latitude) ? Number(req.body.latitude) : null;
    const longitude = (req.body && req.body.longitude) ? Number(req.body.longitude) : null;
    const captureTimestamp = (req.body && req.body.captureTimestamp) ? String(req.body.captureTimestamp).trim() : null;
    if (!driverId) return res.status(400).json({ ok: false, message: 'driverId required' });
    if (authDriverId && requestedDriverId && requestedDriverId !== authDriverId) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }
    // captureTimestamp is optional. Keep relaxed checks for observability only; do not block uploads.
    if (captureTimestamp) {
      const captureMs = Date.parse(captureTimestamp);
      const nowMs = Date.now();
      console.log('Server Time:', new Date());
      console.log('Capture Time:', new Date(captureTimestamp));
      console.log('Difference (minutes):', (nowMs - captureMs) / 60000);
      if (!Number.isNaN(captureMs)) {
        const diff = nowMs - captureMs; // positive if in past
        if (diff > MAX_PAST_WINDOW) {
          console.warn('[drivers] profile-photo timestamp out-of-window (past)', {
            driverId,
            captureTimestamp,
            diffMinutes: Math.round(diff / 60000),
          });
        }
        if (diff < -FUTURE_TOLERANCE) {
          console.warn('[drivers] profile-photo timestamp out-of-window (future)', {
            driverId,
            captureTimestamp,
            diffMinutes: Math.round(diff / 60000),
          });
        }
      }
    }
    
    // Store photo URL in driver verification
    const photoUrl = `/uploads/driver-docs/${driverId}/${req.file.filename}`;
    
    try {
      await db.updateDriverVerification(driverId, { photoUrl });
    } catch (fsErr) {
      console.warn('[drivers] profile-photo Firestore update failed:', fsErr.message);
    }
    
    try {
      const photoExist = await pool.query('SELECT 1 FROM "DriverVerifications" WHERE "driverId" = $1 LIMIT 1', [driverId]);
      if (photoExist.rows.length === 0) {
        await pool.query('INSERT INTO "DriverVerifications" ("driverId", "photoUrl", status, "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW())', [driverId, photoUrl, 'pending']);
      } else {
        await pool.query('UPDATE "DriverVerifications" SET "photoUrl" = $1, "updatedAt" = NOW() WHERE "driverId" = $2', [photoUrl, driverId]);
      }
    } catch (pgErr) {
      console.error('[drivers] profile-photo PG update failed:', pgErr.message);
    }
    try {
      await upsertDriverDocumentRecord(driverId, 'selfie', photoUrl, {});
    } catch (selfieErr) {
      console.warn('[drivers] profile-photo selfie document sync skipped:', selfieErr.message);
    }
    
    // Log activity with GPS
    console.log('[drivers] Profile photo uploaded:', {
      driverId,
      photoUrl,
      captureTimestamp,
      latitude,
      longitude,
    });
    
    return res.json({ ok: true, photoUrl });
  } catch (err) {
    console.error('[drivers] profile-photo error:', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

/** POST /api/drivers/activity-log – Log driver photo capture activity with GPS and timestamp */
router.post('/activity-log', requireRole('driver'), async (req, res) => {
  try {
    const authDriverId = await resolveAuthDriverId(req);
    const body = req.body || {};
    const driverId = authDriverId || body.driverId;
    if (!driverId) return res.status(400).json({ ok: false, message: 'driverId required' });

    const action = body.action || 'unknown';
    const documentType = body.documentType || '';
    const timestamp = body.timestamp || new Date().toISOString();
    const latitude = body.latitude || null;
    const longitude = body.longitude || null;
    const accuracy = body.accuracy || null;

    // Store activity log in database (you can create a new model or use existing audit system)
    console.log('[drivers] Activity log:', {
      driverId,
      action,
      documentType,
      timestamp,
      latitude,
      longitude,
      accuracy,
    });

    // TODO: Store in database table for admin panel viewing
    // For now, just log to console and return success

    return res.json({ ok: true });
  } catch (err) {
    console.error('[drivers] activity-log error:', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

module.exports = router;
module.exports.getOnlineDriverCount = getOnlineDriverCount;
module.exports.getOnlineDriversByVehicle = getOnlineDriversByVehicle;
module.exports.getOnlineDriversList = getOnlineDriversList;

module.exports.DRIVER_STALE_MS = DRIVER_STALE_MS;
module.exports.rideVehicleToDriverCategory = rideVehicleToDriverCategory;
module.exports.normalizeDriverCategory = normalizeDriverCategory;
module.exports.getRadiusForVehicle = getRadiusForVehicle;
module.exports.haversineKm = haversineKm;
