require('dotenv').config();
const { pool } = require('../src/config/db');

(async () => {
  try {
    const r1 = await pool.query('SELECT "driverId", status, "driverName", "updatedAt" FROM "DriverVerifications" ORDER BY "updatedAt" DESC');
    console.log('=== DRIVER VERIFICATIONS ===');
    for (const row of r1.rows) {
      console.log(`  ${row.driverId} | ${row.status} | ${row.driverName || '-'} | ${row.updatedAt}`);
    }

    const r2 = await pool.query('SELECT * FROM "DriverIdentities"');
    console.log('\n=== PHONE MAPPINGS ===');
    for (const row of r2.rows) {
      console.log(`  ${row.phone} -> ${row.driverId}`);
    }

    const r3 = await pool.query('SELECT "driverId", "documentType" FROM "DriverDocuments" ORDER BY "driverId"');
    console.log('\n=== DOCUMENTS ===');
    const byDriver = {};
    for (const row of r3.rows) {
      if (!byDriver[row.driverId]) byDriver[row.driverId] = [];
      byDriver[row.driverId].push(row.documentType);
    }
    for (const [did, docs] of Object.entries(byDriver)) {
      console.log(`  ${did}: ${docs.length}/7 (${docs.join(', ')})`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
})();
