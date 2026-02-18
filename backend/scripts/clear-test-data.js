const { sequelize } = require('../src/config/db');
const models = require('../src/models');

(async () => {
  try {
    await sequelize.authenticate();
    const tables = [
      'DriverDocument',
      'DriverVerificationAudit',
      'DriverVerification',
      'DriverIdentity',
      'DriverWallet',
      'WalletTransaction',
      'WalletLedger',
      'TravelAgency',
      'AgencyDocument',
      'Tour',
      'TourPaxOption',
      'TourSlot',
      'TourBooking',
      'TourReview',
      'AgencyWallet',
      'AgencyPayoutRequest',
    ];
    for (const name of tables) {
      const m = models[name];
      if (m) {
        try {
          await m.destroy({ where: {}, truncate: true, cascade: true });
        } catch (_) {}
      }
    }
    const firestoreClears = [];
    try {
      const { getDb, COL } = require('../src/db/firestore');
      const db = getDb();
      if (db) {
        const cols = [COL.driver_wallets, COL.driver_verifications, COL.wallet_transactions];
        for (const col of cols) {
          const snap = await db.collection(col).get();
          const batch = db.batch();
          snap.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
          firestoreClears.push({ col, count: snap.size });
        }
      }
    } catch (_) {}
    console.log(JSON.stringify({ ok: true, pgTruncated: tables, firestoreClears }));
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: e.message }));
    process.exit(1);
  } finally {
    try { await sequelize.close(); } catch (_) {}
  }
})();
