/**
 * Agency Portal API – Travel agents signup, login, tours CRUD.
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');
const config = require('../config');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { pool } = require('../config/db');
const { sendPasswordResetOtpEmail } = require('../services/password-reset-email');
const { TravelAgency, Tour, TourPaxOption, TourSlot, AgencyWallet, AgencyPayoutRequest, TourBooking, AgencyDocument } = require('../models');
const { computeTourFlags } = require('../services/tour-flags');

const router = express.Router();

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
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.type !== 'agency') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.agencyId = payload.agencyId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** POST /api/agency/signup – Create new travel agency account */
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, phone, country, currency } = req.body || {};
    const trimmedEmail = (email || '').trim().toLowerCase();
    const trimmedName = (name || '').trim();
    const pwd = (password || '').trim();

    if (!trimmedEmail || !trimmedName || !pwd || !country) {
      return res.status(400).json({ error: 'Name, email, password, and country are required' });
    }
    if (pwd.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await TravelAgency.findOne({ where: { email: trimmedEmail } });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const agency = await TravelAgency.create({
      name: trimmedName,
      email: trimmedEmail,
      passwordHash: hashPassword(pwd),
      phone: (phone || '').trim() || null,
      country: (country || '').trim(),
      currency: (currency || 'USD').trim(),
      status: 'pending',
    });

    const token = jwt.sign(
      { agencyId: agency.id, email: agency.email, type: 'agency' },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      token,
      agency: {
        id: String(agency.id),
        name: agency.name,
        email: agency.email,
        country: agency.country,
        currency: agency.currency,
        status: agency.status,
      },
    });
  } catch (err) {
    console.error('[agency] signup', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/agency/login – Agency login */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const trimmedEmail = (email || '').trim().toLowerCase();
    const pwd = (password || '').trim();

    if (!trimmedEmail || !pwd) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const agency = await TravelAgency.findOne({ where: { email: trimmedEmail } });
    if (!agency || !agency.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!verifyPassword(pwd, agency.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (agency.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended. Contact support.' });
    }
    if (agency.status === 'rejected') {
      return res.status(403).json({ error: 'Application declined. Contact support.' });
    }

    const token = jwt.sign(
      { agencyId: agency.id, email: agency.email, type: 'agency' },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      agency: {
        id: String(agency.id),
        name: agency.name,
        email: agency.email,
        country: agency.country,
        currency: agency.currency,
        status: agency.status,
      },
    });
  } catch (err) {
    console.error('[agency] login', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/agency/forgot-password – Send OTP to agency email */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    const trimmedEmail = (email || '').trim().toLowerCase();
    if (!trimmedEmail) {
      return res.status(400).json({ error: 'Email required' });
    }
    const agency = await TravelAgency.findOne({ where: { email: trimmedEmail } });
    if (!agency) {
      return res.status(200).json({ message: 'If an account exists with this email, you will receive an OTP.' });
    }
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query(
      'INSERT INTO password_reset_otp (email, otp, scope, expires_at) VALUES ($1, $2, $3, $4)',
      [trimmedEmail, otp, 'agency', expiresAt]
    );
    const sent = await sendPasswordResetOtpEmail(trimmedEmail, otp, 'agency');
    if (!sent) {
      return res.status(500).json({ error: 'Failed to send email. Check SMTP configuration.' });
    }
    return res.status(200).json({ message: 'OTP sent to your email.' });
  } catch (err) {
    console.error('[agency] forgot-password', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/agency/reset-password – Verify OTP and set new password */
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
    const result = await pool.query(
      `SELECT id, otp FROM password_reset_otp
       WHERE email = $1 AND scope = 'agency' AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
      [trimmedEmail]
    );
    const row = result.rows[0];
    if (!row || row.otp !== otpStr) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }
    const agency = await TravelAgency.findOne({ where: { email: trimmedEmail } });
    if (!agency) {
      return res.status(404).json({ error: 'Account not found' });
    }
    agency.passwordHash = hashPassword(pwd);
    await agency.save();
    await pool.query('DELETE FROM password_reset_otp WHERE id = $1', [row.id]);
    return res.status(200).json({ message: 'Password reset successfully. You can now login.' });
  } catch (err) {
    console.error('[agency] reset-password', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/agency/me – Current agency profile */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const agency = await TravelAgency.findByPk(req.agencyId, {
      attributes: { exclude: ['passwordHash'] },
    });
    if (!agency) return res.status(404).json({ error: 'Agency not found' });
    return res.json({
      id: String(agency.id),
      name: agency.name,
      email: agency.email,
      phone: agency.phone,
      country: agency.country,
      currency: agency.currency,
      status: agency.status,
    });
  } catch (err) {
    console.error('[agency] me', err.message);
    return res.status(500).json({ error: err.message });
  }
});

const AGENCY_DOC_TYPES = ['business_license', 'tax_id', 'id_proof', 'company_registration'];
const AGENCY_DOC_LABELS = { business_license: 'Business license', tax_id: 'Tax ID document', id_proof: 'ID proof', company_registration: 'Company registration' };

/** GET /api/agency/verification-status – Status, note, uploaded documents (for Verification page) */
router.get('/verification-status', authMiddleware, async (req, res) => {
  try {
    const agency = await TravelAgency.findByPk(req.agencyId, {
      include: [{ model: AgencyDocument, as: 'AgencyDocuments' }],
    });
    if (!agency) return res.status(404).json({ error: 'Agency not found' });
    const documents = (agency.AgencyDocuments || []).map((d) => ({
      documentType: d.documentType,
      fileUrl: d.fileUrl,
      fileName: d.fileName,
      createdAt: d.createdAt,
    }));
    return res.json({
      status: agency.status,
      verificationNote: agency.verificationNote || null,
      documents,
      requiredDocTypes: AGENCY_DOC_TYPES,
      requiredDocLabels: AGENCY_DOC_LABELS,
    });
  } catch (err) {
    console.error('[agency] verification-status', err.message);
    return res.status(500).json({ error: err.message });
  }
});

const uploadsRoot = path.join(__dirname, '..', '..', 'uploads', 'agency-docs');
const agencyDocStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(uploadsRoot, String(req.agencyId));
    try {
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (e) {
      cb(e, null);
    }
  },
  filename: (req, file, cb) => {
    const docType = (req.body && req.body.documentType) ? String(req.body.documentType).replace(/[^a-z_]/g, '') : 'doc';
    const ext = path.extname(file.originalname) || '.bin';
    cb(null, `${docType}${ext}`);
  },
});
const uploadAgencyDoc = multer({ storage: agencyDocStorage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB

/** POST /api/agency/documents – Upload verification document (multipart: file + documentType) */
router.post('/documents', authMiddleware, uploadAgencyDoc.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const documentType = (req.body && req.body.documentType) ? String(req.body.documentType).trim() : null;
    if (!documentType || !AGENCY_DOC_TYPES.includes(documentType)) {
      return res.status(400).json({ error: 'Invalid documentType. Use one of: ' + AGENCY_DOC_TYPES.join(', ') });
    }
    const relativePath = `agency-docs/${req.agencyId}/${req.file.filename}`;
    const fileUrl = `/uploads/${relativePath}`;
    const [doc] = await AgencyDocument.findOrCreate({
      where: { travelAgencyId: req.agencyId, documentType },
      defaults: { travelAgencyId: req.agencyId, documentType, fileUrl, fileName: req.file.originalname },
    });
    if (!doc) return res.status(500).json({ error: 'Failed to save document' });
    if (doc.fileUrl !== fileUrl) await doc.update({ fileUrl, fileName: req.file.originalname });
    const agency = await TravelAgency.findByPk(req.agencyId);
    if (agency && agency.status === 'needs_documents') {
      await agency.update({ status: 'pending', verificationNote: null });
    }
    return res.json({ ok: true, documentType, fileUrl, fileName: req.file.originalname });
  } catch (err) {
    console.error('[agency] documents upload', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/agency/tours – List my tours (with same flags as user sees) */
router.get('/tours', authMiddleware, async (req, res) => {
  try {
    const tours = await Tour.findAll({
      where: { travelAgencyId: req.agencyId },
      order: [['createdAt', 'DESC']],
      include: [
        { model: TourPaxOption, as: 'TourPaxOptions', attributes: ['id', 'label', 'pricePerPax', 'currency'] },
      ],
    });
    const { flagsMap } = await computeTourFlags(tours);
    const list = tours.map((t) => {
      const prices = (t.TourPaxOptions || []).map((p) => p.pricePerPax);
      const startingPrice = prices.length ? Math.min(...prices) : null;
      const imgs = Array.isArray(t.images) ? t.images : [];
      return {
        id: String(t.id),
        title: t.title,
        country: t.country,
        city: t.city,
        category: t.category,
        status: t.status,
        startingPrice,
        thumbnailUrl: imgs[0] || null,
        flags: flagsMap[t.id] || [],
        freeCancellation: !!t.freeCancellation,
        createdAt: t.createdAt,
      };
    });
    return res.json({ tours: list });
  } catch (err) {
    console.error('[agency] tours list', err.message);
    return res.status(500).json({ tours: [] });
  }
});

/** POST /api/agency/tours – Create new tour */
router.post('/tours', authMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const {
      title,
      country,
      city,
      location,
      category,
      description,
      includedServices,
      images,
      videoUrl,
      durationMins,
      meetingPoint,
      cancellationPolicy,
      freeCancellation,
      freeCancellationHours,
      languages,
      paxOptions,
      slots,
    } = body;

    if (!title || !country || !city || !category) {
      return res.status(400).json({ error: 'Title, country, city, and category are required' });
    }

    const validCategories = ['full_day', 'night_tour', 'adventure', 'cultural', 'family'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const titleNorm = (title || '').trim().toLowerCase();
    if (titleNorm) {
      const blockedTours = await Tour.findAll({
        where: { travelAgencyId: req.agencyId, status: 'blocked' },
        attributes: ['title'],
      });
      const sameBlocked = blockedTours.some((t) => (t.title || '').trim().toLowerCase() === titleNorm);
      if (sameBlocked) {
        return res.status(400).json({
          error: 'This tour title is blocked. You cannot create a tour with the same name. Contact admin for reinstatement.',
        });
      }
    }

    const tour = await Tour.create({
      travelAgencyId: req.agencyId,
      title: (title || '').trim(),
      country: (country || '').trim(),
      city: (city || '').trim(),
      location: (location || '').trim() || null,
      category,
      description: (description || '').trim() || null,
      includedServices: (includedServices || '').trim() || null,
      images: Array.isArray(images) ? images.slice(0, 10) : [],
      videoUrl: (videoUrl && typeof videoUrl === 'string') ? videoUrl.trim() : null,
      durationMins: durationMins ? parseInt(durationMins, 10) : null,
      meetingPoint: (meetingPoint || '').trim() || null,
      cancellationPolicy: (cancellationPolicy || '').trim() || null,
      freeCancellation: freeCancellation !== false,
      freeCancellationHours: freeCancellationHours != null ? parseInt(freeCancellationHours, 10) : 24,
      languages: Array.isArray(languages) ? languages : ['en'],
      status: 'pending',
    });

    if (Array.isArray(paxOptions) && paxOptions.length > 0) {
      const opts = paxOptions.map((o) => ({
        tourId: tour.id,
        label: (o.label || 'Pax').trim(),
        pricePerPax: parseFloat(o.pricePerPax) || 0,
        currency: (o.currency || 'USD').trim(),
        minCount: parseInt(o.minCount, 10) || 1,
        maxCount: o.maxCount ? parseInt(o.maxCount, 10) : null,
      }));
      await TourPaxOption.bulkCreate(opts);
    }

    if (Array.isArray(slots) && slots.length > 0) {
      const agency = await TravelAgency.findByPk(req.agencyId, { attributes: [] });
      const curr = agency?.currency || 'USD';
      const slotRows = slots.map((s) => ({
        tourId: tour.id,
        slotDate: (s.slotDate || '').trim(),
        startTime: (s.startTime || '09:00').trim(),
        endTime: (s.endTime || '').trim() || null,
        maxPax: parseInt(s.maxPax, 10) || 10,
        bookedPax: 0,
      }));
      await TourSlot.bulkCreate(slotRows);
    }

    return res.status(201).json({
      id: String(tour.id),
      message: 'Tour created. It will appear after admin approval.',
    });
  } catch (err) {
    console.error('[agency] create tour', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/agency/tours/:id – Tour detail (own only, with same flags as user sees) */
router.get('/tours/:id', authMiddleware, async (req, res) => {
  try {
    const tour = await Tour.findOne({
      where: { id: req.params.id, travelAgencyId: req.agencyId },
      include: [
        { model: TourPaxOption, as: 'TourPaxOptions' },
        { model: TourSlot, as: 'TourSlots' },
      ],
    });
    if (!tour) return res.status(404).json({ error: 'Tour not found' });
    const { flagsMap } = await computeTourFlags([tour]);
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
      freeCancellation: !!tour.freeCancellation,
      freeCancellationHours: tour.freeCancellationHours || 24,
      flags: flagsMap[tour.id] || [],
      languages: tour.languages || [],
      status: tour.status,
      suspendReason: tour.suspendReason || null,
      suspendFixInstructions: tour.suspendFixInstructions || null,
      paxOptions: (tour.TourPaxOptions || []).map((p) => ({
        id: String(p.id),
        label: p.label,
        pricePerPax: p.pricePerPax,
        currency: p.currency,
        minCount: p.minCount,
        maxCount: p.maxCount,
      })),
      slots: (tour.TourSlots || []).map((s) => ({
        id: String(s.id),
        slotDate: s.slotDate,
        startTime: s.startTime,
        endTime: s.endTime,
        maxPax: s.maxPax,
        bookedPax: s.bookedPax,
      })),
      createdAt: tour.createdAt,
    });
  } catch (err) {
    console.error('[agency] tour detail', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** PUT /api/agency/tours/:id – Update tour (own only).
 * Resets to pending only if non-media fields changed. Photo/video only → status unchanged.
 */
router.put('/tours/:id', authMiddleware, async (req, res) => {
  try {
    const tour = await Tour.findOne({
      where: { id: req.params.id, travelAgencyId: req.agencyId },
    });
    if (!tour) return res.status(404).json({ error: 'Tour not found' });
    if (tour.status === 'blocked') {
      return res.status(403).json({ error: 'This tour is blocked. Contact admin for reinstatement.' });
    }

    const body = req.body || {};
    const updates = {};
    const nonMediaKeys = ['title', 'country', 'city', 'location', 'category', 'description', 'includedServices', 'durationMins', 'meetingPoint', 'cancellationPolicy', 'freeCancellation', 'freeCancellationHours', 'languages'];
    const mediaKeys = ['images', 'videoUrl'];

    for (const key of [...nonMediaKeys, ...mediaKeys]) {
      if (body[key] === undefined) continue;
      if (key === 'images' && Array.isArray(body[key])) updates[key] = body[key].slice(0, 10);
      else if (key === 'videoUrl') updates[key] = (body[key] && typeof body[key] === 'string') ? body[key].trim() : null;
      else if (key === 'languages' && Array.isArray(body[key])) updates[key] = body[key];
      else if (key === 'freeCancellation') updates[key] = body[key] !== false;
      else if (key === 'freeCancellationHours') updates[key] = body[key] != null ? parseInt(body[key], 10) : 24;
      else if (typeof body[key] === 'string') updates[key] = body[key].trim() || null;
      else updates[key] = body[key];
    }

    const nonMediaChanged = nonMediaKeys.some((k) => {
      if (updates[k] === undefined) return false;
      const curr = tour.get(k);
      const next = updates[k];
      if (Array.isArray(curr) && Array.isArray(next)) return JSON.stringify(curr) !== JSON.stringify(next);
      return String(curr || '') !== String(next || '');
    });

    if (nonMediaChanged || tour.status === 'suspended') {
      updates.status = 'pending';
      updates.suspendReason = null;
      updates.suspendFixInstructions = null;
      if (nonMediaChanged) {
        const changeSummary = (body.changeSummary && typeof body.changeSummary === 'string')
          ? body.changeSummary.trim().slice(0, 2000)
          : null;
        updates.pendingChangeSummary = changeSummary;
      } else {
        updates.pendingChangeSummary = null;
      }
    } else {
      updates.pendingChangeSummary = null;
    }
    await tour.update(updates);

    return res.json({
      ok: true,
      message: nonMediaChanged ? 'Tour updated. It will be pending until admin re-approves.' : 'Tour updated. Media changes are live.',
    });
  } catch (err) {
    console.error('[agency] update tour', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/agency/tours/:id – Delete tour (own only) */
router.delete('/tours/:id', authMiddleware, async (req, res) => {
  try {
    const tour = await Tour.findOne({
      where: { id: req.params.id, travelAgencyId: req.agencyId },
    });
    if (!tour) return res.status(404).json({ error: 'Tour not found' });
    await TourPaxOption.destroy({ where: { tourId: tour.id } });
    await TourSlot.destroy({ where: { tourId: tour.id } });
    await tour.destroy();
    return res.json({ ok: true });
  } catch (err) {
    console.error('[agency] delete tour', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Agency Payout (earnings from tour bookings) ─────────────────────────────────

/** GET /api/agency/wallet – Balance + bookings summary */
router.get('/wallet', authMiddleware, async (req, res) => {
  try {
    const [wallet] = await AgencyWallet.findOrCreate({
      where: { travelAgencyId: req.agencyId },
      defaults: { travelAgencyId: req.agencyId, balance: 0, currency: 'USD' },
    });
    const paidCount = await TourBooking.count({
      where: { travelAgencyId: req.agencyId, status: 'paid' },
    });
    return res.json({
      balance: wallet.balance,
      currency: wallet.currency,
      paidBookingsCount: paidCount,
    });
  } catch (err) {
    console.error('[agency] wallet', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/agency/payout-request – Request payout (withdraw earnings) */
router.post('/payout-request', authMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const amount = body.amount != null ? Number(body.amount) : NaN;
    const bankDetails = body.bankDetails || null;

    if (Number.isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount required' });
    }

    const [wallet] = await AgencyWallet.findOrCreate({
      where: { travelAgencyId: req.agencyId },
      defaults: { travelAgencyId: req.agencyId, balance: 0, currency: 'USD' },
    });

    if (wallet.balance < amount) {
      return res.status(400).json({
        error: 'Insufficient balance',
        balance: wallet.balance,
        requested: amount,
      });
    }

    const payout = await AgencyPayoutRequest.create({
      travelAgencyId: req.agencyId,
      amount,
      currency: wallet.currency,
      bankDetails,
      status: 'pending',
    });

    await wallet.decrement('balance', { by: amount });

    return res.status(201).json({
      id: String(payout.id),
      amount,
      currency: payout.currency,
      status: 'pending',
      message: 'Payout request submitted. Admin will process via bank transfer.',
    });
  } catch (err) {
    console.error('[agency] payout-request', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/agency/payout-requests – List my payout requests. Query: from, to (YYYY-MM-DD), status (pending|processing|completed|rejected). */
router.get('/payout-requests', authMiddleware, async (req, res) => {
  try {
    const { from, to, status } = req.query || {};
    const where = { travelAgencyId: req.agencyId };

    if (status && ['pending', 'processing', 'completed', 'rejected'].includes(String(status).toLowerCase())) {
      where.status = String(status).toLowerCase();
    }
    if (from || to) {
      where.createdAt = {};
      if (from) {
        const d = new Date(String(from));
        d.setHours(0, 0, 0, 0);
        where.createdAt[Op.gte] = d;
      }
      if (to) {
        const d = new Date(String(to));
        d.setHours(23, 59, 59, 999);
        where.createdAt[Op.lte] = d;
      }
    }

    const list = await AgencyPayoutRequest.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: 100,
    });
    return res.json({
      requests: list.map((r) => ({
        id: String(r.id),
        amount: r.amount,
        currency: r.currency,
        gatewayCharges: r.gatewayCharges,
        transferFee: r.transferFee,
        netAmount: r.netAmount,
        status: r.status,
        adminNote: r.adminNote,
        createdAt: r.createdAt,
        processedAt: r.processedAt,
      })),
    });
  } catch (err) {
    console.error('[agency] payout-requests', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/agency/bookings – List my tour bookings. Query: from, to (YYYY-MM-DD), status, tourId, flag (new_arrival|most_selling|top_rated|booked_yesterday). */
router.get('/bookings', authMiddleware, async (req, res) => {
  try {
    const { from, to, status, tourId, flag } = req.query || {};
    const where = { travelAgencyId: req.agencyId };

    if (status && ['pending_payment', 'paid', 'completed', 'cancelled'].includes(String(status))) {
      where.status = String(status);
    }
    if (tourId) where.tourId = parseInt(tourId, 10);

    if (from || to) {
      where.createdAt = {};
      if (from) {
        const d = new Date(String(from));
        d.setHours(0, 0, 0, 0);
        where.createdAt[Op.gte] = d;
      }
      if (to) {
        const d = new Date(String(to));
        d.setHours(23, 59, 59, 999);
        where.createdAt[Op.lte] = d;
      }
    }

    if (flag && ['new_arrival', 'most_selling', 'top_rated', 'booked_yesterday'].includes(String(flag))) {
      const agencyTours = await Tour.findAll({
        where: { travelAgencyId: req.agencyId, status: 'approved' },
        attributes: ['id'],
        raw: true,
      });
      const tours = await Tour.findAll({
        where: { id: agencyTours.map((t) => t.id) },
        include: [{ model: TourPaxOption, as: 'TourPaxOptions', attributes: ['id'] }],
      });
      const { flagsMap } = await computeTourFlags(tours);
      const tourIdsByFlag = tours.filter((t) => (flagsMap[t.id] || []).some((f) => f.type === String(flag))).map((t) => t.id);
      if (tourIdsByFlag.length === 0) {
        where.tourId = -1;
      } else if (where.tourId) {
        if (!tourIdsByFlag.includes(where.tourId)) where.tourId = -1;
      } else {
        where.tourId = { [Op.in]: tourIdsByFlag };
      }
    }

    const bookings = await TourBooking.findAll({
      where,
      include: [
        { model: Tour, as: 'Tour', attributes: ['id', 'title', 'city', 'category'] },
        { model: TourSlot, as: 'TourSlot', attributes: ['id', 'slotDate', 'startTime', 'endTime'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 200,
    });

    const { flagsMap } = await computeTourFlags(bookings.map((b) => b.Tour).filter(Boolean));
    return res.json({
      bookings: bookings.map((b) => ({
        id: String(b.id),
        voucherCode: b.voucherCode,
        status: b.status,
        totalAmount: b.totalAmount,
        currency: b.currency,
        paxCount: b.paxCount,
        guestName: b.guestName,
        guestEmail: b.guestEmail,
        guestPhone: b.guestPhone,
        guestWhatsApp: b.guestWhatsApp,
        tourTitle: b.Tour?.title,
        tourId: b.Tour ? String(b.Tour.id) : null,
        tourCategory: b.Tour?.category,
        slotDate: b.TourSlot?.slotDate || null,
        slotStartTime: b.TourSlot?.startTime || null,
        slotEndTime: b.TourSlot?.endTime || null,
        flags: (b.Tour && flagsMap[b.Tour.id]) ? flagsMap[b.Tour.id] : [],
        createdAt: b.createdAt,
      })),
    });
  } catch (err) {
    console.error('[agency] bookings', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
