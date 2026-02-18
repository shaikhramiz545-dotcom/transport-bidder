/**
 * MSG91 – transactional email service for OTP & notifications.
 * Used for: account verification, forgot-password, general notifications.
 *
 * Env vars:
 *   MSG91_AUTH_KEY      – Auth key from MSG91 dashboard
 *   MSG91_FROM_EMAIL    – verified sender (e.g. noreply@transportbidder.com)
 *   MSG91_FROM_NAME     – display name (e.g. TransportBidder)
 *   MSG91_DOMAIN        – verified domain in MSG91 (e.g. transportbidder.com)
 *   MSG91_TEMPLATE_ID   – (optional) only set if you have a verified template
 *
 * SMTP fallback (used when MSG91 fails or AUTH_KEY not set):
 *   SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASS / MAIL_FROM
 */

const nodemailer = require('nodemailer');

const API_URL = 'https://control.msg91.com/api/v5/email/send';
const AUTH_KEY = process.env.MSG91_AUTH_KEY || '';
const FROM_EMAIL = process.env.MSG91_FROM_EMAIL || 'noreply@notification.transportbidder.com';
const FROM_NAME = process.env.MSG91_FROM_NAME || 'TransportBidder';
const DOMAIN = process.env.MSG91_DOMAIN || 'notification.transportbidder.com';
const TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID || '';  // leave empty unless you have a verified template

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
/** Send via SMTP (nodemailer) — used as fallback when MSG91 fails. */
async function sendEmailSmtp(toEmail, subject, htmlBody) {
  const host = process.env.SMTP_HOST;
  if (!host) return false;
  try {
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    await transporter.sendMail({
      from: process.env.MAIL_FROM || FROM_EMAIL,
      to: toEmail,
      subject,
      html: htmlBody,
      text: htmlBody.replace(/<[^>]+>/g, ''),
    });
    console.log('[smtp-fallback] email sent to', toEmail);
    return true;
  } catch (err) {
    console.error('[smtp-fallback] send failed:', err.message);
    return false;
  }
}

async function sendEmail(toEmail, toName, subject, htmlBody, variables = {}) {
  // Try MSG91 first
  if (AUTH_KEY) {
    const payload = {
      recipients: [{ to: [{ email: toEmail, name: toName || toEmail }], variables }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      domain: DOMAIN,
      subject,
      body: htmlBody,
      content_type: 'HTML',
    };
    // Only include template_id when explicitly configured (avoid conflict with custom body)
    if (TEMPLATE_ID) payload.template_id = TEMPLATE_ID;

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'authkey': AUTH_KEY },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        console.log('[msg91] email sent to', toEmail, data);
        return true;
      }
      const errText = await res.text();
      console.error(`[msg91] send failed (${res.status}):`, errText, '— trying SMTP fallback');
    } catch (err) {
      console.error('[msg91] send error:', err.message, '— trying SMTP fallback');
    }
  } else {
    console.warn('[msg91] MSG91_AUTH_KEY not set — trying SMTP fallback');
  }

  // SMTP fallback
  return sendEmailSmtp(toEmail, subject, htmlBody);
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
  const htmlBody = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h2 style="color:#FF5F00">${appName}</h2>
    <p>Your verification code is:</p>
    <div style="font-size:32px;font-weight:700;letter-spacing:6px;text-align:center;padding:16px;background:#f5f5f5;border-radius:8px;margin:16px 0">${otp}</div>
    <p style="color:#666;font-size:14px">This code expires in 10 minutes. Do not share it with anyone.</p>
  </div>`;
  return sendEmail(toEmail, '', subject, htmlBody, {
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
  const htmlBody = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h2 style="color:#FF5F00">TransportBidder ${panelName}</h2>
    <p>Your password reset code is:</p>
    <div style="font-size:32px;font-weight:700;letter-spacing:6px;text-align:center;padding:16px;background:#f5f5f5;border-radius:8px;margin:16px 0">${otp}</div>
    <p style="color:#666;font-size:14px">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
  </div>`;
  return sendEmail(toEmail, '', subject, htmlBody, {
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
