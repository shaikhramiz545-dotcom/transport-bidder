/**
 * Redis client wrapper — graceful fallback to in-memory Map when Redis is not configured.
 * Set REDIS_URL=redis://host:6379 (or rediss:// for TLS) to enable Redis.
 * Without REDIS_URL the server still works on a single instance (dev / staging).
 */
const Redis = require('ioredis');

let client = null;
let usingRedis = false;

const memStore = new Map();

function _memKey(key) { return key; }

function _isExpired(entry) {
  return entry.expiresAt !== null && Date.now() > entry.expiresAt;
}

const memAdapter = {
  async get(key) {
    const e = memStore.get(_memKey(key));
    if (!e || _isExpired(e)) { memStore.delete(key); return null; }
    return e.value;
  },
  async set(key, value) {
    memStore.set(_memKey(key), { value, expiresAt: null });
  },
  async setex(key, ttlSeconds, value) {
    memStore.set(_memKey(key), { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  },
  async del(key) {
    memStore.delete(_memKey(key));
  },
  async sadd(key, ...members) {
    const e = memStore.get(key);
    const set = e && !_isExpired(e) ? new Set(JSON.parse(e.value)) : new Set();
    members.forEach(m => set.add(m));
    memStore.set(key, { value: JSON.stringify([...set]), expiresAt: null });
  },
  async srem(key, ...members) {
    const e = memStore.get(key);
    if (!e || _isExpired(e)) return;
    const set = new Set(JSON.parse(e.value));
    members.forEach(m => set.delete(m));
    memStore.set(key, { value: JSON.stringify([...set]), expiresAt: null });
  },
  async smembers(key) {
    const e = memStore.get(key);
    if (!e || _isExpired(e)) return [];
    return JSON.parse(e.value);
  },
  async hset(key, field, value) {
    const e = memStore.get(key);
    const obj = e && !_isExpired(e) ? JSON.parse(e.value) : {};
    obj[field] = value;
    memStore.set(key, { value: JSON.stringify(obj), expiresAt: null });
  },
  async hget(key, field) {
    const e = memStore.get(key);
    if (!e || _isExpired(e)) return null;
    const obj = JSON.parse(e.value);
    return obj[field] ?? null;
  },
  async hgetall(key) {
    const e = memStore.get(key);
    if (!e || _isExpired(e)) return null;
    return JSON.parse(e.value);
  },
  async hdel(key, field) {
    const e = memStore.get(key);
    if (!e || _isExpired(e)) return;
    const obj = JSON.parse(e.value);
    delete obj[field];
    memStore.set(key, { value: JSON.stringify(obj), expiresAt: null });
  },
  async expire(key, ttlSeconds) {
    const e = memStore.get(key);
    if (!e) return;
    e.expiresAt = Date.now() + ttlSeconds * 1000;
  },
  async exists(key) {
    const e = memStore.get(key);
    if (!e || _isExpired(e)) { memStore.delete(key); return 0; }
    return 1;
  },
  async incr(key) {
    const e = memStore.get(key);
    const current = e && !_isExpired(e) ? parseInt(e.value, 10) : 0;
    const next = current + 1;
    memStore.set(key, { value: String(next), expiresAt: e?.expiresAt ?? null });
    return next;
  },
};

function init() {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn('[Redis] REDIS_URL not set — using in-memory fallback (single-instance only)');
    return;
  }
  try {
    client = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
      tls: url.startsWith('rediss://') ? { rejectUnauthorized: true } : undefined,
    });
    client.on('connect', () => console.log('[Redis] Connected'));
    client.on('error', (err) => console.error('[Redis] Error:', err.message));
    usingRedis = true;
  } catch (err) {
    console.warn('[Redis] Init failed, falling back to in-memory:', err.message);
    client = null;
    usingRedis = false;
  }
}

function getClient() {
  return usingRedis && client ? client : memAdapter;
}

function isRedisEnabled() {
  return usingRedis;
}

init();

module.exports = { getClient, isRedisEnabled };
