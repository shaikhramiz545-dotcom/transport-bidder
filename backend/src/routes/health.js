const express = require('express');
const { healthCheck } = require('../config/db');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const dbOk = await healthCheck();
    
    // Use standard response wrapper if available
    if (res.jsonSuccess) {
      return res.jsonSuccess({
        ok: dbOk,
        service: 'tbidder-api',
        db: dbOk ? 'postgresql' : 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }

    // Fallback if middleware is skipped (should not happen)
    res.status(dbOk ? 200 : 503).json({
      success: true,
      data: {
        ok: dbOk,
        service: 'tbidder-api',
        db: dbOk ? 'postgresql' : 'disconnected',
        timestamp: new Date().toISOString(),
      },
      error: null
    });
  } catch (err) {
    if (res.jsonError) {
      return res.jsonError('Health check failed', 'HEALTH_CHECK_FAILED', 500);
    }
    res.status(500).json({ error: 'Health check failed' });
  }
});

module.exports = router;
