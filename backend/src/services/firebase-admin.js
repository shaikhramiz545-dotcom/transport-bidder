const { admin, db } = require('../config/firebase');

/**
 * Firebase Admin SDK – used to update user passwords on reset (user & driver app).
 * 
 * Now uses the centralized configuration from src/config/firebase.js
 */

function getAdmin() {
  if (admin && admin.apps.length) {
    return admin;
  }
  return null;
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
  return db;
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
