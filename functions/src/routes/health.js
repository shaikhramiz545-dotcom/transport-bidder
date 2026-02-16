const express = require('express');
const { healthCheck } = require('../config/db');

const router = express.Router();

router.get('/', async (_req, res) => {
  const dbOk = await healthCheck();
  res.status(dbOk ? 200 : 503).json({
    ok: dbOk,
    service: 'tbidder-api',
    db: dbOk ? 'postgresql' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
