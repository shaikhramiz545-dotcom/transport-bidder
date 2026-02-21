const express = require('express');
const { sequelize } = require('../config/db');
const router = express.Router();
router.get('/', async (req, res) => {
  try {
    const [migrations] = await sequelize.query('SELECT name, run_at FROM schema_migrations ORDER BY name ASC');
    const [columns] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'DriverVerifications'
    `);
    res.json({ migrations, columns: columns.map(c => c.column_name) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;
