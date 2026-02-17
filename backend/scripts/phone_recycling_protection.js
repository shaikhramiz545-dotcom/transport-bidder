#!/usr/bin/env node
/**
 * PHONE NUMBER RECYCLING PROTECTION
 * 
 * Critical Edge Case: When telecom providers recycle phone numbers (reassign to new SIM owner),
 * the new owner should NOT inherit the previous owner's driverId, wallet, or verification.
 * 
 * Detection Strategy:
 * - Account inactive for 180+ days → likely phone number recycled
 * - On login/signup, check last activity timestamp
 * - If stale, archive old driverId and generate fresh identity
 * 
 * Usage:
 *   node scripts/phone_recycling_protection.js --audit    # Find stale accounts
 *   node scripts/phone_recycling_protection.js --enable   # Add protection to upsertUserByPhone
 */

const crypto = require('crypto');

// Stale account threshold: 180 days (6 months)
const STALE_THRESHOLD_DAYS = 180;

async function auditStaleAccounts() {
  const { getFirestore } = require('../src/services/firebase-admin');
  const db = getFirestore();
  if (!db) {
    console.error('Firestore not initialized. Set FIREBASE_SERVICE_ACCOUNT_PATH.');
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log('PHONE NUMBER RECYCLING RISK AUDIT');
  console.log('='.repeat(70));

  const now = Date.now();
  const thresholdMs = STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

  const driversSnap = await db.collection('users').where('role', '==', 'driver').get();
  console.log(`\nTotal drivers: ${driversSnap.size}`);

  const staleAccounts = [];
  for (const doc of driversSnap.docs) {
    const d = doc.data();
    const updatedAt = d.updatedAt?.toDate?.() || d.updatedAt || d.createdAt?.toDate?.() || d.createdAt;
    if (!updatedAt) continue;

    const ageMs = now - new Date(updatedAt).getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

    if (ageDays > STALE_THRESHOLD_DAYS) {
      staleAccounts.push({
        docId: doc.id,
        phone: d.phone,
        driverId: d.driverId,
        ageDays,
        lastActivity: updatedAt,
      });
    }
  }

  console.log(`\n⚠️  Stale accounts (inactive ${STALE_THRESHOLD_DAYS}+ days): ${staleAccounts.length}`);
  if (staleAccounts.length > 0) {
    console.log('\nTop 10 stale accounts:');
    staleAccounts.sort((a, b) => b.ageDays - a.ageDays).slice(0, 10).forEach(a => {
      console.log(`  phone=${a.phone}  driverId=${a.driverId}  inactive=${a.ageDays} days`);
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('RECOMMENDATION');
  console.log('='.repeat(70));
  console.log('Add phone recycling protection to upsertUserByPhone() to prevent');
  console.log('new SIM owners from inheriting old driver wallets and verifications.');
  console.log('\nRun: node scripts/phone_recycling_protection.js --enable');
}

function generateProtectionCode() {
  console.log('='.repeat(70));
  console.log('PHONE RECYCLING PROTECTION CODE');
  console.log('='.repeat(70));
  console.log('\nAdd this code to backend/src/db/firestore.js inside upsertUserByPhone():');
  console.log('\n```javascript');
  console.log(`
async function upsertUserByPhone(phone, role) {
  const db = getDb();
  if (!db) return null;
  const existing = await getUserByPhone(phone);
  const now = _ts();
  
  if (existing) {
    // PHONE RECYCLING PROTECTION: Check if account is stale (180+ days inactive)
    const lastActivity = existing.updatedAt?.toDate?.() || existing.updatedAt || existing.createdAt?.toDate?.() || existing.createdAt;
    const daysSinceActivity = lastActivity 
      ? (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
      : 999;
    
    if (daysSinceActivity > ${STALE_THRESHOLD_DAYS} && role === 'driver' && existing.driverId) {
      // Phone number likely recycled by telecom — archive old identity, create fresh one
      const crypto = require('crypto');
      const oldDriverId = existing.driverId;
      const newDriverId = _stableDriverIdFromPhone(phone) + '-R' + crypto.randomBytes(2).toString('hex');
      
      console.warn('[upsertUserByPhone][PHONE_RECYCLED]', {
        phone, oldDriverId, newDriverId, daysSinceActivity: Math.floor(daysSinceActivity)
      });
      
      await db.collection(COL.users).doc(existing.id).update({
        driverId: newDriverId,
        _archivedDriverId: oldDriverId,
        _phoneRecycled: true,
        _recycledAt: now,
        rating: 0, // Reset rating
        updatedAt: now,
      });
      
      // Archive old wallet (do NOT inherit balance)
      const oldWalletSnap = await db.collection(COL.driver_wallets)
        .where('driverId', '==', oldDriverId).limit(1).get();
      if (!oldWalletSnap.empty) {
        await oldWalletSnap.docs[0].ref.update({ 
          _archived: true, 
          _archivedAt: now,
          _reason: 'phone_recycled'
        });
      }
      
      // Create fresh wallet (balance = 0)
      await db.collection(COL.driver_wallets).add({
        driverId: newDriverId,
        balance: 0,
        lastScratchAt: null,
        creditsValidUntil: null,
        createdAt: now,
        updatedAt: now,
      });
      
      // Archive old verification
      const oldVerifSnap = await db.collection(COL.driver_verifications)
        .where('driverId', '==', oldDriverId).limit(1).get();
      if (!oldVerifSnap.empty) {
        await oldVerifSnap.docs[0].ref.update({ 
          _archived: true, 
          _archivedAt: now,
          _reason: 'phone_recycled'
        });
      }
      
      // Create fresh verification (status = pending, requires re-verification)
      await db.collection(COL.driver_verifications).add({
        driverId: newDriverId,
        status: 'pending',
        blockReason: 'Phone number recycled. Please re-verify your documents.',
        createdAt: now,
        updatedAt: now,
      });
      
      return { id: existing.id, phone, role, rating: 0, driverId: newDriverId };
    }
    
    // Normal path: account active, return existing driverId
    // ... rest of existing code
  }
  
  // ... rest of existing code
}
`);
  console.log('```\n');
  console.log('='.repeat(70));
}

const args = process.argv.slice(2);
if (args.includes('--audit')) {
  auditStaleAccounts().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
  });
} else if (args.includes('--enable')) {
  generateProtectionCode();
} else {
  console.log('Usage:');
  console.log('  node scripts/phone_recycling_protection.js --audit    # Find stale accounts');
  console.log('  node scripts/phone_recycling_protection.js --enable   # Generate protection code');
}
