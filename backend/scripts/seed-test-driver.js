#!/usr/bin/env node
/**
 * Add a test driver to PostgreSQL for Admin Panel testing.
 * Run: node scripts/seed-test-driver.js
 * Requires: PostgreSQL running, migrations 001–005 applied.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sequelize } = require('../src/config/db');
const { DriverVerification } = require('../src/models');

const TEST_DRIVER_ID = 'test-driver-' + Date.now();
const TEST_DRIVER = {
  driverId: TEST_DRIVER_ID,
  status: 'pending',
  vehicleType: 'car',
  vehiclePlate: 'TEST-001',
  driverName: 'Test Driver',
  blockReason: null,
};

async function main() {
  try {
    const [row, created] = await DriverVerification.findOrCreate({
      where: { driverId: TEST_DRIVER_ID },
      defaults: TEST_DRIVER,
    });
    console.log(created ? 'Created test driver:' : 'Test driver already exists:');
    console.log('  driverId:', row.driverId);
    console.log('  status:', row.status);
    console.log('  driverName:', row.driverName);
    console.log('');
    console.log('Open Admin Panel → Drivers to see this application.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Ensure PostgreSQL is running and migrations are applied:');
    console.error('  cd backend && npm run migrate');
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
