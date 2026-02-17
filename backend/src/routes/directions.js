/**
 * Directions proxy – User/Driver app use this for route polyline (CORS fix).
 * GET /api/directions?origin=lat,lng&destination=lat,lng
 */
const express = require('express');
const axios = require('axios');

const router = express.Router();

/** Read API key at request time — NOT module load — so Cloud Run env updates take effect */
function getGoogleApiKey() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || '';
}

router.get('/', async (req, res) => {
  try {
    const { origin, destination } = req.query;
    if (!origin || !destination) {
      return res.status(400).json({ status: 'INVALID_REQUEST', error: 'origin and destination required' });
    }
    const apiKey = getGoogleApiKey();
    if (!apiKey) {
      return res.status(503).json({ status: 'ERROR', error: 'Directions API key not configured' });
    }
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=driving&key=${apiKey}`;
    const response = await axios.get(url);
    res.json(response.data);
  } catch (e) {
    console.error('[directions]', e.message);
    res.status(500).json({ status: 'ERROR', error: e.message });
  }
});

module.exports = router;
