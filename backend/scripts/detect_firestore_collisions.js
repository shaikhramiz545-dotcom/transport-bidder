#!/usr/bin/env node
/**
 * FIRESTORE DRIVER ID COLLISION DETECTION
 * 
 * Scans the Firestore 'users' collection for drivers that share the same driverId.
 * Also checks driver_wallets and driver_verifications collections.
 * 
 * Usage:
 *   node scripts/detect_firestore_collisions.js           # Detect only
 *   node scripts/detect_firestore_collisions.js --repair   # Detect + repair (reassign IDs)
 * 
 * Requires: FIREBASE_SERVICE_ACCOUNT_PATH env var.
 */

const crypto = require('crypto');
const args = process.argv.slice(2);
const MODE_REPAIR = args.includes('--repair');

function generateSecureDriverId(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits || digits.length < 7) {
    return `DRV-${crypto.randomBytes(6).toString('hex')}`;
  }
  const hash = crypto.createHash('sha256').update(digits).digest('hex');
  return `DRV-${hash.slice(0, 12)}`;
}

async function main() {
  // Initialize Firebase Admin
  let db;
  try {
    const { getFirestore } = require('../src/services/firebase-admin');
    db = getFirestore();
    if (!db) throw new Error('Firestore not initialized');
  } catch (err) {
    console.error('Failed to initialize Firestore. Set FIREBASE_SERVICE_ACCOUNT_PATH.');
    console.error(err.message);
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log('FIRESTORE DRIVER ID COLLISION DETECTION');
  console.log('='.repeat(70));

  // ---------- Phase 1: Scan users collection ----------
  console.log('\n--- Scanning Firestore users collection ---');
  const usersSnap = await db.collection('users').where('role', '==', 'driver').get();
  console.log(`  Total driver users: ${usersSnap.size}`);

  const idMap = new Map(); // driverId -> [{ docId, phone, createdAt }]
  for (const doc of usersSnap.docs) {
    const d = doc.data();
    if (!d.driverId) continue;
    if (!idMap.has(d.driverId)) idMap.set(d.driverId, []);
    idMap.get(d.driverId).push({
      docId: doc.id,
      phone: d.phone,
      createdAt: d.createdAt?.toDate?.() || d.createdAt || null,
    });
  }

  const collisions = [];
  for (const [driverId, entries] of idMap) {
    if (entries.length > 1) {
      collisions.push({ driverId, entries });
    }
  }

  if (collisions.length === 0) {
    console.log('  ✅ No driverId collisions found in Firestore users collection.');
  } else {
    console.log(`  ⚠️  Found ${collisions.length} collided driverIds:\n`);
    for (const c of collisions) {
      console.log(`  driverId: ${c.driverId}`);
      for (const e of c.entries) {
        console.log(`    - docId=${e.docId}  phone=${e.phone}  created=${e.createdAt}`);
      }
    }
  }

  // ---------- Phase 2: Check shared wallets ----------
  console.log('\n--- Checking driver_wallets collection ---');
  for (const c of collisions) {
    const walletSnap = await db.collection('driver_wallets')
      .where('driverId', '==', c.driverId).get();
    if (!walletSnap.empty) {
      const w = walletSnap.docs[0].data();
      console.log(`  driverId=${c.driverId}  wallet_balance=${w.balance ?? 0}  shared_by=${c.entries.length}_drivers`);
    }
  }

  // ---------- Phase 3: Check shared verifications ----------
  console.log('\n--- Checking driver_verifications collection ---');
  for (const c of collisions) {
    const verifSnap = await db.collection('driver_verifications')
      .where('driverId', '==', c.driverId).get();
    if (!verifSnap.empty) {
      const v = verifSnap.docs[0].data();
      console.log(`  driverId=${c.driverId}  status=${v.status}  name=${v.driverName || 'N/A'}  shared_by=${c.entries.length}_drivers`);
    }
  }

  // ---------- Summary ----------
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Collided driverIds: ${collisions.length}`);
  console.log(`  Total affected drivers: ${collisions.reduce((s, c) => s + c.entries.length, 0)}`);

  if (!MODE_REPAIR) {
    console.log('\nRun with --repair to fix collisions.');
    process.exit(0);
  }

  // ========== REPAIR MODE ==========
  console.log('\n' + '='.repeat(70));
  console.log('EXECUTING FIRESTORE REPAIRS');
  console.log('='.repeat(70));

  for (const c of collisions) {
    // Sort by createdAt ascending — earliest keeps the original ID
    c.entries.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ta - tb;
    });

    const original = c.entries[0];
    console.log(`\n  Collision: ${c.driverId}`);
    console.log(`    Original owner (keeps ID): phone=${original.phone} docId=${original.docId}`);

    for (let i = 1; i < c.entries.length; i++) {
      const entry = c.entries[i];
      const newDriverId = generateSecureDriverId(entry.phone);
      console.log(`    Reassigning: phone=${entry.phone} docId=${entry.docId} → NEW driverId=${newDriverId}`);

      try {
        // Update user document
        await db.collection('users').doc(entry.docId).update({
          driverId: newDriverId,
          _collisionRepaired: true,
          _previousDriverId: c.driverId,
          updatedAt: new Date(),
        });

        // Create fresh wallet for reassigned driver
        const existingWallet = await db.collection('driver_wallets')
          .where('driverId', '==', newDriverId).get();
        if (existingWallet.empty) {
          await db.collection('driver_wallets').add({
            driverId: newDriverId,
            balance: 0,
            lastScratchAt: null,
            creditsValidUntil: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          console.log(`      ✅ Created fresh wallet for ${newDriverId}`);
        }

        // Create fresh verification for reassigned driver
        const existingVerif = await db.collection('driver_verifications')
          .where('driverId', '==', newDriverId).get();
        if (existingVerif.empty) {
          await db.collection('driver_verifications').add({
            driverId: newDriverId,
            status: 'pending',
            blockReason: 'Re-verification required after ID collision repair',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          console.log(`      ✅ Created fresh verification (pending) for ${newDriverId}`);
        }

        console.log(`      ✅ Repair completed for phone=${entry.phone}`);
      } catch (err) {
        console.error(`      ❌ Repair FAILED for phone=${entry.phone}: ${err.message}`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('DONE');
  console.log('='.repeat(70));
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
