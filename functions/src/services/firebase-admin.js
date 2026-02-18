/**
 * Firebase Admin SDK – used to update user passwords on reset (user & driver app).
 * 
 * Environment Variable Options:
 * 1. FIREBASE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS - Path to service account JSON file
 * 2. FIREBASE_PRIVATE_KEY + FIREBASE_CLIENT_EMAIL + FIREBASE_PROJECT_ID - Direct credentials
 * 
 * If unset, all methods no-op (returns success for dev without Firebase).
 */
let admin = null;

function getAdmin() {
  if (admin != null) return admin;
  
  // Support both file path and direct private key environment variable
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  
  if (!path && !(privateKey && clientEmail && projectId)) {
    console.warn('[firebase-admin] No Firebase credentials configured; password updates skipped.');
    return null;
  }
  
  try {
    let serviceAccount;
    
    if (path) {
      // Load from file
      const fs = require('fs');
      serviceAccount = JSON.parse(fs.readFileSync(path, 'utf8'));
    } else {
      // Load from environment variables
      serviceAccount = {
        type: 'service_account',
        project_id: projectId,
        private_key: privateKey.replace(/\\n/g, '\n'),
        client_email: clientEmail
      };
    }
    
    admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    return admin;
  } catch (err) {
    console.error('[firebase-admin] Init failed:', err.message);
    return null;
  }
}

/**
 * Update Firebase user password by email.
 * @param {string} email – user email
 * @param {string} newPassword – new password (min 6 chars)
 * @returns {Promise<{ success: boolean, message?: string }>}
 */
async function updateUserPassword(email, newPassword) {
  const a = getAdmin();
  if (!a) return { success: true, message: 'Firebase Admin not configured; skip.' };
  if (!email || typeof email !== 'string' || !email.trim()) {
    return { success: false, message: 'Email required' };
  }
  const trimmedEmail = email.trim().toLowerCase();
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return { success: false, message: 'Password must be at least 6 characters' };
  }
  try {
    const user = await a.auth().getUserByEmail(trimmedEmail);
    await a.auth().updateUser(user.uid, { password: newPassword });
    return { success: true };
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      return { success: false, message: 'No Firebase user for this email. User must sign up first.' };
    }
    console.error('[firebase-admin] updateUserPassword error:', err.message);
    return { success: false, message: err.message || 'Failed to update password' };
  }
}

/** Get Firestore instance (same project as Auth). Required for backend DB. */
function getFirestore() {
  const a = getAdmin();
  if (!a) return null;
  return a.firestore();
}

/** Get Firebase Cloud Messaging instance. Returns null when Admin SDK not configured. */
function getMessaging() {
  const a = getAdmin();
  if (!a) return null;
  try {
    return a.messaging();
  } catch (err) {
    console.warn('[firebase-admin] messaging unavailable:', err.message);
    return null;
  }
}

module.exports = { getAdmin, getFirestore, getMessaging, updateUserPassword };
