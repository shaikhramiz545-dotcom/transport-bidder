const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
// Priority:
// 1. Environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
// 2. Service account file (FIREBASE_SERVICE_ACCOUNT_PATH)

if (!admin.apps.length) {
  try {
    let credential;
    
    // Option 1: Direct Environment Variables
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      });
      console.log('Using Firebase credentials from environment variables');
    } 
    // Option 2: Service Account File (from env var)
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        credential = admin.credential.cert(serviceAccount);
        console.log(`Using Firebase service account file: ${process.env.FIREBASE_SERVICE_ACCOUNT_PATH}`);
      } else {
        console.warn(`Firebase service account file not found at: ${serviceAccountPath}`);
      }
    }

    // Option 3: Service Account File (default location in root)
    if (!credential) {
       const defaultPath = path.join(process.cwd(), 'firebase-service-account.json');
       if (fs.existsSync(defaultPath)) {
          console.log(`Using default Firebase service account file: ${defaultPath}`);
          const serviceAccount = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
          credential = admin.credential.cert(serviceAccount);
       }
    }

    if (credential) {
      admin.initializeApp({ credential });
      console.log('Firebase Admin initialized successfully');
    } else {
      console.warn('Firebase Admin not initialized: Missing credentials (env vars or file)');
    }
  } catch (error) {
    console.error('Firebase Admin initialization failed:', error.message);
  }
}

const db = admin.apps.length ? admin.firestore() : null;

module.exports = { db, admin };
