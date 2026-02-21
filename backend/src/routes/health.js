const express = require('express');
const axios = require('axios');
const nodemailer = require('nodemailer');
const { healthCheck } = require('../config/db');

const router = express.Router();

async function checkEmailService() {
  const host = process.env.SMTP_HOST;
  if (!host) return { ok: false, msg: 'SMTP_HOST not set' };
  try {
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    await transporter.verify();
    return { ok: true, msg: `Connected to AWS SES via SMTP (${host})` };
  } catch (err) {
    return { ok: false, msg: err.message };
  }
}

async function checkGoogleMaps() {
  const key = (process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (!key) return { ok: false, msg: 'GOOGLE_MAPS_API_KEY not set' };
  try {
    const r = await axios.get(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=Karachi&key=${key}&language=en`,
      { timeout: 6000 }
    );
    const ok = r.data?.status === 'OK' || r.data?.status === 'ZERO_RESULTS';
    return { ok, msg: ok ? 'OK' : (r.data?.error_message || r.data?.status || 'Unknown error') };
  } catch (err) {
    return { ok: false, msg: err.message };
  }
}

router.get('/', async (_req, res) => {
  try {
    const [dbOk, emailStatus, mapsStatus] = await Promise.all([
      healthCheck().catch(() => false),
      checkEmailService(),
      checkGoogleMaps(),
    ]);

    const payload = {
      ok: dbOk,
      service: 'tbidder-api',
      db: dbOk ? 'postgresql' : 'disconnected',
      email: {
        ok: emailStatus.ok,
        provider: process.env.SMTP_HOST || 'AWS SES',
        msg: emailStatus.msg,
      },
      googleMaps: {
        ok: mapsStatus.ok,
        msg: mapsStatus.msg,
      },
      timestamp: new Date().toISOString(),
    };

    if (res.jsonSuccess) {
      return res.jsonSuccess(payload);
    }
    res.status(dbOk ? 200 : 503).json({ success: true, data: payload, error: null });
  } catch (err) {
    if (res.jsonError) {
      return res.jsonError('Health check failed', 'HEALTH_CHECK_FAILED', 500);
    }
    res.status(500).json({ error: 'Health check failed' });
  }
});

module.exports = router;
