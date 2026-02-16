const express = require('express');
const https = require('https');
const axios = require('axios');

const router = express.Router();
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY';

/**
 * Proxy Places Autocomplete - avoids CORS on Flutter Web.
 * GET /api/places/autocomplete?input=...&sessiontoken=...
 */
router.get('/autocomplete', async (req, res) => {
  try {
    const { input, sessiontoken } = req.query;
    if (!input || typeof input !== 'string') {
      return res.status(400).json({ status: 'INVALID_REQUEST', predictions: [] });
    }
    const params = new URLSearchParams({
      input: input.trim(),
      key: GOOGLE_API_KEY,
      language: 'es',
    });
    if (sessiontoken) params.set('sessiontoken', sessiontoken);
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`;
    const response = await axios.get(url);
    res.json(response.data);
  } catch (e) {
    console.error('[places proxy] autocomplete', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * Proxy Place Details - avoids CORS on Flutter Web.
 * GET /api/places/details?place_id=...
 */
router.get('/details', (req, res) => {
  const { place_id } = req.query;
  if (!place_id) {
    return res.status(400).json({ status: 'INVALID_REQUEST' });
  }
  const params = new URLSearchParams({
    place_id,
    key: GOOGLE_API_KEY,
    fields: 'geometry',
    language: 'es',
  });
  const path = `/maps/api/place/details/json?${params}`;
  _proxyToGoogle(path, res);
});

function _proxyToGoogle(path, res) {
  const opts = {
    hostname: 'maps.googleapis.com',
    path,
    method: 'GET',
  };
  const req = https.request(opts, (gRes) => {
    let body = '';
    gRes.on('data', (chunk) => { body += chunk; });
    gRes.on('end', () => {
      res.status(gRes.statusCode || 200).json(JSON.parse(body || '{}'));
    });
  });
  req.on('error', (err) => {
    console.error('[places proxy]', err.message);
    res.status(502).json({ status: 'ERROR', error: err.message });
  });
  req.end();
}

module.exports = router;
