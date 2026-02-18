/**
 * Driver Wallet API – Manual prepaid recharge.
 * Drivers submit recharge requests; admin approves manually.
 */
const express = require('express');
const { DriverWallet, WalletTransaction, DriverIdentity } = require('../models');
const { sequelize } = require('../config/db');
const { calculateCredits } = require('../utils/wallet');
const { authenticate, requireRole } = require('../utils/auth');

const router = express.Router();

async function resolveAuthDriverId(req) {
  // SECURITY: Resolve driverId from authenticated phone via DriverIdentity mapping.
  // This prevents client-supplied driverId from accessing another driver's wallet.
  const phone = req.auth?.phone ? String(req.auth.phone).trim() : '';
  if (!phone) return null;
  const row = await DriverIdentity.findOne({ where: { phone }, raw: true });
  return row?.driverId ? String(row.driverId) : null;
}

/** SECURITY: Enforce that authenticated driver can only access their own wallet data. */
function enforceWalletOwnership(req, res, next) {
  const authDriverId = req._authDriverId; // set by middleware below
  const requestedDriverId = (req.body?.driverId || req.query?.driverId || '').trim();
  if (authDriverId && requestedDriverId && requestedDriverId !== authDriverId) {
    console.warn('[wallet][SECURITY] Ownership violation attempt', {
      authDriverId, requestedDriverId, ip: req.ip, path: req.path,
      phone: req.auth?.phone || 'unknown',
    });
    return res.status(403).json({ error: 'Forbidden: ownership mismatch' });
  }
  next();
}

// All wallet endpoints are driver-only
router.use(authenticate, requireRole('driver'));

// Pre-resolve driverId for ownership checks
router.use(async (req, res, next) => {
  try {
    req._authDriverId = await resolveAuthDriverId(req);
  } catch (_) { req._authDriverId = null; }
  next();
});

router.use(enforceWalletOwnership);

/** GET /api/wallet/balance?driverId=xxx – Driver: current credits. Credits valid 1 year; if expired, balance = 0. */
router.get('/balance', async (req, res) => {
  try {
    const authDriverId = await resolveAuthDriverId(req);
    const requestedDriverId = (req.query.driverId || '').trim();
    const driverId = authDriverId || requestedDriverId;
    if (!driverId) return res.status(400).json({ error: 'driverId required' });
    if (authDriverId && requestedDriverId && requestedDriverId !== authDriverId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const [wallet] = await DriverWallet.findOrCreate({
      where: { driverId },
      defaults: { driverId, balance: 0 },
    });
    await wallet.reload();
    const today = new Date().toISOString().slice(0, 10);
    const validUntil = wallet.creditsValidUntil ? String(wallet.creditsValidUntil).slice(0, 10) : null;
    const isExpired = validUntil ? validUntil < today : false;
    const effectiveBalance = isExpired ? 0 : (wallet.balance || 0);
    return res.json({
      balance: effectiveBalance,
      creditsValidUntil: validUntil || null,
      isExpired: !!isExpired,
    });
  } catch (err) {
    console.error('[wallet] balance', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/wallet/transactions?driverId=xxx – Driver: list own transactions. */
router.get('/transactions', async (req, res) => {
  try {
    const authDriverId = await resolveAuthDriverId(req);
    const requestedDriverId = (req.query.driverId || '').trim();
    const driverId = authDriverId || requestedDriverId;
    if (!driverId) return res.status(400).json({ error: 'driverId required' });
    if (authDriverId && requestedDriverId && requestedDriverId !== authDriverId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const rows = await WalletTransaction.findAll({
      where: { driverId },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
    const list = rows.map((r) => ({
      id: String(r.id),
      amountSoles: r.amountSoles,
      creditsAmount: r.creditsAmount,
      transactionId: r.transactionId,
      status: r.status,
      createdAt: r.createdAt,
    }));
    return res.json({ transactions: list });
  } catch (err) {
    console.error('[wallet] transactions', err.message);
    return res.status(500).json({ error: err.message, transactions: [] });
  }
});

/** GET /api/wallet/scratch-status?driverId=xxx – Can driver scratch today? */
router.get('/scratch-status', async (req, res) => {
  try {
    const authDriverId = await resolveAuthDriverId(req);
    const requestedDriverId = (req.query.driverId || '').trim();
    const driverId = authDriverId || requestedDriverId;
    if (!driverId) return res.status(400).json({ error: 'driverId required' });
    if (authDriverId && requestedDriverId && requestedDriverId !== authDriverId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const today = new Date().toISOString().slice(0, 10);
    const [wallet] = await DriverWallet.findOrCreate({
      where: { driverId },
      defaults: { driverId, balance: 0 },
    });
    const lastScratch = wallet.lastScratchAt ? String(wallet.lastScratchAt).slice(0, 10) : null;
    const canScratch = lastScratch !== today;
    return res.json({ canScratch, lastScratchAt: lastScratch });
  } catch (err) {
    console.error('[wallet] scratch-status', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/wallet/scratch-card – Driver: daily scratch card, win 1–10 random credits (once per day). */
router.post('/scratch-card', async (req, res) => {
  try {
    const authDriverId = await resolveAuthDriverId(req);
    const requestedDriverId = (req.body && req.body.driverId) ? String(req.body.driverId).trim() : '';
    const driverId = authDriverId || requestedDriverId;
    if (!driverId) return res.status(400).json({ error: 'driverId required' });
    if (authDriverId && requestedDriverId && requestedDriverId !== authDriverId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const today = new Date().toISOString().slice(0, 10);
    let credits, newBalance;
    try {
      await sequelize.transaction(async (t) => {
        await DriverWallet.findOrCreate({
          where: { driverId },
          defaults: { driverId, balance: 0 },
          transaction: t,
        });
        const wallet = await DriverWallet.findOne({
          where: { driverId },
          lock: t.LOCK.UPDATE,
          transaction: t,
        });
        if (wallet.lastScratchAt && String(wallet.lastScratchAt).slice(0, 10) === today) {
          throw Object.assign(new Error('already_used_today'), { isUserError: true, statusCode: 400 });
        }
        credits = Math.floor(Math.random() * 10) + 1;
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
        const newValidUntil = oneYearFromNow.toISOString().slice(0, 10);
        const currentValid = wallet.creditsValidUntil ? String(wallet.creditsValidUntil).slice(0, 10) : null;
        const setValidUntil = currentValid && currentValid > newValidUntil ? currentValid : newValidUntil;
        await wallet.increment('balance', { by: credits, transaction: t });
        await wallet.update({ lastScratchAt: today, creditsValidUntil: setValidUntil }, { transaction: t });
        await wallet.reload({ transaction: t });
        newBalance = wallet.balance;
      });
    } catch (err) {
      if (err.isUserError) {
        return res.status(err.statusCode).json({ error: err.message, message: 'Ya usaste la tarjeta de hoy. Vuelve mañana.' });
      }
      throw err;
    }
    return res.json({ credits, newBalance });
  } catch (err) {
    console.error('[wallet] scratch-card', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/wallet/recharge – Driver: submit recharge (status=pending). Blocked if 3+ rejected (fraud). */
router.post('/recharge', async (req, res) => {
  try {
    const body = req.body || {};
    const authDriverId = await resolveAuthDriverId(req);
    const requestedDriverId = (body.driverId || '').trim();
    const driverId = authDriverId || requestedDriverId;
    const amountSoles = body.amountSoles != null ? Number(body.amountSoles) : NaN;
    const transactionId = (body.transactionId || '').trim();
    const screenshotUrl = body.screenshotUrl ? String(body.screenshotUrl) : null;

    if (!driverId) return res.status(400).json({ error: 'driverId required' });
    if (authDriverId && requestedDriverId && requestedDriverId !== authDriverId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const [wallet] = await DriverWallet.findOrCreate({
      where: { driverId },
      defaults: { driverId, balance: 0 },
    });
    if ((wallet.rejectedRechargeCount || 0) >= 3) {
      console.warn('[wallet] recharge blocked – too many rejections', { driverId });
      return res.status(403).json({
        error: 'recharge_blocked',
        message: 'Too many rejected recharges. Please contact support.',
      });
    }
    if (Number.isNaN(amountSoles) || amountSoles <= 0) {
      return res.status(400).json({ error: 'amountSoles must be a positive number' });
    }
    if (!transactionId) return res.status(400).json({ error: 'transactionId required' });
    if (!screenshotUrl) return res.status(400).json({ error: 'screenshotUrl required' });

    const creditsAmount = calculateCredits(amountSoles);
    const tx = await WalletTransaction.create({
      driverId,
      amountSoles,
      creditsAmount,
      transactionId,
      screenshotUrl,
      status: 'pending',
    });
    return res.status(201).json({
      id: String(tx.id),
      message: 'Solicitud enviada. Esperando aprobación.',
    });
  } catch (err) {
    console.error('[wallet] recharge', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
