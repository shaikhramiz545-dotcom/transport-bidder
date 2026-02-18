const { sequelize } = require('../src/config/db');
const models = require('../src/models');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected. Starting complete cleanup...');

    // ALL tables that contain user data - clear everything
    const tables = [
      // Core user data
      'AppUser',           // Email+password users (user & driver apps)
      'EmailOtp',          // Email OTPs for verification/password reset
      'User',              // Legacy users table
      'AdminUser',         // Admin sub-users
      'AdminRole',         // Admin role templates
      
      // Ride data
      'Ride',              // All ride records
      'Message',           // Ride messages
      
      // Driver data
      'DriverVerification',      // Driver verification records
      'DriverDocument',          // Driver uploaded documents
      'DriverVerificationAudit', // Driver verification audit logs
      'DriverIdentity',          // Driver phone->ID mapping
      'DriverWallet',            // Driver wallet balances
      'WalletTransaction',      // Wallet recharge transactions
      'WalletLedger',            // Wallet transaction ledger
      
      // Agency/Tour data
      'TravelAgency',       // Travel agencies
      'AgencyDocument',     // Agency verification documents
      'Tour',              // Tours
      'TourPaxOption',     // Tour pricing options
      'TourSlot',          // Tour time slots
      'TourBooking',       // Tour bookings
      'TourReview',        // Tour reviews
      'AgencyWallet',      // Agency earnings wallet
      'AgencyPayoutRequest', // Agency payout requests
      
      // System data
      'AdminSettings',     // System settings (will be recreated with defaults)
      'FeatureFlag',       // Feature flags (will be recreated with defaults)
    ];

    const results = [];

    for (const name of tables) {
      const model = models[name];
      if (model) {
        try {
          const countBefore = await model.count();
          await model.destroy({ where: {}, truncate: true, cascade: true });
          results.push({ table: name, deleted: countBefore, status: 'success' });
          console.log(`✓ ${name}: ${countBefore} records deleted`);
        } catch (error) {
          results.push({ table: name, status: 'error', error: error.message });
          console.log(`✗ ${name}: ERROR - ${error.message}`);
        }
      } else {
        results.push({ table: name, status: 'not_found' });
        console.log(`? ${name}: Model not found`);
      }
    }

    // Clear Firestore collections
    const firestoreClears = [];
    try {
      const { getDb, COL } = require('../src/db/firestore');
      const db = getDb();
      if (db) {
        const collections = [
          COL.driver_wallets,
          COL.driver_verifications,
          COL.wallet_transactions,
          COL.users,           // Users collection
          COL.drivers,         // Drivers collection
          COL.rides,           // Rides collection
          COL.messages,        // Messages collection
          COL.bids,            // Bids collection
        ];
        
        for (const colName of collections) {
          try {
            const snap = await db.collection(colName).get();
            const batch = db.batch();
            snap.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();
            firestoreClears.push({ collection: colName, count: snap.size });
            console.log(`✓ Firestore ${colName}: ${snap.size} documents deleted`);
          } catch (error) {
            console.log(`✗ Firestore ${colName}: ERROR - ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.log(`✗ Firestore connection failed: ${error.message}`);
    }

    console.log('\n=== CLEANUP COMPLETE ===');
    console.log(`PostgreSQL tables cleared: ${results.filter(r => r.status === 'success').length}`);
    console.log(`Firestore collections cleared: ${firestoreClears.length}`);
    console.log('\nAll test data including emails, phones, names, and records have been deleted.');

    // Recreate essential default data
    try {
      await models.AdminSettings.upsert({
        key: 'global',
        commissionPercent: 10,
        notificationsEnabled: true,
      });
      console.log('✓ AdminSettings recreated with defaults');

      await models.FeatureFlag.bulkCreate([
        { key: 'attractions_enabled', value: true },
        { key: 'wallet_enabled', value: true },
        { key: 'agency_portal_enabled', value: true },
      ], { ignoreDuplicates: true });
      console.log('✓ FeatureFlags recreated with defaults');
    } catch (error) {
      console.log(`Warning: Could not recreate defaults - ${error.message}`);
    }

    console.log('\nResult summary:');
    console.log(JSON.stringify({ 
      ok: true, 
      postgresResults: results,
      firestoreClears,
      timestamp: new Date().toISOString()
    }, null, 2));

  } catch (e) {
    console.error('FATAL ERROR:', e.message);
    console.log(JSON.stringify({ ok: false, error: e.message }));
    process.exit(1);
  } finally {
    try { 
      await sequelize.close();
      console.log('Database connection closed.');
    } catch (_) {}
  }
})();
