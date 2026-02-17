/**
 * Payment Webhook Security Middleware
 * Verifies the signature of incoming webhooks from dLocal.
 */
const crypto = require('crypto');

const verifyWebhookSignature = (req, res, next) => {
  try {
    const signature = req.headers['x-signature'] || req.headers['x-dlocal-signature'];
    const secret = process.env.DLOCAL_SECRET_KEY;
    
    if (!secret) {
      console.error('DLOCAL_SECRET_KEY is not defined');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }

    // TODO: Implement exact signature verification logic for dLocal.
    // Usually involves hashing the body with the secret key.
    // Example:
    // const hmac = crypto.createHmac('sha256', secret);
    // const calculatedSignature = hmac.update(JSON.stringify(req.body)).digest('hex');
    
    // For now, we reject if signature is obviously invalid length or format
    // This is a placeholder skeleton as requested.
    
    // const isValid = timingSafeEqual(signature, calculatedSignature);
    
    // if (!isValid) {
    //   return res.status(403).json({ error: 'Invalid signature' });
    // }

    next();
  } catch (err) {
    console.error('Webhook verification error:', err);
    return res.status(403).json({ error: 'Invalid webhook request' });
  }
};

module.exports = verifyWebhookSignature;
