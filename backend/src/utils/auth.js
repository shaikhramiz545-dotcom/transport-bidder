const jwt = require('jsonwebtoken');
const config = require('../config');
const { getClient: getRedis } = require('../services/redis');

async function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.jti) {
      const valid = await getRedis().exists(`jti:${payload.jti}`);
      if (!valid) return res.status(401).json({ error: 'Token revoked or expired' });
    }
    req.auth = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

async function revokeToken(jti) {
  if (!jti) return;
  await getRedis().del(`jti:${jti}`);
}

function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    const role = req.auth && req.auth.role;
    
    if (!role || !allowed.includes(role)) {
      console.warn(`[Auth] Access Denied. Required: ${allowed.join('|')}, Actual: ${role || 'none'}`);
      
      // Structured error response if wrapper available, else standard json
      const errorMsg = 'Forbidden: Insufficient permissions';
      if (res.jsonError) {
        return res.jsonError(errorMsg, 'FORBIDDEN', 403);
      }
      return res.status(403).json({ error: errorMsg });
    }
    return next();
  };
}

module.exports = { authenticate, requireRole, revokeToken };
