/**
 * MSG91 – transactional email service for OTP & notifications.
 * Used for: account verification, forgot-password, general notifications.
 *
 * Env vars:
 *   MSG91_AUTH_KEY      – Auth key from MSG91 dashboard
 *   MSG91_FROM_EMAIL    – verified sender (e.g. noreply@transportbidder.com)
 *   MSG91_FROM_NAME     – display name (e.g. TransportBidder)
 *   MSG91_DOMAIN        – verified domain in MSG91 (e.g. transportbidder.com)
 */

const API_URL = 'https://control.msg91.com/api/v5/email/send';
const AUTH_KEY = process.env.MSG91_AUTH_KEY || '';
const FROM_EMAIL = process.env.MSG91_FROM_EMAIL || 'noreply@notification.transportbidder.com';
const FROM_NAME = process.env.MSG91_FROM_NAME || 'TransportBidder';
const DOMAIN = process.env.MSG91_DOMAIN || 'notification.transportbidder.com';
const TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID || 'global_otp';

function isConfigured() {
  return !!AUTH_KEY;
}

/**
 * Send an email via MSG91 Email API v5.
 * @param {string} toEmail
 * @param {string} toName
 * @param {string} subject
 * @param {string} htmlBody
 * @returns {Promise<boolean>}
 */
async function sendEmail(toEmail, toName, subject, htmlBody, variables = {}) {
  if (!AUTH_KEY) {
    console.error('[msg91] MSG91_AUTH_KEY not set; email skipped.');
    return false;
  }

  const body = {
    recipients: [
      {
        to: [{ email: toEmail, name: toName || toEmail }],
        variables,
      },
    ],
    from: { email: FROM_EMAIL, name: FROM_NAME },
    domain: DOMAIN,
    template_id: TEMPLATE_ID,
  };

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'authkey': AUTH_KEY,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      console.log('[msg91] email sent to', toEmail, data);
      return true;
    }
    const errText = await res.text();
    console.error(`[msg91] send failed (${res.status}):`, errText);
    return false;
  } catch (err) {
    console.error('[msg91] send error:', err.message);
    return false;
  }
}

/**
 * Send account verification OTP email.
 * @param {string} toEmail
 * @param {string} otp – 6-digit code
 * @param {'user'|'driver'} role
 */
async function sendVerificationOtp(toEmail, otp, role = 'user') {
  const appName = role === 'driver' ? 'TransportBidder Driver' : 'TransportBidder';
  const subject = `${appName} – Verify your email`;
  return sendEmail(toEmail, '', subject, '', {
    otp,
    company_name: appName,
  });
}

/**
 * Send password reset OTP email.
 * @param {string} toEmail
 * @param {string} otp – 6-digit code
 * @param {'user'|'driver'|'admin'|'agency'} scope
 */
async function sendPasswordResetOtp(toEmail, otp, scope = 'user') {
  const scopeNames = {
    user: 'User App',
    driver: 'Driver App',
    admin: 'Admin Panel',
    agency: 'Partner Portal',
  };
  const panelName = scopeNames[scope] || 'TransportBidder';
  const subject = `TransportBidder – Password Reset OTP (${panelName})`;
  return sendEmail(toEmail, '', subject, '', {
    otp,
    company_name: `TransportBidder ${panelName}`,
  });
}

/**
 * Send welcome email after successful signup/verification.
 * Uses MSG91 template: template_13_02_2026_16_02
 * @param {string} toEmail
 * @param {string} userName
 * @param {'user'|'driver'} role
 */
async function sendWelcomeEmail(toEmail, userName, role = 'user') {
  if (!AUTH_KEY) {
    console.error('[msg91] MSG91_AUTH_KEY not set; welcome email skipped.');
    return false;
  }

  const appName = role === 'driver' ? 'TransportBidder Driver' : 'TransportBidder';
  const body = {
    recipients: [
      {
        to: [{ email: toEmail, name: userName || toEmail }],
        variables: {
          name: userName || 'User',
          company_name: appName,
        },
      },
    ],
    from: { email: FROM_EMAIL, name: FROM_NAME },
    domain: DOMAIN,
    template_id: 'template_13_02_2026_16_02',
  };

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'authkey': AUTH_KEY,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      console.log('[msg91] welcome email sent to', toEmail);
      return true;
    }
    const errText = await res.text();
    console.error(`[msg91] welcome email failed (${res.status}):`, errText);
    return false;
  } catch (err) {
    console.error('[msg91] welcome email error:', err.message);
    return false;
  }
}

module.exports = { isConfigured, sendEmail, sendVerificationOtp, sendPasswordResetOtp, sendWelcomeEmail };
