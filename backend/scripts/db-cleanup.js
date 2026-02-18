/**
 * One-time DB cleanup: keep only the correct driverId (d-57660) for phone +919027555371.
 * Delete junk verification rows created by the ID-reset bug.
 * Documents for junk IDs with 0 docs are safe to remove.
 */
require('dotenv').config();
const { pool } = require('../src/config/db');

// The correct driverId for this phone (approved, 7/7 docs, phone mapped).
const CORRECT_ID = 'd-57660';
const PHONE = '+919027555371';

// Junk IDs created by the bug (no real docs or duplicate).
const JUNK_IDS = ['d-214565', 'd-3970471'];

(async () => {
  try {
    console.log('=== CLEANUP START ===');

    // 1. Delete junk DriverVerification rows
    for (const junkId of JUNK_IDS) {
      const r = await pool.query('DELETE FROM "DriverVerifications" WHERE "driverId" = $1', [junkId]);
      console.log(`  Deleted verification for ${junkId}: ${r.rowCount} row(s)`);
    }

    // 2. Delete any junk DriverDocuments (should be 0 for these IDs)
    for (const junkId of JUNK_IDS) {
      const r = await pool.query('DELETE FROM "DriverDocuments" WHERE "driverId" = $1', [junkId]);
      console.log(`  Deleted documents for ${junkId}: ${r.rowCount} row(s)`);
    }

    // 3. Delete any junk DriverWallet rows
    for (const junkId of JUNK_IDS) {
      const r = await pool.query('DELETE FROM "DriverWallets" WHERE "driverId" = $1', [junkId]);
      console.log(`  Deleted wallet for ${junkId}: ${r.rowCount} row(s)`);
    }

    // 4. Confirm correct mapping
    const mapping = await pool.query('SELECT * FROM "DriverIdentities" WHERE phone = $1', [PHONE]);
    if (mapping.rows.length > 0) {
      console.log(`\n  Phone mapping OK: ${PHONE} -> ${mapping.rows[0].driverId}`);
    } else {
      console.log(`\n  WARNING: No mapping found for ${PHONE}. Creating...`);
      await pool.query('INSERT INTO "DriverIdentities" (phone, "driverId", "createdAt", "updatedAt") VALUES ($1, $2, NOW(), NOW())', [PHONE, CORRECT_ID]);
      console.log(`  Created mapping: ${PHONE} -> ${CORRECT_ID}`);
    }

    // 5. Confirm correct driverId status
    const ver = await pool.query('SELECT "driverId", status FROM "DriverVerifications" WHERE "driverId" = $1', [CORRECT_ID]);
    console.log(`\n  ${CORRECT_ID} status: ${ver.rows[0]?.status || 'NOT FOUND'}`);

    const docs = await pool.query('SELECT count(DISTINCT "documentType")::int as c FROM "DriverDocuments" WHERE "driverId" = $1', [CORRECT_ID]);
    console.log(`  ${CORRECT_ID} docs: ${docs.rows[0]?.c || 0}/7`);

    console.log('\n=== CLEANUP DONE ===');
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
})();
