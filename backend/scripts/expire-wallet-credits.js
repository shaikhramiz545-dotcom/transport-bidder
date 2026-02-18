/**
 * Daily cron: expire credits for wallets where creditsValidUntil < today.
 * Writes WalletLedger entry (type: expiry) and sets balance to 0.
 * Run: node scripts/expire-wallet-credits.js
 */
require('dotenv').config();
const { Op } = require('sequelize');
const { DriverWallet, WalletLedger } = require('../src/models');

async function run() {
  const today = new Date().toISOString().slice(0, 10);
  const wallets = await DriverWallet.findAll({
    where: { balance: { [Op.gt]: 0 } },
    attributes: ['id', 'driverId', 'balance', 'creditsValidUntil'],
  });
  let expired = 0;
  for (const w of wallets) {
    const validUntil = w.creditsValidUntil ? String(w.creditsValidUntil).slice(0, 10) : null;
    if (!validUntil || validUntil < today) {
      await WalletLedger.create({
        driverId: w.driverId,
        type: 'expiry',
        creditsChange: -w.balance,
        refId: null,
      });
      await w.update({ balance: 0 });
      expired++;
      console.log('[expire]', w.driverId, 'expired', w.balance, 'credits');
    }
  }
  console.log('[expire] done. Expired', expired, 'wallets.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
