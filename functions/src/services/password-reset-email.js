/**
 * Send password reset OTP email for Admin & Agency panels.
 */
const nodemailer = require('nodemailer');

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

/**
 * @param {string} toEmail
 * @param {string} otp - 6-digit OTP
 * @param {'admin'|'agency'|'user'} scope
 */
async function sendPasswordResetOtpEmail(toEmail, otp, scope = 'agency') {
  const transporter = getTransporter();
  const from = process.env.MAIL_FROM || 'noreply@tbidder.com';
  const panelName = scope === 'admin' ? 'Admin Panel' : scope === 'user' ? 'User App' : 'Partner Portal';
  const subject = `TBidder – Password reset OTP (${panelName})`;
  const html = `
    <p>You requested a password reset for your TBidder ${panelName} account.</p>
    <p><strong>Your OTP is: ${otp}</strong></p>
    <p>This code expires in 10 minutes. Do not share it with anyone.</p>
    <p>If you did not request this, please ignore this email.</p>
    <p>— TBidder</p>
  `;
  try {
    await transporter.sendMail({
      from,
      to: toEmail,
      subject,
      text: html.replace(/<[^>]+>/g, ''),
      html,
    });
    return true;
  } catch (err) {
    console.error('[password-reset-email] send failed:', err.message);
    return false;
  }
}

module.exports = { sendPasswordResetOtpEmail };
