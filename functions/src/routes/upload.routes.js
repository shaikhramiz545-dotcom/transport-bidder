/**
 * File upload for tours – DISABLED to reduce storage/bandwidth cost.
 * Any attempt to POST /api/agency/upload will return 410 Gone.
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');

const router = express.Router();

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.type !== 'agency') return res.status(401).json({ error: 'Invalid token' });
    req.agencyId = payload.agencyId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

router.use(authMiddleware);

/** POST /api/agency/upload – now disabled (no files stored). */
router.post('/upload', (_req, res) => {
  return res.status(410).json({
    error: 'File uploads are disabled. Media is preview-only and not stored on the server.',
  });
});

module.exports = router;
