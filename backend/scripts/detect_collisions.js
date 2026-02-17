#!/usr/bin/env node
/**
 * DRIVER ID COLLISION DETECTION & REPAIR SCRIPT
 * 
 * Purpose: Detect driverId collisions caused by the vulnerable _stableDriverIdFromPhone
 * that used only last 5 digits of the phone number (100K possible IDs).
 * 
 * Usage:
 *   node scripts/detect_collisions.js --detect          # Detect only (read-only)
 *   node scripts/detect_collisions.js --repair --dry-run # Show what would be repaired
 *   node scripts/detect_collisions.js --repair           # Execute repairs (DESTRUCTIVE)
 * 
 * Requires: DATABASE_URL env var pointing to the PostgreSQL database.
 */

const crypto = require('crypto');

// ---------- Parse args ----------
const args = process.argv.slice(2);
const MODE_DETECT = args.includes('--detect');
const MODE_REPAIR = args.includes('--repair');
const DRY_RUN = args.includes('--dry-run');

if (!MODE_DETECT && !MODE_REPAIR) {
  console.log('Usage:');
  console.log('  node scripts/detect_collisions.js --detect          # Detect collisions');
  console.log('  node scripts/detect_collisions.js --repair --dry-run # Preview repairs');
  console.log('  node scripts/detect_collisions.js --repair           # Execute repairs');
  process.exit(0);
}

// ---------- New secure ID generation (matches the hotfix) ----------
function generateSecureDriverId(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits || digits.length < 7) {
    return `DRV-${crypto.randomBytes(6).toString('hex')}`;
  }
  const hash = crypto.createHash('sha256').update(digits).digest('hex');
  return `DRV-${hash.slice(0, 12)}`;
}

async function main() {
  // Lazy-require models so script fails fast if DB not configured
  let models;
  try {
    models = require('../src/models');
  } catch (err) {
    console.error('Failed to load models. Ensure DATABASE_URL is set.');
    console.error(err.message);
    process.exit(1);
  }

  const { DriverIdentity, DriverWallet, DriverVerification, DriverDocument,
          WalletTransaction, WalletLedger, DriverVerificationAudit, sequelize } = models;

  console.log('='.repeat(70));
  console.log('DRIVER ID COLLISION DETECTION');
  console.log('='.repeat(70));

  // ---------- Phase 1: Detect collisions in DriverIdentity ----------
  console.log('\n--- DriverIdentity collisions (same driverId, multiple phones) ---');
  const [identityCollisions] = await sequelize.query(`
    SELECT "driverId", COUNT(*) as phone_count, array_agg(phone ORDER BY "createdAt") as phones,
           array_agg(id ORDER BY "createdAt") as ids,
           MIN("createdAt") as earliest
    FROM "DriverIdentities"
    WHERE "driverId" IS NOT NULL
    GROUP BY "driverId"
    HAVING COUNT(*) > 1
    ORDER BY phone_count DESC;
  `);

  if (identityCollisions.length === 0) {
    console.log('  ✅ No collisions found in DriverIdentity table.');
  } else {
    console.log(`  ⚠️  Found ${identityCollisions.length} collided driverIds:`);
    for (const row of identityCollisions) {
      console.log(`    driverId=${row.driverId}  phones=[${row.phones.join(', ')}]  count=${row.phone_count}`);
    }
  }

  // ---------- Phase 2: Check wallets shared by collided drivers ----------
  console.log('\n--- Shared wallets (single wallet serving multiple drivers) ---');
  const sharedWallets = [];
  for (const collision of identityCollisions) {
    const wallet = await DriverWallet.findOne({ where: { driverId: collision.driverId }, raw: true });
    if (wallet) {
      sharedWallets.push({ ...collision, walletBalance: wallet.balance, walletId: wallet.id });
      console.log(`    driverId=${collision.driverId}  balance=${wallet.balance}  phones=[${collision.phones.join(', ')}]`);
    }
  }
  if (sharedWallets.length === 0 && identityCollisions.length > 0) {
    console.log('  No shared wallets found (wallets may not exist yet).');
  }

  // ---------- Phase 3: Check verification records ----------
  console.log('\n--- Shared verification records ---');
  for (const collision of identityCollisions) {
    const verif = await DriverVerification.findOne({ where: { driverId: collision.driverId }, raw: true });
    if (verif) {
      console.log(`    driverId=${collision.driverId}  status=${verif.status}  name=${verif.driverName || 'N/A'}  phones=[${collision.phones.join(', ')}]`);
    }
  }

  // ---------- Phase 4: Check documents shared ----------
  console.log('\n--- Shared driver documents ---');
  for (const collision of identityCollisions) {
    const docs = await DriverDocument.findAll({ where: { driverId: collision.driverId }, raw: true });
    if (docs.length > 0) {
      console.log(`    driverId=${collision.driverId}  documents=${docs.length}  types=[${docs.map(d => d.documentType).join(', ')}]`);
    }
  }

  // ---------- Summary ----------
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Total collided driverIds: ${identityCollisions.length}`);
  console.log(`  Total affected phones: ${identityCollisions.reduce((s, c) => s + c.phone_count, 0)}`);
  console.log(`  Wallets at risk: ${sharedWallets.length}`);
  console.log(`  Total credits at risk: ${sharedWallets.reduce((s, w) => s + (w.walletBalance || 0), 0)}`);

  if (!MODE_REPAIR) {
    console.log('\nRun with --repair to fix collisions, or --repair --dry-run to preview.');
    await sequelize.close();
    return;
  }

  // ========== REPAIR MODE ==========
  console.log('\n' + '='.repeat(70));
  console.log(DRY_RUN ? 'REPAIR PREVIEW (DRY RUN — no changes will be made)' : 'EXECUTING REPAIRS');
  console.log('='.repeat(70));

  for (const collision of identityCollisions) {
    const phones = collision.phones;
    const ids = collision.ids;
    const originalPhone = phones[0]; // earliest registrant keeps the ID
    const originalIdentityId = ids[0];

    console.log(`\n  Collision: ${collision.driverId}`);
    console.log(`    Original owner (keeps ID): phone=${originalPhone}`);

    for (let i = 1; i < phones.length; i++) {
      const reassignPhone = phones[i];
      const reassignIdentityId = ids[i];
      const newDriverId = generateSecureDriverId(reassignPhone);

      console.log(`    Reassigning: phone=${reassignPhone} → NEW driverId=${newDriverId}`);

      if (!DRY_RUN) {
        const t = await sequelize.transaction();
        try {
          // 1. Update DriverIdentity mapping
          await DriverIdentity.update(
            { driverId: newDriverId },
            { where: { id: reassignIdentityId }, transaction: t }
          );

          // 2. Create fresh wallet for reassigned driver
          const existingWallet = await DriverWallet.findOne({ where: { driverId: newDriverId }, transaction: t });
          if (!existingWallet) {
            await DriverWallet.create({ driverId: newDriverId, balance: 0 }, { transaction: t });
            console.log(`      ✅ Created fresh wallet for ${newDriverId}`);
          }

          // 3. Create fresh verification record (status=pending, requires re-verification)
          const existingVerif = await DriverVerification.findOne({ where: { driverId: newDriverId }, transaction: t });
          if (!existingVerif) {
            await DriverVerification.create({
              driverId: newDriverId,
              status: 'pending',
              blockReason: 'Re-verification required after ID collision repair',
            }, { transaction: t });
            console.log(`      ✅ Created fresh verification (pending) for ${newDriverId}`);
          }

          // 4. Log the repair action
          await DriverVerificationAudit.create({
            driverId: newDriverId,
            actor: 'system:collision_repair',
            action: 'reassign_driver_id',
            reason: `Collision repair: old=${collision.driverId}, phone=${reassignPhone}`,
            oldStatus: null,
            newStatus: 'pending',
            metadata: {
              oldDriverId: collision.driverId,
              newDriverId,
              phone: reassignPhone,
              repairedAt: new Date().toISOString(),
            },
          }, { transaction: t });

          await t.commit();
          console.log(`      ✅ Repair committed for phone=${reassignPhone}`);
        } catch (err) {
          await t.rollback();
          console.error(`      ❌ Repair FAILED for phone=${reassignPhone}: ${err.message}`);
        }
      } else {
        console.log(`      [DRY RUN] Would update DriverIdentity id=${reassignIdentityId}`);
        console.log(`      [DRY RUN] Would create fresh wallet for ${newDriverId}`);
        console.log(`      [DRY RUN] Would create fresh verification (pending) for ${newDriverId}`);
      }
    }
  }

  // ---------- Also update Firestore users collection ----------
  console.log('\n--- Firestore collision check ---');
  console.log('  NOTE: Run the Firestore collision check separately using:');
  console.log('  node scripts/detect_firestore_collisions.js');
  console.log('  (Firestore repairs require the Firebase Admin SDK)');

  console.log('\n' + '='.repeat(70));
  console.log('DONE');
  console.log('='.repeat(70));

  await sequelize.close();
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
