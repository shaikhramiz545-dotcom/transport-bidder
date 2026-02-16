/**
 * Agency payout email – booking history + amount per booking, PDF & Excel attachments.
 * Gateway charges & transfer fee deducted; net amount in email.
 */
const PDFDocument = require('pdfkit');
const XLSX = require('xlsx');
const nodemailer = require('nodemailer');

function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { dateStyle: 'short' }); } catch (_) { return String(d); }
}

function formatDateTime(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }); } catch (_) { return String(d); }
}

/**
 * Build PDF buffer: payout summary + booking history table.
 */
function buildPdfBuffer(payout, agencyName, bookings) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text('TBidder – Payout Summary', { continued: false });
    doc.fontSize(10).text(`Agency: ${agencyName || '—'}`, { continued: false });
    doc.text(`Processed: ${formatDateTime(payout.processedAt)}`, { continued: false });
    doc.moveDown();

    doc.fontSize(12).text('Payout details', { continued: false });
    doc.fontSize(10);
    doc.text(`Requested amount: ${Number(payout.amount).toFixed(2)} ${payout.currency || 'USD'}`, { continued: false });
    if (payout.gatewayCharges != null) doc.text(`Gateway charges (deducted): ${Number(payout.gatewayCharges).toFixed(2)} ${payout.currency || 'USD'}`, { continued: false });
    if (payout.transferFee != null) doc.text(`Transfer fee (deducted): ${Number(payout.transferFee).toFixed(2)} ${payout.currency || 'USD'}`, { continued: false });
    if (payout.netAmount != null) doc.text(`Net amount paid: ${Number(payout.netAmount).toFixed(2)} ${payout.currency || 'USD'}`, { continued: false });
    doc.moveDown();

    doc.fontSize(12).text('Booking history', { continued: false });
    doc.fontSize(10);
    const tableTop = doc.y + 10;
    const headers = ['Date', 'Tour', 'Slot', 'Guest', 'Amount'];
    const colWidths = [70, 120, 60, 100, 60];
    let x = 50;
    headers.forEach((h, i) => {
      doc.rect(x, tableTop, colWidths[i], 18).stroke();
      doc.text(h, x + 4, tableTop + 4, { width: colWidths[i] - 8 });
      x += colWidths[i];
    });
    let y = tableTop + 18;
    (bookings || []).forEach((b) => {
      x = 50;
      const row = [
        formatDate(b.createdAt),
        (b.tourTitle || '—').slice(0, 25),
        (b.slotDate || '—') + (b.slotStartTime ? ` ${b.slotStartTime}` : ''),
        (b.guestName || '—').slice(0, 20),
        `${Number(b.totalAmount || 0).toFixed(2)} ${b.currency || 'USD'}`,
      ];
      row.forEach((cell, i) => {
        doc.rect(x, y, colWidths[i], 16).stroke();
        doc.text(String(cell).slice(0, 30), x + 4, y + 3, { width: colWidths[i] - 8, overflow: 'ellipsis' });
        x += colWidths[i];
      });
      y += 16;
    });
    doc.moveDown(2);
    doc.text(`Total bookings in this report: ${(bookings || []).length}`, { continued: false });
    doc.end();
  });
}

/**
 * Build Excel buffer: payout summary sheet + booking history sheet.
 */
function buildExcelBuffer(payout, agencyName, bookings) {
  const wb = XLSX.utils.book_new();
  const summary = [
    ['TBidder – Payout Summary'],
    ['Agency', agencyName || '—'],
    ['Processed', formatDateTime(payout.processedAt)],
    ['Requested amount', `${Number(payout.amount).toFixed(2)} ${payout.currency || 'USD'}`],
    ['Gateway charges (deducted)', payout.gatewayCharges != null ? `${Number(payout.gatewayCharges).toFixed(2)} ${payout.currency || 'USD'}` : '—'],
    ['Transfer fee (deducted)', payout.transferFee != null ? `${Number(payout.transferFee).toFixed(2)} ${payout.currency || 'USD'}` : '—'],
    ['Net amount paid', payout.netAmount != null ? `${Number(payout.netAmount).toFixed(2)} ${payout.currency || 'USD'}` : '—'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Summary');
  const bookingRows = [
    ['Date', 'Tour', 'Slot date', 'Slot time', 'Guest', 'Email', 'Amount', 'Currency'],
    ...(bookings || []).map((b) => [
      formatDate(b.createdAt),
      b.tourTitle || '—',
      b.slotDate || '—',
      b.slotStartTime || '—',
      b.guestName || '—',
      b.guestEmail || '—',
      b.totalAmount,
      b.currency || 'USD',
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bookingRows), 'Booking History');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Send payout email to agency with PDF and Excel attachments.
 */
async function sendPayoutEmail(toEmail, agencyName, payout, bookings, pdfBuffer, excelBuffer) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  const from = process.env.MAIL_FROM || 'noreply@tbidder.com';
  const net = payout.netAmount != null ? Number(payout.netAmount).toFixed(2) : Number(payout.amount).toFixed(2);
  const gateway = payout.gatewayCharges != null ? Number(payout.gatewayCharges).toFixed(2) : '0.00';
  const transfer = payout.transferFee != null ? Number(payout.transferFee).toFixed(2) : '0.00';
  const currency = payout.currency || 'USD';
  const html = `
    <p>Hello ${agencyName || 'Partner'},</p>
    <p>Your payout has been processed.</p>
    <ul>
      <li><strong>Requested amount:</strong> ${Number(payout.amount).toFixed(2)} ${currency}</li>
      <li><strong>Gateway charges (deducted):</strong> ${gateway} ${currency}</li>
      <li><strong>Transfer fee (deducted):</strong> ${transfer} ${currency}</li>
      <li><strong>Net amount paid:</strong> ${net} ${currency}</li>
    </ul>
    <p>Attached: Payout summary and booking history (PDF and Excel).</p>
    <p>— TBidder</p>
  `;
  const attachments = [
    { filename: 'payout-summary.pdf', content: pdfBuffer },
    { filename: 'payout-booking-history.xlsx', content: excelBuffer },
  ];
  try {
    await transporter.sendMail({
      from,
      to: toEmail,
      subject: `TBidder – Payout completed (${net} ${currency})`,
      text: `Your payout of ${net} ${currency} (after gateway and transfer fees) has been processed. See attached PDF and Excel for booking history.`,
      html,
      attachments,
    });
    return true;
  } catch (err) {
    console.error('[agency-payout-email] send failed:', err.message);
    return false;
  }
}

module.exports = { buildPdfBuffer, buildExcelBuffer, sendPayoutEmail, formatDate, formatDateTime };
