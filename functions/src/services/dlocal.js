/**
 * dLocal Go Payment Gateway – Tours payment.
 * Needs: DLOCAL_API_KEY, DLOCAL_SECRET_KEY in .env
 * Sandbox: DLOCAL_SANDBOX=true (uses api-sbx.dlocalgo.com)
 */
const axios = require('axios');

const SANDBOX_URL = 'https://api-sbx.dlocalgo.com';
const LIVE_URL = 'https://api.dlocalgo.com';

function getBaseUrl() {
  return process.env.DLOCAL_SANDBOX === 'true' || process.env.DLOCAL_SANDBOX === '1'
    ? SANDBOX_URL
    : LIVE_URL;
}

function getAuth() {
  const apiKey = process.env.DLOCAL_API_KEY || '';
  const secretKey = process.env.DLOCAL_SECRET_KEY || '';
  if (!apiKey || !secretKey) return null;
  return Buffer.from(`${apiKey}:${secretKey}`).toString('base64');
}

/** Check if dLocal is configured */
function isConfigured() {
  return !!(process.env.DLOCAL_API_KEY && process.env.DLOCAL_SECRET_KEY);
}

/**
 * Create payment – returns redirect_url for user to complete payment.
 * @param {Object} opts
 * @param {string} opts.orderId – Our booking/order ID
 * @param {number} opts.amount
 * @param {string} opts.currency – USD, PEN, etc.
 * @param {string} opts.country – PE, BR, etc.
 * @param {string} opts.description
 * @param {string} opts.successUrl
 * @param {string} opts.backUrl
 * @param {string} opts.notificationUrl – Webhook URL
 * @param {Object} [opts.payer] – { name, email, phone }
 */
async function createPayment(opts) {
  const auth = getAuth();
  if (!auth) {
    throw new Error('dLocal not configured. Set DLOCAL_API_KEY and DLOCAL_SECRET_KEY in .env');
  }

  const body = {
    order_id: opts.orderId,
    amount: Number(opts.amount),
    currency: (opts.currency || 'USD').toUpperCase(),
    country: (opts.country || 'PE').toUpperCase(),
    description: (opts.description || 'Tour booking').substring(0, 100),
    success_url: opts.successUrl,
    back_url: opts.backUrl,
    notification_url: opts.notificationUrl,
  };
  if (opts.payer && (opts.payer.name || opts.payer.email)) {
    body.payer = {};
    if (opts.payer.name) body.payer.name = opts.payer.name;
    if (opts.payer.email) body.payer.email = opts.payer.email;
    if (opts.payer.phone) body.payer.phone = opts.payer.phone;
  }

  const res = await axios.post(`${getBaseUrl()}/v1/payments`, body, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DLOCAL_API_KEY}:${process.env.DLOCAL_SECRET_KEY}`,
    },
    timeout: 15000,
  });

  return {
    paymentId: res.data?.id,
    redirectUrl: res.data?.redirect_url,
    status: res.data?.status,
    orderId: res.data?.order_id,
  };
}

/**
 * Retrieve payment status
 */
async function getPayment(paymentId) {
  const auth = getAuth();
  if (!auth) throw new Error('dLocal not configured');

  const res = await axios.get(`${getBaseUrl()}/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${process.env.DLOCAL_API_KEY}:${process.env.DLOCAL_SECRET_KEY}`,
    },
    timeout: 10000,
  });

  return {
    id: res.data?.id,
    status: res.data?.status, // PENDING, PAID, REJECTED, etc.
    amount: res.data?.amount,
    currency: res.data?.currency,
    order_id: res.data?.order_id,
  };
}

module.exports = { createPayment, getPayment, isConfigured, getBaseUrl };
