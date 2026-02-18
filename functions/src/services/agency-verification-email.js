/**
 * Send email to travel agency when verification status changes (approved / rejected / needs_documents).
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
 * @param {string} agencyName
 * @param {'approved'|'rejected'|'needs_documents'} status
 * @param {string} [note] - Admin note (for rejected or needs_documents)
 */
async function sendAgencyVerificationEmail(toEmail, agencyName, status, note = '') {
  const transporter = getTransporter();
  const from = process.env.MAIL_FROM || 'noreply@tbidder.com';
  let subject;
  let html;
  if (status === 'approved') {
    subject = 'TBidder – Your travel agency account has been approved';
    html = `
      <p>Hello ${agencyName || 'Partner'},</p>
      <p>Your travel agency account has been <strong>approved</strong>. You can now add tours and receive bookings.</p>
      <p>— TBidder</p>
    `;
  } else if (status === 'rejected') {
    subject = 'TBidder – Application declined';
    html = `
      <p>Hello ${agencyName || 'Partner'},</p>
      <p>Unfortunately your travel agency application has been <strong>declined</strong>.</p>
      ${note ? `<p><strong>Reason:</strong> ${note}</p>` : ''}
      <p>If you have questions, please contact support.</p>
      <p>— TBidder</p>
    `;
  } else {
    // needs_documents
    subject = 'TBidder – Additional documents required';
    html = `
      <p>Hello ${agencyName || 'Partner'},</p>
      <p>We need additional documents to complete your verification.</p>
      ${note ? `<p><strong>Required:</strong> ${note}</p>` : ''}
      <p>Please log in to the partner portal and upload the requested documents. We will review and get back to you.</p>
      <p>— TBidder</p>
    `;
  }
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
    console.error('[agency-verification-email] send failed:', err.message);
    return false;
  }
}

module.exports = { sendAgencyVerificationEmail };
