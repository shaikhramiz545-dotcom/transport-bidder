const express = require('express');
const { sequelize } = require('../config/db');
const router = express.Router();
router.post('/force-authuid', async (req, res) => {
  try {
    await sequelize.query('ALTER TABLE "DriverVerifications" ADD COLUMN IF NOT EXISTS "authUid" VARCHAR(255) UNIQUE');
    res.json({ success: true, message: 'Column authUid added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;
