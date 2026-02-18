#!/usr/bin/env node
/**
 * Reset driver verification state in PostgreSQL for a clean test run.
 * Sets all DriverVerifications to status='pending' and clears reupload fields.
 * Does NOT delete rows or documents — so driver IDs stay and admin can approve again.
 *
 * Usage: node scripts/clear-driver-test-data.js
 * Requires: .env with PG_* set, backend migrations applied.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sequelize } = require('../src/config/db');
const { DriverVerification } = require('../src/models');

async function main() {
  try {
    const [count] = await DriverVerification.update(
      {
        status: 'pending',
        reuploadDocumentTypes: null,
        reuploadMessage: null,
      },
      { where: {} }
    );
    console.log('[clear-driver-test-data] Reset', count, 'driver verification row(s) to pending.');
    console.log('Admin panel will show all as pending. App will show fresh status on next fetch.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Ensure PostgreSQL is running and migrations are applied.');
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
