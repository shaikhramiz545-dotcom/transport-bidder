/**
 * Zoho ZeptoMail – transactional email service for OTP & notifications.
 * Used for: account verification, forgot-password, general notifications.
 *
 * Env vars:
 *   ZEPTOMAIL_API_KEY   – "Zoho-enczapikey ..."
 *   ZEPTOMAIL_FROM_EMAIL – verified sender (e.g. noreply@transportbidder.com)
 *   ZEPTOMAIL_FROM_NAME  – display name (e.g. TransportBidder)
 *   ZEPTOMAIL_API_URL    – optional, default https://api.zeptomail.com/
 */

const API_URL = process.env.ZEPTOMAIL_API_URL || 'https://api.zeptomail.com/';
const API_KEY = process.env.ZEPTOMAIL_API_KEY || '';
const FROM_EMAIL = process.env.ZEPTOMAIL_FROM_EMAIL || 'noreply@transportbidder.com';
const FROM_NAME = process.env.ZEPTOMAIL_FROM_NAME || 'TransportBidder';

function isConfigured() {
  return !!API_KEY;
}

/**
 * Send an email via ZeptoMail Send API v1.1.
 * @param {string} toEmail
 * @param {string} toName
 * @param {string} subject
 * @param {string} htmlBody
 * @param {string} [textBody]
 * @returns {Promise<boolean>}
 */
async function sendEmail(toEmail, toName, subject, htmlBody, textBody) {
  if (!API_KEY) {
    console.error('[zeptomail] ZEPTOMAIL_API_KEY not set; email skipped.');
    return false;
  }
  const url = `${API_URL.replace(/\/+$/, '')}/v1.1/email`;
  const body = {
    from: { address: FROM_EMAIL, name: FROM_NAME },
    to: [{ email_address: { address: toEmail, name: toName || toEmail } }],
    subject,
    htmlbody: htmlBody,
  };
  if (textBody) body.textbody = textBody;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': API_KEY,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      return true;
    }
    const errText = await res.text();
    console.error(`[zeptomail] send failed (${res.status}):`, errText);
    return false;
  } catch (err) {
    console.error('[zeptomail] send error:', err.message);
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
  const text = `Your ${appName} verification code is: ${otp}\nExpires in 10 minutes.`;
  return sendEmail(toEmail, '', subject, html, text);
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
  const text = `Your ${panelName} password reset code is: ${otp}\nExpires in 10 minutes.`;
  return sendEmail(toEmail, '', subject, html, text);
}

module.exports = { isConfigured, sendEmail, sendVerificationOtp, sendPasswordResetOtp };
