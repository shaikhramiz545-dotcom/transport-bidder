/**
 * Email service for OTP & notifications.
 * Primary: AWS SES (production)
 * Fallback: SMTP relay (nodemailer)
 *
 * Env vars:
 *   AWS_SES_REGION      – SES region (default: ap-south-1)
 *   SES_FROM_EMAIL      – verified sender (e.g. noreply@transportbidder.com)
 *   SES_FROM_NAME       – display name (e.g. TransportBidder)
 *
 * SMTP fallback (used when SES fails or in local dev):
 *   SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASS / MAIL_FROM
 */

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const nodemailer = require('nodemailer');

const SES_REGION = process.env.AWS_SES_REGION || process.env.AWS_REGION || 'ap-south-1';
const FROM_EMAIL = process.env.SES_FROM_EMAIL || process.env.MSG91_FROM_EMAIL || 'noreply@transportbidder.com';
const FROM_NAME = process.env.SES_FROM_NAME || process.env.MSG91_FROM_NAME || 'TransportBidder';

let sesClient = null;
function getSesClient() {
  if (!sesClient) {
    sesClient = new SESClient({ region: SES_REGION });
  }
  return sesClient;
}

function isConfigured() {
  // SES uses IAM credentials from environment/instance role — always configured on AWS
  return !!(process.env.AWS_ACCESS_KEY_ID || process.env.AWS_EXECUTION_ENV || process.env.ECS_CONTAINER_METADATA_URI);
}

/** Send via AWS SES */
async function sendEmailSes(toEmail, subject, htmlBody) {
  try {
    const client = getSesClient();
    const command = new SendEmailCommand({
      Source: `${FROM_NAME} <${FROM_EMAIL}>`,
      Destination: { ToAddresses: [toEmail] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: htmlBody, Charset: 'UTF-8' },
          Text: { Data: htmlBody.replace(/<[^>]+>/g, ''), Charset: 'UTF-8' },
        },
      },
    });
    const result = await client.send(command);
    console.log('[ses] email sent to', toEmail, 'MessageId:', result.MessageId);
    return true;
  } catch (err) {
    console.error('[ses] send failed:', err.message, '— trying SMTP fallback');
    return false;
  }
}

/** Send via SMTP (nodemailer) — fallback when SES fails or in local dev. */
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
      from: process.env.MAIL_FROM || `${FROM_NAME} <${FROM_EMAIL}>`,
      to: toEmail,
      subject,
      html: htmlBody,
      text: htmlBody.replace(/<[^>]+>/g, ''),
    });
    console.log('[smtp] email sent to', toEmail);
    return true;
  } catch (err) {
    console.error('[smtp] send failed:', err.message);
    return false;
  }
}

async function sendEmail(toEmail, toName, subject, htmlBody) {
  // Primary: AWS SES
  const sesResult = await sendEmailSes(toEmail, subject, htmlBody);
  if (sesResult) return true;

  // Fallback: SMTP relay
  const smtpResult = await sendEmailSmtp(toEmail, subject, htmlBody);
  if (smtpResult) return true;

  console.error('[email] all methods failed for', toEmail);
  return false;
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
  return sendEmail(toEmail, '', subject, htmlBody);
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
  return sendEmail(toEmail, '', subject, htmlBody);
}

/**
 * Send welcome email after successful signup/verification.
 * @param {string} toEmail
 * @param {string} userName
 * @param {'user'|'driver'} role
 */
async function sendWelcomeEmail(toEmail, userName, role = 'user') {
  const appName = role === 'driver' ? 'TransportBidder Driver' : 'TransportBidder';
  const name = userName || 'User';
  const subject = `Welcome to ${appName}!`;
  const htmlBody = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h2 style="color:#FF5F00">${appName}</h2>
    <p>Hi ${name},</p>
    <p>Welcome to ${appName}! Your account has been verified successfully.</p>
    <p>You can now start using the app to book rides, track drivers, and more.</p>
    <p style="color:#666;font-size:14px">If you have any questions, contact us at support@transportbidder.com</p>
  </div>`;
  return sendEmail(toEmail, name, subject, htmlBody);
}

module.exports = { isConfigured, sendEmail, sendVerificationOtp, sendPasswordResetOtp, sendWelcomeEmail };
