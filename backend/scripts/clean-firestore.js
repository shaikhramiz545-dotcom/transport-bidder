#!/usr/bin/env node
/**
 * Clean all driver-related data from Firestore
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { getAdmin } = require('../src/services/firebase-admin');

async function cleanFirestore() {
  try {
    const admin = getAdmin();
    if (!admin) {
      console.log('⚠️  Firestore not configured, skipping');
      process.exit(0);
    }

    const db = admin.firestore();
    
    const collections = ['driver_verifications', 'drivers', 'driver_wallets', 'driverVerifications', 'driverWallets'];
    
    for (const collectionName of collections) {
      try {
        const snapshot = await db.collection(collectionName).get();
        if (snapshot.empty) {
          console.log(`✓ ${collectionName}: already empty`);
          continue;
        }
        
        const batch = db.batch();
        let count = 0;
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          count++;
        });
        
        await batch.commit();
        console.log(`✓ Deleted ${count} documents from: ${collectionName}`);
      } catch (err) {
        console.warn(`✗ Failed to clean ${collectionName}:`, err.message);
      }
    }
    
    console.log('\n✅ Firestore driver data cleaned');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

cleanFirestore();
