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
const FROM_EMAIL = process.env.MSG91_FROM_EMAIL || 'noreply@transportbidder.com';
const FROM_NAME = process.env.MSG91_FROM_NAME || 'TransportBidder';
const DOMAIN = process.env.MSG91_DOMAIN || 'transportbidder.com';

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
async function sendEmail(toEmail, toName, subject, htmlBody) {
  if (!AUTH_KEY) {
    console.error('[msg91] MSG91_AUTH_KEY not set; email skipped.');
    return false;
  }

  const body = {
    domain: DOMAIN,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    to: [{ email: toEmail, name: toName || toEmail }],
    subject,
    body: htmlBody,
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
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#FF5F00;">Email Verification</h2>
      <p>Your verification code for <strong>${appName}</strong> is:</p>
      <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#FF5F00;padding:16px 0;">${otp}</div>
      <p>This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
      <p style="color:#888;font-size:12px;">If you did not request this, please ignore this email.</p>
      <p>— TransportBidder</p>
    </div>
  `;
  return sendEmail(toEmail, '', subject, html);
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
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#FF5F00;">Password Reset</h2>
      <p>You requested a password reset for your <strong>${panelName}</strong> account.</p>
      <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#FF5F00;padding:16px 0;">${otp}</div>
      <p>This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
      <p style="color:#888;font-size:12px;">If you did not request this, please ignore this email.</p>
      <p>— TransportBidder</p>
    </div>
  `;
  return sendEmail(toEmail, '', subject, html);
}

module.exports = { isConfigured, sendEmail, sendVerificationOtp, sendPasswordResetOtp };
